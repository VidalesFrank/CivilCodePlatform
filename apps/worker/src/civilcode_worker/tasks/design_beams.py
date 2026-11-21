"""Task Celery — design_beams.run_beam_design

Diseño a flexión simplificado para una viga (o grupo continuo) según NSR-10.
No usa OpenSees ni envelopes reales: asume carga distribuida equivalente
dada por el usuario (o self-weight) y M = w·L²/10 (empotramiento parcial,
conservador para zonas de apoyo; para centro se usa w·L²/14).

Resultado por tramo (element):
- geom: b, h, L, d
- demands: Mu_apoyo_kNm, Mu_centro_kNm (estimados)
- As_req_apoyo_cm2, As_req_centro_cm2, As_min_cm2, As_max_cm2
- bar_sel_apoyo: {bar: '#5', n: 3, As_prov_cm2}, idem centro
- phi_Mn_apoyo_kNm, phi_Mn_centro_kNm
- rho_checks: {rho_apoyo, rho_centro, ok}
- warnings

Convenciones NSR-10:
- phi_flex = 0.90
- As_min = max(0.25*sqrt(fc)/fy, 1.4/fy) * b * d   (C.9.6.1.2)
- rho_max = 0.75 * rho_balance  (simplificado)
- beta1 según C.22.2.2.4.3
- Barras comerciales: #3 (9.5), #4 (12.7), #5 (15.9), #6 (19.1), #7 (22.2), #8 (25.4)
"""

from __future__ import annotations

import math
import traceback
from datetime import UTC, datetime
from uuid import UUID

from celery import Task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from civilcode_api.config import get_settings
from civilcode_api.models.design import BeamDesign
from civilcode_api.models.element import Element
from civilcode_api.models.section import Section
from civilcode_api.models.structure import Node

from ..celery_app import app
from ..services.beam_envelope import (
    ElementEnvelope,
    GroupEnvelope,
    compute_element_envelope,
    compute_group_envelope,
    envelope_series,
)
from ..services.beam_grouper import BeamGroup, group_beams
from ..services.beam_rebar_layout import compute_layout, layout_to_dict

CONCRETE_DENSITY_KG_M3 = 2400.0
GRAVITY = 9.80665

# Barras ASTM/NSR-10 (Nº = octavos de pulgada)
REBAR_DB = [
    ("#3", 9.52),
    ("#4", 12.7),
    ("#5", 15.9),
    ("#6", 19.05),
    ("#7", 22.22),
    ("#8", 25.4),
]


def _sync_session_factory() -> sessionmaker[Session]:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("+psycopg", "")
    engine = create_engine(sync_url, future=True)
    return sessionmaker(engine, expire_on_commit=False, future=True)


def _bar_area_cm2(db_mm: float) -> float:
    r = db_mm / 2.0 / 10.0  # cm
    return math.pi * r * r


def _beta1(fc_mpa: float) -> float:
    if fc_mpa <= 28:
        return 0.85
    return max(0.65, 0.85 - 0.05 * (fc_mpa - 28) / 7.0)


def _as_min_cm2(fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float) -> float:
    # NSR-10 C.9.6.1.2: As_min = max(0.25*sqrt(fc)/fy, 1.4/fy) * b * d, en SI (N/mm²).
    # b, d en cm → pasar a cm². Resultado en cm².
    ratio = max(0.25 * math.sqrt(fc_mpa) / fy_mpa, 1.4 / fy_mpa)
    return ratio * b_cm * d_cm


def _rho_balance(fc_mpa: float, fy_mpa: float) -> float:
    b1 = _beta1(fc_mpa)
    return 0.85 * b1 * (fc_mpa / fy_mpa) * (600.0 / (600.0 + fy_mpa))


def _rho_max(fc_mpa: float, fy_mpa: float) -> float:
    return 0.75 * _rho_balance(fc_mpa, fy_mpa)


def _as_req_cm2(mu_kNm: float, fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float) -> float:
    """As requerido a flexión, método de rectángulo equivalente.

    Mu en kN·m, fc/fy en MPa, b/d en cm. As en cm².
    """
    if mu_kNm <= 0:
        return 0.0
    phi = 0.90
    # Pasar a unidades consistentes: usamos kN, cm, MPa ≡ kN/cm² × 10.
    # Resolviendo As * fy * (d - 0.588 * As * fy / (fc * b)) = Mu / phi:
    # Expresión con unidades: As [cm²], fy [MPa], d [cm], fc [MPa], b [cm] → Mu en kN·cm si convertimos MPa→kN/cm² dividiendo /10.
    fy = fy_mpa / 10.0  # kN/cm²
    fc = fc_mpa / 10.0  # kN/cm²
    mu_kNcm = mu_kNm * 100.0 / phi  # Mu demand nominal

    # a = As*fy/(0.85*fc*b); Mu_n = As*fy*(d - a/2)
    # Resolver cuadrática: 0.85*fc*b*a² − 2·0.85*fc*b*d·a + 2·Mu_n = 0
    # Equivalente clásico: m = Mu_n/(phi*fc*b*d²) no aplica (ya quité phi). Usamos:
    # ω = 0.85 − sqrt(0.85² − 2·0.85·Mu_n/(fc·b·d²))
    disc = 0.85 * 0.85 - 2.0 * 0.85 * mu_kNcm / max(fc * b_cm * d_cm * d_cm, 1e-9)
    if disc < 0:
        # sección insuficiente — devolvemos As muy grande para forzar warning
        return float("inf")
    omega = 0.85 - math.sqrt(disc)
    a_over_d = omega / 0.85
    a_cm = a_over_d * d_cm
    as_cm2 = 0.85 * fc * b_cm * a_cm / fy
    return as_cm2


