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

    results = [_design_single_element(db, e, design.config) for e in elements]
    total_warnings = sum(len(r.get("warnings", [])) for r in results)
    total_ok = sum(1 for r in results if r.get("ok"))

    # Agregados
    total_length = sum(r.get("geom", {}).get("length_m", 0.0) for r in results)
    total_as_top_cm2 = sum(r.get("capacity", {}).get("bar_apoyo", {}).get("as_prov_cm2", 0.0) or 0.0 for r in results)
    total_as_bot_cm2 = sum(r.get("capacity", {}).get("bar_centro", {}).get("as_prov_cm2", 0.0) or 0.0 for r in results)

    return {
        "ok": total_warnings == 0,
        "config": design.config,
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