def _select_bars(as_req_cm2: float, as_min_cm2: float) -> dict:
    """Elige combinación N × barra para cubrir As_req (o As_min si mayor)."""
    target = max(as_req_cm2, as_min_cm2)
    if target <= 0:
        return {"bar": "#3", "n": 2, "as_prov_cm2": 2 * _bar_area_cm2(9.52)}
    best = None
    for bar_name, db_mm in REBAR_DB:
        a = _bar_area_cm2(db_mm)
        n = max(2, math.ceil(target / a))
        as_prov = n * a
        # Preferir combinaciones con n entre 2 y 8 y menor sobrearea
        over = as_prov - target
        if best is None or (n <= 10 and over < best["over"]):
            best = {"bar": bar_name, "n": n, "as_prov_cm2": round(as_prov, 3), "over": round(over, 3), "db_mm": db_mm}
        if n <= 6:
            break  # suficiente, no probar barras más grandes
    best.pop("over", None)
    best.pop("db_mm", None)
    return best


def _phi_mn_kNm(as_cm2: float, fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float) -> float:
    if as_cm2 <= 0:
        return 0.0
    fy = fy_mpa / 10.0
    fc = fc_mpa / 10.0
    a_cm = as_cm2 * fy / (0.85 * fc * b_cm)
    mn_kNcm = as_cm2 * fy * (d_cm - a_cm / 2.0)
    return 0.90 * mn_kNcm / 100.0  # a kN·m


# ── Cortante / estribos ──────────────────────────────────────────────────────
#
# NSR-10 simplificado (C.22.5):
#   φVn = φ (Vc + Vs)
#   φ = 0.75 (C.9.3.2.3)
#   Vc = 0.17 * sqrt(fc[MPa]) * b * d  [N] (concreto sin axial)
#   Vs_req = Vu / φ − Vc
#   s = Av · fy · d / Vs    (estribo de dos ramas → Av = 2 · a_bar)
#   Max spacing: d/2 (general); d/4 en zona confinada DMO (2h desde apoyo)
#   Min stirrup: #3 @ max(d/2, 300mm) si Vu ≤ φVc/2 no es obligatorio pero se usa
# Unidades que uso aquí: fc/fy en MPa, b/d en cm, V en kN.
# Vc [kN] = 0.17 * sqrt(fc[MPa]) * (b_cm * d_cm / 100)  (porque N→kN y mm²→cm²·100)
# Lo expreso explícitamente abajo.

STIRRUP_BARS = [("#3", 9.52), ("#4", 12.7)]  # típico en vigas


def _vc_kN(fc_mpa: float, b_cm: float, d_cm: float) -> float:
    # Vc = 0.17 * sqrt(fc) [MPa] * b * d [mm²]  → en N
    # b_cm → mm: *10; d_cm → mm: *10; resultado en N → kN: /1000
    b_mm = b_cm * 10.0
    d_mm = d_cm * 10.0
    vc_N = 0.17 * math.sqrt(fc_mpa) * b_mm * d_mm
    return vc_N / 1000.0


def _max_stirrup_spacing_cm(d_cm: float, vs_kN: float, fc_mpa: float, b_cm: float) -> float:
    """s_max NSR-10 C.9.7.6.2.2 (general) y C.21.5.3.2 (zona confinada DMO)."""
    # Umbral para duplicar: Vs ≤ 0.33*sqrt(fc)*b*d  → s_max = d/2; else d/4
    threshold = 0.33 * math.sqrt(fc_mpa) * (b_cm * 10.0) * (d_cm * 10.0) / 1000.0
    base = d_cm / 2.0 if vs_kN <= threshold else d_cm / 4.0
    return min(base, 60.0)  # cap pragmático 60 cm


def _design_shear(
    wu_kN_m: float,
    length_m: float,
    fc_mpa: float,
    fy_mpa: float,
    b_cm: float,
    d_cm: float,
    h_cm: float,
    ductility: str,
) -> dict:
    phi = 0.75
    # Vu máximo a cara de apoyo (viga simplemente apoyada / continua uniforme)
    vu_support = wu_kN_m * length_m / 2.0  # kN, en apoyo
    # Reducción: Vu a distancia d del apoyo (NSR-10 permite para carga uniforme)
    vu_at_d = max(0.0, vu_support - wu_kN_m * d_cm / 100.0)

    vc = _vc_kN(fc_mpa, b_cm, d_cm)
    phi_vc = phi * vc

    needs_stirrups = vu_at_d > phi_vc / 2.0  # NSR-10 C.9.6.3.1
    vs_req = max(0.0, vu_at_d / phi - vc)

    # Seleccionar estribo que cumpla con s_max
    best = None
    for bar_name, db_mm in STIRRUP_BARS:
        av = 2.0 * _bar_area_cm2(db_mm)  # dos ramas en cm²
        fy_kNcm2 = fy_mpa / 10.0
        s_req = av * fy_kNcm2 * d_cm / vs_req if vs_req > 0 else 100.0
        s_max_gen = _max_stirrup_spacing_cm(d_cm, vs_req, fc_mpa, b_cm)
        s_use_gen = min(s_req, s_max_gen)
        # Zona confinada
        if ductility == "DES":
            s_conf_max = min(d_cm / 4.0, 6.0 * (STIRRUP_BARS[0][1] / 10.0), 15.0)
            l_conf = max(2.0 * h_cm, length_m * 100.0 / 6.0, 45.0)  # cm
        elif ductility == "DMO":
            s_conf_max = min(d_cm / 4.0, 8.0 * (STIRRUP_BARS[0][1] / 10.0), 24.0)
            l_conf = 2.0 * h_cm
        else:
            s_conf_max = s_max_gen
            l_conf = 0.0
        s_use_conf = min(s_use_gen, s_conf_max)
        # Vs provisto con el s elegido en zona general
        vs_prov_kN = av * fy_kNcm2 * d_cm / max(s_use_gen, 0.01) if needs_stirrups else 0.0
        phi_vn = phi * (vc + vs_prov_kN) if needs_stirrups else phi_vc

        # Redondear s a múltiplos de 2.5 cm para constructibilidad
        s_use_gen_round = max(5.0, math.floor(s_use_gen / 2.5) * 2.5)
        s_use_conf_round = max(5.0, math.floor(s_use_conf / 2.5) * 2.5)

        cand = {
            "bar": bar_name,
            "db_mm": db_mm,
            "av_cm2": round(av, 3),
            "s_gen_cm": round(s_use_gen_round, 1),
            "s_conf_cm": round(s_use_conf_round, 1),
            "l_conf_cm": round(l_conf, 1),
            "phi_vn_kN": round(phi_vn, 2),
            "ok": phi_vn >= vu_at_d,
        }
        if best is None or (cand["ok"] and not best.get("ok")) or (cand["ok"] == best.get("ok") and cand["s_gen_cm"] > best["s_gen_cm"]):
            best = cand

    best.pop("db_mm", None)
    return {
        "vu_support_kN": round(vu_support, 2),
        "vu_at_d_kN": round(vu_at_d, 2),
        "vc_kN": round(vc, 2),
        "phi_vc_kN": round(phi_vc, 2),
        "needs_stirrups": needs_stirrups,
        "vs_req_kN": round(vs_req, 2),
        "stirrup": best,
    }


def _design_shear_from_vu(
    vu_at_support_kN: float,
    fc_mpa: float,
    fy_mpa: float,
    b_cm: float,
    d_cm: float,
    h_cm: float,
    length_m: float,
    ductility: str,
) -> dict:
    """Diseña estribos para una demanda de cortante Vu ya calculada.

    A diferencia de `_design_shear`, no deriva Vu de una carga uniforme — lo
    recibe. Esto permite chequear dos condiciones por separado: Vc (combo
    gravitacional) y Vcap (combo sísmico amplificado con Ω×E o Mpr).
    """
    phi = 0.75
    # Vu a distancia d de la cara del apoyo, interpolando con un diagrama
    # triangular equivalente — conservador para distribuciones reales.
    vu_at_d = max(0.0, vu_at_support_kN * (1.0 - (d_cm / 100.0) / max(length_m, 0.01) * 2.0))

    vc = _vc_kN(fc_mpa, b_cm, d_cm)
    phi_vc = phi * vc
    needs_stirrups = vu_at_d > phi_vc / 2.0
    vs_req = max(0.0, vu_at_d / phi - vc)

    best = None
    for bar_name, db_mm in STIRRUP_BARS:
        av = 2.0 * _bar_area_cm2(db_mm)
        fy_kNcm2 = fy_mpa / 10.0
        s_req = av * fy_kNcm2 * d_cm / vs_req if vs_req > 0 else 100.0
        s_max_gen = _max_stirrup_spacing_cm(d_cm, vs_req, fc_mpa, b_cm)
        s_use_gen = min(s_req, s_max_gen)
        if ductility == "DES":
            s_conf_max = min(d_cm / 4.0, 6.0 * (STIRRUP_BARS[0][1] / 10.0), 15.0)
            l_conf = max(2.0 * h_cm, length_m * 100.0 / 6.0, 45.0)
        elif ductility == "DMO":
            s_conf_max = min(d_cm / 4.0, 8.0 * (STIRRUP_BARS[0][1] / 10.0), 24.0)
            l_conf = 2.0 * h_cm
        else:
            s_conf_max = s_max_gen
            l_conf = 0.0
        s_use_conf = min(s_use_gen, s_conf_max)
        vs_prov_kN = av * fy_kNcm2 * d_cm / max(s_use_gen, 0.01) if needs_stirrups else 0.0
        phi_vn = phi * (vc + vs_prov_kN) if needs_stirrups else phi_vc

        s_use_gen_round = max(5.0, math.floor(s_use_gen / 2.5) * 2.5)
        s_use_conf_round = max(5.0, math.floor(s_use_conf / 2.5) * 2.5)

        cand = {
            "bar": bar_name,
            "db_mm": db_mm,
            "av_cm2": round(av, 3),
            "s_gen_cm": round(s_use_gen_round, 1),
            "s_conf_cm": round(s_use_conf_round, 1),
            "l_conf_cm": round(l_conf, 1),
            "phi_vn_kN": round(phi_vn, 2),
            "ok": phi_vn >= vu_at_d,
        }
        if (
            best is None
            or (cand["ok"] and not best.get("ok"))
            or (cand["ok"] == best.get("ok") and cand["s_gen_cm"] > best["s_gen_cm"])
        ):
            best = cand

    if best is not None:
        best.pop("db_mm", None)
    return {
        "vu_support_kN": round(vu_at_support_kN, 2),
        "vu_at_d_kN": round(vu_at_d, 2),
        "vc_kN": round(vc, 2),
        "phi_vc_kN": round(phi_vc, 2),
        "needs_stirrups": needs_stirrups,
        "vs_req_kN": round(vs_req, 2),
        "stirrup": best,
    }


def _design_from_envelope(
    db: Session,
    element: Element,
    config: dict,
    envelope_flex: ElementEnvelope,
    envelope_shear_vc: ElementEnvelope,
    envelope_shear_vcap: ElementEnvelope | None,
) -> dict:
    """Diseña una viga usando envolvente real de demandas desde ETABS.

    - Flexión: envolvente_flex (típicamente envelope Max/Min de todas las
      combinaciones de diseño).
    - Cortante Vc: combo gravitacional (ej. 1.2D+1.6L) o el que el usuario elija.
    - Cortante Vcap: combo sísmico con Ω o Mpr (ej. 1.2D+1.0L+2.0E). Opcional.

    El cortante efectivo para dimensionar estribos es max(φVn requerido para
    Vu_Vc, Vu_Vcap). En diseño sísmico DES/DMO manda típicamente el de capacidad.
    """
    fc = float(config.get("fc_mpa", 21.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 40.0))
    ductility = str(config.get("ductility", "DMO"))

    ni = db.get(Node, element.node_i_id) if element.node_i_id else None
    nj = db.get(Node, element.node_j_id) if element.node_j_id else None
    if not ni or not nj:
        return {"element_id": str(element.id), "ok": False, "error": "nodos no encontrados"}
    dx = nj.x - ni.x
    dy = nj.y - ni.y
    dz = nj.z - ni.z
    length_m = math.sqrt(dx * dx + dy * dy + dz * dz)

    sec = db.get(Section, element.section_id) if element.section_id else None
    if not sec or not sec.params:
        return {"element_id": str(element.id), "ok": False, "error": "sin sección asignada"}
    b_m = float(sec.params.get("b_m") or sec.params.get("B") or sec.params.get("base") or 0.0)
    h_m = float(sec.params.get("h_m") or sec.params.get("D") or sec.params.get("depth") or 0.0)
    if b_m <= 0 or h_m <= 0:
        return {"element_id": str(element.id), "ok": False, "error": "sección sin dimensiones"}
    b_cm = b_m * 100.0
    h_cm = h_m * 100.0
    d_cm = h_cm - cover_mm / 10.0 - 1.0

    # Demandas de flexión desde envolvente real
    # En vigas con continuidad: apoyo = momento negativo máximo; centro = positivo máximo.
    mu_neg_left = abs(envelope_flex.m_at_left_support())
    mu_neg_right = abs(envelope_flex.m_at_right_support())
    mu_pos_center = envelope_flex.m_pos_at_center()
    mu_apoyo = max(mu_neg_left, mu_neg_right)

    as_min = _as_min_cm2(fc, fy, b_cm, d_cm)
    as_max = _rho_max(fc, fy) * b_cm * d_cm
    as_req_apoyo = _as_req_cm2(mu_apoyo, fc, fy, b_cm, d_cm)
    as_req_centro = _as_req_cm2(mu_pos_center, fc, fy, b_cm, d_cm)

    sel_apoyo = _select_bars(as_req_apoyo, as_min)
    sel_centro = _select_bars(as_req_centro, as_min)

    phi_mn_apoyo = _phi_mn_kNm(sel_apoyo["as_prov_cm2"], fc, fy, b_cm, d_cm)
    phi_mn_centro = _phi_mn_kNm(sel_centro["as_prov_cm2"], fc, fy, b_cm, d_cm)

    # Cortante — dos condiciones
    vu_vc = max(envelope_shear_vc.v_at_left_support(), envelope_shear_vc.v_at_right_support())
    shear_vc = _design_shear_from_vu(vu_vc, fc, fy, b_cm, d_cm, h_cm, length_m, ductility)

    shear_vcap = None
    if envelope_shear_vcap is not None and len(envelope_shear_vcap.points) > 0:
        vu_vcap = max(
            envelope_shear_vcap.v_at_left_support(),
            envelope_shear_vcap.v_at_right_support(),
        )
        shear_vcap = _design_shear_from_vu(
            vu_vcap, fc, fy, b_cm, d_cm, h_cm, length_m, ductility
        )

    # Chequeo adicional NSR-10 DES: cortante probable Mpr-based
    shear_mpr = None
    if ductility == "DES":
        # Mpr ≈ 1.25·fy → equivale a aumentar fy en factor 1.25
        as_prov_top = sel_apoyo["as_prov_cm2"]
        mpr_kNm = _phi_mn_kNm(as_prov_top, fc, fy * 1.25, b_cm, d_cm) / 0.90  # sin phi
        # V capacidad = (Mpr_left + Mpr_right) / Ln  (sismo + gravitacional)
        wu_grav_approx = 1.2 * (
            b_m * h_m * CONCRETE_DENSITY_KG_M3 * GRAVITY / 1000.0
        ) + 1.0 * 2.0  # 2.0 kN/m² CV simplificado
        v_cap_mpr = 2.0 * mpr_kNm / max(length_m, 0.01) + wu_grav_approx * length_m / 2.0
        shear_mpr = _design_shear_from_vu(
            v_cap_mpr, fc, fy, b_cm, d_cm, h_cm, length_m, ductility
        )
        shear_mpr["mpr_kNm"] = round(mpr_kNm, 2)
        shear_mpr["v_cap_mpr_kN"] = round(v_cap_mpr, 2)

    # Gobierna el envolvente de los chequeos de cortante
    candidates = [shear_vc]
    if shear_vcap is not None:
        candidates.append(shear_vcap)
    if shear_mpr is not None:
        candidates.append(shear_mpr)
    gov_idx = max(range(len(candidates)), key=lambda i: candidates[i]["vu_support_kN"])
    gov_label = ["vc", "vcap", "mpr"][: len(candidates)][gov_idx]
    shear_gov = candidates[gov_idx]

    warnings: list[str] = []
    if math.isinf(as_req_apoyo) or math.isinf(as_req_centro):
        warnings.append("Sección insuficiente a flexión; aumentar b o h.")
    if as_req_apoyo > as_max:
        warnings.append(f"As_req apoyo ({as_req_apoyo:.2f} cm²) excede As_max.")
    if as_req_centro > as_max:
        warnings.append(f"As_req centro ({as_req_centro:.2f} cm²) excede As_max.")
    if phi_mn_apoyo < mu_apoyo:
        warnings.append(
            f"φMn apoyo ({phi_mn_apoyo:.2f}) < Mu ({mu_apoyo:.2f}). Reforzar."
        )
    if phi_mn_centro < mu_pos_center:
        warnings.append(
            f"φMn centro ({phi_mn_centro:.2f}) < Mu ({mu_pos_center:.2f}). Reforzar."
        )
    if shear_gov["needs_stirrups"] and not shear_gov["stirrup"]["ok"]:
        warnings.append(
            f"φVn ({shear_gov['stirrup']['phi_vn_kN']:.2f}) < Vu ({shear_gov['vu_at_d_kN']:.2f})."
        )

    return {
        "element_id": str(element.id),
        "tag": element.tag,
        "ok": not warnings,
        "source": "envelope",
        "geom": {
            "b_cm": round(b_cm, 1),
            "h_cm": round(h_cm, 1),
            "d_cm": round(d_cm, 1),
            "length_m": round(length_m, 3),
        },
        "section_name": sec.name,
        "demands": {
            "mu_apoyo_kNm": round(mu_apoyo, 2),
            "mu_neg_left_kNm": round(mu_neg_left, 2),
            "mu_neg_right_kNm": round(mu_neg_right, 2),
            "mu_pos_center_kNm": round(mu_pos_center, 2),
            "vu_vc_kN": round(vu_vc, 2),
            "vu_vcap_kN": round(shear_vcap["vu_support_kN"], 2) if shear_vcap else None,
            "vu_mpr_kN": round(shear_mpr["v_cap_mpr_kN"], 2) if shear_mpr else None,
        },
        "capacity": {
            "as_min_cm2": round(as_min, 3),
            "as_max_cm2": round(as_max, 3),
            "as_req_apoyo_cm2": None if math.isinf(as_req_apoyo) else round(as_req_apoyo, 3),
            "as_req_centro_cm2": None if math.isinf(as_req_centro) else round(as_req_centro, 3),
            "bar_apoyo": sel_apoyo,
            "bar_centro": sel_centro,
            "phi_mn_apoyo_kNm": round(phi_mn_apoyo, 2),
            "phi_mn_centro_kNm": round(phi_mn_centro, 2),
        },
        "shear": {
            "governing": gov_label,
            "vc": shear_vc,
            "vcap": shear_vcap,
            "mpr": shear_mpr,
        },
        "diagrams": {
            "flex": envelope_series(envelope_flex),
            "shear_vc": envelope_series(envelope_shear_vc),
            "shear_vcap": envelope_series(envelope_shear_vcap) if envelope_shear_vcap else None,
        },
        "combos": {
            "flex": envelope_flex.combos,
            "shear_vc": envelope_shear_vc.combos,
            "shear_vcap": envelope_shear_vcap.combos if envelope_shear_vcap else None,
        },
        "warnings": warnings,
    }


def _section_dims_cm(element: Element, db: Session) -> tuple[float, float] | None:
    sec = db.get(Section, element.section_id) if element.section_id else None
    if not sec or not sec.params:
        return None
    b_m = float(sec.params.get("b_m") or sec.params.get("B") or sec.params.get("base") or 0.0)
    h_m = float(sec.params.get("h_m") or sec.params.get("D") or sec.params.get("depth") or 0.0)
    if b_m <= 0 or h_m <= 0:
        return None
    return b_m * 100.0, h_m * 100.0


def _slice_envelope_window(
    env: GroupEnvelope, start_m: float, end_m: float
) -> tuple[float, float, float]:
    """Devuelve (M_pos_max, |M_neg|_max, V_max) en la ventana [start_m, end_m]."""
    mp_max = 0.0
    mn_max_abs = 0.0
    v_max = 0.0
    for i, s in enumerate(env.stations_m):
        if s < start_m - 1e-6 or s > end_m + 1e-6:
            continue
        if env.m_pos_kNm[i] > mp_max:
            mp_max = env.m_pos_kNm[i]
        if abs(env.m_neg_kNm[i]) > mn_max_abs:
            mn_max_abs = abs(env.m_neg_kNm[i])
        if env.v_abs_kN[i] > v_max:
            v_max = env.v_abs_kN[i]
    return mp_max, mn_max_abs, v_max


def _design_group(
    db: Session,
    group: BeamGroup,
    config: dict,
    env_flex: GroupEnvelope,
    env_shear_vc: GroupEnvelope,
    env_shear_vcap: GroupEnvelope | None,
) -> dict:
    """Diseña una viga continua (varios tramos colineales) como una unidad.

    - Zonas de flexión: para cada tramo interno hay dos apoyos (izq, der) y
      un centro. En apoyos domina M⁻, en centro M⁺.
    - Cortante: tomamos el pico global de Vu en el grupo (gobierna la zona
      confinada cerca del apoyo más cargado) + Vcap/Mpr.
    - Refuerzo corrido recomendado: envolvente máxima de As entre todas las
      zonas de centro (bottom) y entre todas las zonas de apoyo (top).
    """
    fc = float(config.get("fc_mpa", 21.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 40.0))
    ductility = str(config.get("ductility", "DMO"))

    # Dimensiones: toma la sección del primer elemento (asumimos sección uniforme en grupo)
    first_elem = db.get(Element, group.elements[0].element_id) if group.elements else None
    dims = _section_dims_cm(first_elem, db) if first_elem else None
    if dims is None:
        return {"group_id": group.id, "ok": False, "error": "sin sección válida en el grupo"}
    b_cm, h_cm = dims
    d_cm = h_cm - cover_mm / 10.0 - 1.0

    as_min = _as_min_cm2(fc, fy, b_cm, d_cm)
    as_max = _rho_max(fc, fy) * b_cm * d_cm

    # Zonas = cada tramo del grupo. Soportes = extremos del tramo.
    zones: list[dict] = []
    span_results: list[dict] = []
    as_top_max = 0.0
    as_bot_max = 0.0
    warnings_group: list[str] = []

    for idx, eg in enumerate(group.elements):
        start = eg.offset_m
        end = eg.offset_m + eg.length_m
        mid_l = start + eg.length_m / 3.0
        mid_r = start + 2.0 * eg.length_m / 3.0

        # Flexión por zona
        # Apoyo izquierdo: ventana cercana al soporte izquierdo del tramo
        _, mn_left_abs, _ = _slice_envelope_window(env_flex, start, start + 0.5)
        _, mn_right_abs, _ = _slice_envelope_window(env_flex, end - 0.5, end)
        # Centro: tercio central
        mp_center, _, _ = _slice_envelope_window(env_flex, mid_l, mid_r)
        # Si no hay demandas (puntos escasos) toma el mejor disponible en el tramo
        if mn_left_abs == 0.0 and mn_right_abs == 0.0 and mp_center == 0.0:
            mp_center, mn_both_abs, _ = _slice_envelope_window(env_flex, start, end)
            mn_left_abs = mn_right_abs = mn_both_abs

        mu_apoyo = max(mn_left_abs, mn_right_abs)
        as_req_apoyo = _as_req_cm2(mu_apoyo, fc, fy, b_cm, d_cm)
        as_req_centro = _as_req_cm2(mp_center, fc, fy, b_cm, d_cm)

        sel_apoyo = _select_bars(as_req_apoyo, as_min)
        sel_centro = _select_bars(as_req_centro, as_min)
        phi_mn_apoyo = _phi_mn_kNm(sel_apoyo["as_prov_cm2"], fc, fy, b_cm, d_cm)
        phi_mn_centro = _phi_mn_kNm(sel_centro["as_prov_cm2"], fc, fy, b_cm, d_cm)

        as_top_max = max(as_top_max, sel_apoyo["as_prov_cm2"])
        as_bot_max = max(as_bot_max, sel_centro["as_prov_cm2"])

        # Cortante por tramo
        _, _, vu_vc_span = _slice_envelope_window(env_shear_vc, start, end)
        vu_vcap_span = 0.0
        if env_shear_vcap is not None:
            _, _, vu_vcap_span = _slice_envelope_window(env_shear_vcap, start, end)

        shear_vc = _design_shear_from_vu(vu_vc_span, fc, fy, b_cm, d_cm, h_cm, eg.length_m, ductility)
        shear_vcap_r = (
            _design_shear_from_vu(vu_vcap_span, fc, fy, b_cm, d_cm, h_cm, eg.length_m, ductility)
            if env_shear_vcap is not None and vu_vcap_span > 0
            else None
        )

        shear_mpr_r = None
        if ductility == "DES":
            mpr_kNm = _phi_mn_kNm(sel_apoyo["as_prov_cm2"], fc, fy * 1.25, b_cm, d_cm) / 0.90
            wu_grav_approx = 1.2 * (b_cm / 100.0 * h_cm / 100.0 * CONCRETE_DENSITY_KG_M3 * GRAVITY / 1000.0) + 2.0
            v_cap_mpr = 2.0 * mpr_kNm / max(eg.length_m, 0.01) + wu_grav_approx * eg.length_m / 2.0
            shear_mpr_r = _design_shear_from_vu(v_cap_mpr, fc, fy, b_cm, d_cm, h_cm, eg.length_m, ductility)
            shear_mpr_r["mpr_kNm"] = round(mpr_kNm, 2)
            shear_mpr_r["v_cap_mpr_kN"] = round(v_cap_mpr, 2)

        candidates = [shear_vc]
        if shear_vcap_r is not None:
            candidates.append(shear_vcap_r)
        if shear_mpr_r is not None:
            candidates.append(shear_mpr_r)
        gov_idx = max(range(len(candidates)), key=lambda i: candidates[i]["vu_support_kN"])
        gov_label = ["vc", "vcap", "mpr"][: len(candidates)][gov_idx]
        shear_gov = candidates[gov_idx]

        span_warnings: list[str] = []
        if math.isinf(as_req_apoyo) or math.isinf(as_req_centro):
            span_warnings.append(f"T{idx + 1}: sección insuficiente.")
        if phi_mn_apoyo < mu_apoyo:
            span_warnings.append(
                f"T{idx + 1}: φMn⁻ {phi_mn_apoyo:.1f} < Mu⁻ {mu_apoyo:.1f} kN·m."
            )
        if phi_mn_centro < mp_center:
            span_warnings.append(
                f"T{idx + 1}: φMn⁺ {phi_mn_centro:.1f} < Mu⁺ {mp_center:.1f} kN·m."
            )
        if shear_gov["needs_stirrups"] and not shear_gov["stirrup"]["ok"]:
            span_warnings.append(
                f"T{idx + 1}: φVn insuficiente ({shear_gov['stirrup']['phi_vn_kN']:.1f} < {shear_gov['vu_at_d_kN']:.1f})."
            )

        warnings_group.extend(span_warnings)

        span_results.append({
            "span_index": idx,
            "element_id": str(eg.element_id),
            "tag": eg.tag,
            "offset_m": round(eg.offset_m, 3),
            "length_m": round(eg.length_m, 3),
            "flipped": eg.flipped,
            "mu_neg_left_kNm": round(mn_left_abs, 2),
            "mu_neg_right_kNm": round(mn_right_abs, 2),
            "mu_pos_center_kNm": round(mp_center, 2),
            "mu_apoyo_kNm": round(mu_apoyo, 2),
            "as_req_apoyo_cm2": None if math.isinf(as_req_apoyo) else round(as_req_apoyo, 3),
            "as_req_centro_cm2": None if math.isinf(as_req_centro) else round(as_req_centro, 3),
            "bar_apoyo": sel_apoyo,
            "bar_centro": sel_centro,
            "phi_mn_apoyo_kNm": round(phi_mn_apoyo, 2),
            "phi_mn_centro_kNm": round(phi_mn_centro, 2),
            "shear": {
                "governing": gov_label,
                "vc": shear_vc,
                "vcap": shear_vcap_r,
                "mpr": shear_mpr_r,
            },
            "warnings": span_warnings,
        })

    # Refuerzo corrido propuesto (envolvente de As_prov entre tramos)
    continuous_top = _select_bars(as_top_max, as_min)
    continuous_bot = _select_bars(as_bot_max, as_min)

    result: dict = {
        "group_id": group.id,
        "ok": not warnings_group,
        "level_id": str(group.level_id) if group.level_id else None,
        "origin": [round(group.origin[0], 3), round(group.origin[1], 3), round(group.origin[2], 3)],
        "direction": [round(group.direction[0], 4), round(group.direction[1], 4), round(group.direction[2], 4)],
        "total_length_m": round(group.total_length_m, 3),
        "n_spans": len(group.elements),
        "supports_m": [round(s, 3) for s in group.supports_m],
        "section": {
            "b_cm": round(b_cm, 1),
            "h_cm": round(h_cm, 1),
            "d_cm": round(d_cm, 1),
        },
        "capacity_envelope": {
            "as_top_max_cm2": round(as_top_max, 3),
            "as_bot_max_cm2": round(as_bot_max, 3),
            "continuous_top_proposal": continuous_top,
            "continuous_bot_proposal": continuous_bot,
            "as_min_cm2": round(as_min, 3),
            "as_max_cm2": round(as_max, 3),
        },
        "spans": span_results,
        "diagrams": {
            "stations_m": env_flex.stations_m,
            "m_pos_kNm": env_flex.m_pos_kNm,
            "m_neg_kNm": env_flex.m_neg_kNm,
            "v_abs_kN_vc": env_shear_vc.v_abs_kN,
            "stations_m_vc": env_shear_vc.stations_m,
            "v_abs_kN_vcap": env_shear_vcap.v_abs_kN if env_shear_vcap else None,
            "stations_m_vcap": env_shear_vcap.stations_m if env_shear_vcap else None,
            "supports_m": [round(s, 3) for s in group.supports_m],
        },
        "warnings": warnings_group,
    }

    # ── Despiece longitudinal (NSR-10): corridas + bastones + ganchos + traslapos
    try:
        layout = compute_layout(result, config)
        result["layout"] = layout_to_dict(layout)
        if layout.warnings:
            result["warnings"].extend(layout.warnings)
    except Exception as exc:
        result["layout_error"] = f"Error en despiece: {exc}"

    return result


def _design_single_element(
    db: Session,
    element: Element,
    config: dict,
) -> dict:
    """Diseña una viga (un solo span) con heurística NSR-10 simplificada."""
    fc = float(config.get("fc_mpa", 21.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 40.0))
    live_load_kN_m2 = float(config.get("live_load_kN_m2", 2.0))  # servicio
    dead_extra_kN_m2 = float(config.get("dead_extra_kN_m2", 1.5))  # acabados
    tributary_width_m = float(config.get("tributary_width_m", 1.0))

    # Geometría del elemento
    ni = db.get(Node, element.node_i_id) if element.node_i_id else None
    nj = db.get(Node, element.node_j_id) if element.node_j_id else None
    if not ni or not nj:
        return {"element_id": str(element.id), "ok": False, "error": "nodos no encontrados"}
    dx = nj.x - ni.x
    dy = nj.y - ni.y
    dz = nj.z - ni.z
    length_m = math.sqrt(dx * dx + dy * dy + dz * dz)

    # Sección: b_m, h_m desde params
    sec = db.get(Section, element.section_id) if element.section_id else None
    if not sec or not sec.params:
        return {"element_id": str(element.id), "ok": False, "error": "sin sección asignada"}
    b_m = float(sec.params.get("b_m") or sec.params.get("B") or sec.params.get("base") or 0.0)
    h_m = float(sec.params.get("h_m") or sec.params.get("D") or sec.params.get("depth") or 0.0)
    if b_m <= 0 or h_m <= 0:
        return {"element_id": str(element.id), "ok": False, "error": "sección sin dimensiones"}
    b_cm = b_m * 100.0
    h_cm = h_m * 100.0
    d_cm = h_cm - cover_mm / 10.0 - 1.0  # cover + ~1 cm (barra+estribo)

    # Cargas de servicio → mayoradas (1.2 D + 1.6 L, NSR-10 C.9.2.1)
    self_weight_kN_m = b_m * h_m * CONCRETE_DENSITY_KG_M3 * GRAVITY / 1000.0
    dead_kN_m = self_weight_kN_m + dead_extra_kN_m2 * tributary_width_m
    live_kN_m = live_load_kN_m2 * tributary_width_m
    wu_kN_m = 1.2 * dead_kN_m + 1.6 * live_kN_m

    # Momentos estimados (viga continua ACI/NSR-10 coeficientes, C.8.3.3 simplificado)
    mu_apoyo = wu_kN_m * length_m * length_m / 10.0  # negativo en apoyo
    mu_centro = wu_kN_m * length_m * length_m / 14.0

    # As requeridos
    as_min = _as_min_cm2(fc, fy, b_cm, d_cm)
    as_max = _rho_max(fc, fy) * b_cm * d_cm

    as_req_apoyo = _as_req_cm2(mu_apoyo, fc, fy, b_cm, d_cm)
    as_req_centro = _as_req_cm2(mu_centro, fc, fy, b_cm, d_cm)

    sel_apoyo = _select_bars(as_req_apoyo, as_min)
    sel_centro = _select_bars(as_req_centro, as_min)

    phi_mn_apoyo = _phi_mn_kNm(sel_apoyo["as_prov_cm2"], fc, fy, b_cm, d_cm)
    phi_mn_centro = _phi_mn_kNm(sel_centro["as_prov_cm2"], fc, fy, b_cm, d_cm)

    # Cortante y estribos
    ductility = str(config.get("ductility", "DMO"))
    shear = _design_shear(wu_kN_m, length_m, fc, fy, b_cm, d_cm, h_cm, ductility)

    warnings = []
    if math.isinf(as_req_apoyo) or math.isinf(as_req_centro):
        warnings.append("Sección insuficiente a flexión; aumentar b o h.")
    if as_req_apoyo > as_max:
        warnings.append(f"As_req apoyo ({as_req_apoyo:.2f} cm²) excede As_max ({as_max:.2f} cm²).")
    if as_req_centro > as_max:
        warnings.append(f"As_req centro ({as_req_centro:.2f} cm²) excede As_max ({as_max:.2f} cm²).")
    if phi_mn_apoyo < mu_apoyo:
        warnings.append(f"φMn apoyo ({phi_mn_apoyo:.2f}) < Mu ({mu_apoyo:.2f}). Revisar.")
    if phi_mn_centro < mu_centro:
        warnings.append(f"φMn centro ({phi_mn_centro:.2f}) < Mu ({mu_centro:.2f}). Revisar.")
    if shear["needs_stirrups"] and not shear["stirrup"]["ok"]:
        warnings.append(
            f"φVn ({shear['stirrup']['phi_vn_kN']:.2f}) < Vu ({shear['vu_at_d_kN']:.2f}). Reforzar estribos o aumentar seccion."
        )

    return {
        "element_id": str(element.id),
        "tag": element.tag,
        "ok": not warnings,
        "geom": {
            "b_cm": round(b_cm, 1),
            "h_cm": round(h_cm, 1),
            "d_cm": round(d_cm, 1),
            "length_m": round(length_m, 3),
        },
        "section_name": sec.name,
        "loads": {
            "self_weight_kN_m": round(self_weight_kN_m, 3),
            "dead_total_kN_m": round(dead_kN_m, 3),
            "live_kN_m": round(live_kN_m, 3),
            "wu_kN_m": round(wu_kN_m, 3),
        },
        "demands": {
            "mu_apoyo_kNm": round(mu_apoyo, 2),
            "mu_centro_kNm": round(mu_centro, 2),
        },
        "capacity": {
            "as_min_cm2": round(as_min, 3),
            "as_max_cm2": round(as_max, 3),
            "as_req_apoyo_cm2": None if math.isinf(as_req_apoyo) else round(as_req_apoyo, 3),
            "as_req_centro_cm2": None if math.isinf(as_req_centro) else round(as_req_centro, 3),
            "bar_apoyo": sel_apoyo,
            "bar_centro": sel_centro,
            "phi_mn_apoyo_kNm": round(phi_mn_apoyo, 2),
            "phi_mn_centro_kNm": round(phi_mn_centro, 2),
        },
        "shear": shear,
        "warnings": warnings,
    }


def _run_design(db: Session, design: BeamDesign) -> dict:
    elements: list[Element] = []
    for eid in design.element_ids:
        try:
            e = db.get(Element, UUID(str(eid)))
            if e is not None:
                elements.append(e)
        except (ValueError, TypeError):
            continue
    if not elements:
        return {"ok": False, "error": "Sin elementos válidos en el diseño", "elements": []}

    cfg = design.config or {}
    use_forces = bool(cfg.get("use_forces", False))
    combo_flex = [c.strip() for c in (cfg.get("combo_flex") or []) if c and c.strip()]
    combo_shear_vc = [c.strip() for c in (cfg.get("combo_shear_vc") or []) if c and c.strip()]
    combo_shear_vcap = [c.strip() for c in (cfg.get("combo_shear_vcap") or []) if c and c.strip()]

    rev_id = elements[0].building_revision_id

    # ── Modo envolvente real: agrupar y diseñar por BeamGroup ──────────────
    if use_forces and combo_flex:
        element_ids = [e.id for e in elements]
        level_id = elements[0].level_id
        groups = group_beams(db, element_ids, level_id)

        group_results: list[dict] = []
        for grp in groups:
            env_flex = compute_group_envelope(db, rev_id, grp.elements, combo_flex)
            if not env_flex.stations_m:
                # Sin demandas para este grupo; marcar y seguir
                group_results.append({
                    "group_id": grp.id,
                    "ok": False,
                    "error": "Sin demandas cargadas para los tramos del grupo",
                    "level_id": str(grp.level_id) if grp.level_id else None,
                    "total_length_m": round(grp.total_length_m, 3),
                    "n_spans": len(grp.elements),
                    "spans": [{"tag": eg.tag, "offset_m": eg.offset_m, "length_m": eg.length_m} for eg in grp.elements],
                    "warnings": ["No hay registros en element_forces para los tags del grupo"],
                })
                continue
            env_shear_vc = compute_group_envelope(
                db, rev_id, grp.elements, combo_shear_vc or combo_flex
            )
            env_shear_vcap = (
                compute_group_envelope(db, rev_id, grp.elements, combo_shear_vcap)
                if combo_shear_vcap
                else None
            )
            group_results.append(
                _design_group(db, grp, cfg, env_flex, env_shear_vc, env_shear_vcap)
            )

        total_warnings = sum(len(g.get("warnings", [])) for g in group_results)
        total_groups_ok = sum(1 for g in group_results if g.get("ok"))
        total_length = sum(g.get("total_length_m", 0.0) for g in group_results)
        total_spans = sum(g.get("n_spans", 0) for g in group_results)

        return {
            "ok": total_warnings == 0,
            "config": design.config,
            "source_mode": "envelope",
            "n_elements": len(elements),
            "n_groups": len(group_results),
            "n_groups_ok": total_groups_ok,
            "n_spans": total_spans,
            "total_warnings": total_warnings,
            "total_length_m": round(total_length, 3),
            # Mantén estos para compat con la vista vieja
            "n_elements_ok": total_groups_ok,
            "total_as_top_cm2_avg": 0.0,
            "total_as_bot_cm2_avg": 0.0,
            "groups": group_results,
        }

    # ── Modo estimación: elemento por elemento con wu·L²/10 ──────────────────
    results: list[dict] = []
    for e in elements:
        r = _design_single_element(db, e, cfg)
        r["source"] = "estimated_wl2_10"
        results.append(r)

    total_warnings = sum(len(r.get("warnings", [])) for r in results)
    total_ok = sum(1 for r in results if r.get("ok"))
    total_length = sum(r.get("geom", {}).get("length_m", 0.0) for r in results)
    total_as_top_cm2 = sum(
        r.get("capacity", {}).get("bar_apoyo", {}).get("as_prov_cm2", 0.0) or 0.0
        for r in results
    )
    total_as_bot_cm2 = sum(
        r.get("capacity", {}).get("bar_centro", {}).get("as_prov_cm2", 0.0) or 0.0
        for r in results
    )

    return {
        "ok": total_warnings == 0,
        "config": design.config,
        "source_mode": "estimated_wl2_10",
        "n_elements": len(elements),
        "n_elements_ok": total_ok,
        "total_warnings": total_warnings,
        "total_length_m": round(total_length, 3),
        "total_as_top_cm2_avg": round(total_as_top_cm2 / max(len(elements), 1), 3),
        "total_as_bot_cm2_avg": round(total_as_bot_cm2 / max(len(elements), 1), 3),
        "elements": results,
    }


@app.task(name="civilcode_worker.tasks.design.run_beam_design", bind=True)
def run_beam_design(self: Task, design_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        d_uuid = UUID(design_id)
        design = db.execute(select(BeamDesign).where(BeamDesign.id == d_uuid)).scalar_one_or_none()
        if design is None:
            raise RuntimeError(f"BeamDesign {design_id} not found")

        design.status = "running"
        design.started_at = datetime.now(UTC)
        db.commit()

        summary = _run_design(db, design)

        design.status = "completed" if summary.get("ok") else "completed_with_warnings"
        design.completed_at = datetime.now(UTC)
        design.result_summary = summary
        design.log = None
        db.commit()
        return {"status": design.status, **{k: v for k, v in summary.items() if k != "elements"}}
    except Exception as exc:
        tb = traceback.format_exc()
        try:
            design = db.execute(select(BeamDesign).where(BeamDesign.id == UUID(design_id))).scalar_one_or_none()
            if design is not None:
                design.status = "failed"
                design.completed_at = datetime.now(UTC)
                design.log = tb
                db.commit()
        except Exception:
            db.rollback()
        raise RuntimeError(f"{exc}\n{tb}") from exc
    finally:
        db.close()
