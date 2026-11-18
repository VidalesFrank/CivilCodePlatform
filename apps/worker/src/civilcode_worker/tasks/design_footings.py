"""Task Celery — design_footings.run_footing_design

Diseño simplificado de zapatas aisladas NSR-10 (C.15, C.22.6):

Pipeline:
1. Predimensionado L×B iterativo hasta q_max ≤ q_adm y q_min ≥ 0.
2. Peralte d por punzonamiento (two-way) + chequeo one-way.
3. Flexión en cara de columna por dirección → As requerido.

Aproximaciones:
- Zapata cuadrada (L = B) salvo que config.rectangular = True.
- Carga uniforme (Pu / (L*B)) para flexión (sin considerar excentricidad en esta pasada).
- As_min por retracción: ρ = 0.0018 para fy = 420 MPa (C.7.6.1).
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
from civilcode_api.models.element import Element
from civilcode_api.models.footing_design import FootingDesign
from civilcode_api.models.section import Section

from ..celery_app import app
from ._rc_helpers import (
    PHI_FLEX,
    PHI_SHEAR,
    as_req_flex_cm2,
    bar_area_cm2,
    select_longitudinal_bars,
)


def _sync_session_factory() -> sessionmaker[Session]:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("+psycopg", "")
    engine = create_engine(sync_url, future=True)
    return sessionmaker(engine, expire_on_commit=False, future=True)


def _two_way_vc_kN(fc_mpa: float, bo_cm: float, d_cm: float, beta: float = 1.0) -> float:
    """Vc punzonamiento = min(0.33, 0.17(1+2/β))·√fc·bo·d, en kN.

    (Simplificado; la 3ra expresión αs·d/bo+2 se omite por conservación.)
    """
    f1 = 0.33
    f2 = 0.17 * (1.0 + 2.0 / max(beta, 1.0))
    factor = min(f1, f2)
    vc_N = factor * math.sqrt(fc_mpa) * (bo_cm * 10.0) * (d_cm * 10.0)
    return vc_N / 1000.0


def _one_way_vc_kN(fc_mpa: float, b_cm: float, d_cm: float) -> float:
    vc_N = 0.17 * math.sqrt(fc_mpa) * (b_cm * 10.0) * (d_cm * 10.0)
    return vc_N / 1000.0


def _design_single_footing(db: Session, element: Element, config: dict) -> dict:
    fc = float(config.get("fc_mpa", 21.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 75.0))  # contacto suelo
    Pu = float(config.get("Pu_kN", 800.0))
    P_serv = float(config.get("P_serv_kN", Pu / 1.4))
    q_adm_kPa = float(config.get("q_adm_kPa", 150.0))
    gamma_soil = float(config.get("gamma_soil_kN_m3", 18.0))
    overburden_depth_m = float(config.get("overburden_depth_m", 1.0))

    # Dimensiones columna (asumimos cuadrada si no se da)
    bc_cm = float(config.get("bc_cm", 40.0))
    hc_cm = float(config.get("hc_cm", bc_cm))

    # Geometría del elemento soporte (si existe)
    sec = db.get(Section, element.section_id) if element.section_id else None
    if sec and sec.params:
        b_m = float(sec.params.get("b_m") or sec.params.get("B") or 0.0)
        h_m = float(sec.params.get("h_m") or sec.params.get("D") or 0.0)
        if b_m > 0 and h_m > 0:
            bc_cm = b_m * 100.0
            hc_cm = h_m * 100.0

    # Carga de sobrepeso de suelo (service) para q_adm neta
    q_sobre = gamma_soil * overburden_depth_m  # kPa
    q_adm_net = q_adm_kPa - q_sobre

    # Predimensionado iterativo (cuadrada)
    A_req_m2 = P_serv / max(q_adm_net, 1.0)  # m²
    L_m = math.sqrt(A_req_m2)
    # Redondear a múltiplo de 0.05 m (5 cm)
    L_m = math.ceil(L_m / 0.05) * 0.05
    B_m = L_m
    L_cm = L_m * 100.0
    B_cm = B_m * 100.0

    # Tantear peralte (h_cm): iniciar con h = max(L_cm/10, 30)
    h_cm = max(L_cm / 10.0, 30.0)
    d_cm = h_cm - cover_mm / 10.0 - 1.6  # cover + 2×db/2

    # Carga mayorada uniforme
    qu_kPa = Pu / (L_m * B_m)  # kN/m²

    # Punzonamiento (two-way)
    bo_cm = 2.0 * (bc_cm + d_cm) + 2.0 * (hc_cm + d_cm)
    beta = max(bc_cm, hc_cm) / min(bc_cm, hc_cm)
    phi_Vc_punz = PHI_SHEAR * _two_way_vc_kN(fc, bo_cm, d_cm, beta)
    # Vu punzonamiento = qu * (A_zap − A_punch_section)
    A_zap_m2 = L_m * B_m
    A_punch_m2 = ((bc_cm + d_cm) / 100.0) * ((hc_cm + d_cm) / 100.0)
    Vu_punz = qu_kPa * max(A_zap_m2 - A_punch_m2, 0.0)

    # Iterar peralte si no cumple punzonamiento (hasta 5 iter)
    iters = 0
    while Vu_punz > phi_Vc_punz and iters < 5:
        h_cm += 5.0
        d_cm = h_cm - cover_mm / 10.0 - 1.6
        bo_cm = 2.0 * (bc_cm + d_cm) + 2.0 * (hc_cm + d_cm)
        phi_Vc_punz = PHI_SHEAR * _two_way_vc_kN(fc, bo_cm, d_cm, beta)
        A_punch_m2 = ((bc_cm + d_cm) / 100.0) * ((hc_cm + d_cm) / 100.0)
        Vu_punz = qu_kPa * max(A_zap_m2 - A_punch_m2, 0.0)
        iters += 1

    # One-way shear en dirección X (sección crítica a d de cara columna)
    c_x = (L_cm - bc_cm) / 2.0  # voladizo en X
    c_y = (B_cm - hc_cm) / 2.0
    phi_Vc_1w = PHI_SHEAR * _one_way_vc_kN(fc, B_cm, d_cm)
    Vu_1w = qu_kPa * B_m * max(c_x / 100.0 - d_cm / 100.0, 0.0)

    # Flexión en cara de columna (por dirección)
    Mu_x = qu_kPa * B_m * (c_x / 100.0) ** 2 / 2.0  # kN·m
    Mu_y = qu_kPa * L_m * (c_y / 100.0) ** 2 / 2.0
    # Diseño por metro de ancho; usamos B_cm y L_cm como ancho total
    As_x = as_req_flex_cm2(Mu_x, fc, fy, B_cm, d_cm)
    As_y = as_req_flex_cm2(Mu_y, fc, fy, L_cm, d_cm)
    # As_min retracción
    rho_min = 0.0018 if fy >= 420 else 0.0020
    As_min_x = rho_min * B_cm * h_cm
    As_min_y = rho_min * L_cm * h_cm
    bar_x = select_longitudinal_bars(As_x, As_min_x)
    bar_y = select_longitudinal_bars(As_y, As_min_y)

    # Spacing para repartir bar_x.n sobre B_cm
    def _spacing_cm(n_bars: int, width_cm: float, cover_cm: float = 7.5) -> float:
        if n_bars <= 1:
            return 0.0
        return (width_cm - 2 * cover_cm) / (n_bars - 1)

    s_x_cm = _spacing_cm(int(bar_x["n"]), B_cm)
    s_y_cm = _spacing_cm(int(bar_y["n"]), L_cm)

    warnings: list[str] = []
    # Soil pressure sanity (center + eccentric = 0 for axial only)
    q_max = qu_kPa
    q_min = qu_kPa
    if q_max > q_adm_kPa:
        warnings.append(f"q_max = {q_max:.1f} kPa > q_adm = {q_adm_kPa:.1f} kPa.")
    if phi_Vc_punz < Vu_punz:
        warnings.append(
            f"φVc punzonamiento ({phi_Vc_punz:.1f} kN) < Vu ({Vu_punz:.1f} kN) aun con h={h_cm:.0f} cm."
        )
    if phi_Vc_1w < Vu_1w:
        warnings.append(f"φVc one-way ({phi_Vc_1w:.1f} kN) < Vu ({Vu_1w:.1f} kN).")
    if not math.isfinite(As_x) or not math.isfinite(As_y):
        warnings.append("Flexión excede capacidad; aumentar h.")
    if iters >= 5:
        warnings.append(f"Peralte no converge para punzonamiento tras {iters} iter.")

    return {
        "element_id": str(element.id),
        "tag": element.tag,
        "ok": not warnings,
        "geom": {
            "L_cm": round(L_cm, 1),
            "B_cm": round(B_cm, 1),
            "h_cm": round(h_cm, 1),
            "d_cm": round(d_cm, 1),
            "bc_cm": round(bc_cm, 1),
            "hc_cm": round(hc_cm, 1),
        },
        "soil": {
            "q_adm_kPa": round(q_adm_kPa, 2),
            "q_adm_net_kPa": round(q_adm_net, 2),
            "qu_kPa": round(qu_kPa, 2),
            "q_max_kPa": round(q_max, 2),
            "q_min_kPa": round(q_min, 2),
        },
        "punching": {
            "bo_cm": round(bo_cm, 1),
            "beta": round(beta, 3),
            "phi_Vc_kN": round(phi_Vc_punz, 2),
            "Vu_kN": round(Vu_punz, 2),
            "ok": phi_Vc_punz >= Vu_punz,
            "iterations": iters,
        },
        "one_way": {
            "phi_Vc_kN": round(phi_Vc_1w, 2),
            "Vu_kN": round(Vu_1w, 2),
            "ok": phi_Vc_1w >= Vu_1w,
        },
        "flexure": {
            "Mu_x_kNm": round(Mu_x, 2),
            "Mu_y_kNm": round(Mu_y, 2),
            "As_x_cm2": None if not math.isfinite(As_x) else round(As_x, 3),
            "As_y_cm2": None if not math.isfinite(As_y) else round(As_y, 3),
            "As_min_x_cm2": round(As_min_x, 3),
            "As_min_y_cm2": round(As_min_y, 3),
            "bar_x": bar_x,
            "bar_y": bar_y,
            "spacing_x_cm": round(s_x_cm, 1),
            "spacing_y_cm": round(s_y_cm, 1),
        },
        "warnings": warnings,
    }


def _run_design(db: Session, design: FootingDesign) -> dict:
    elements: list[Element] = []
    for eid in design.element_ids:
        try:
            e = db.get(Element, UUID(str(eid)))
            if e is not None:
                elements.append(e)
        except (ValueError, TypeError):
            continue
    if not elements:
        return {"ok": False, "error": "Sin elementos válidos", "elements": []}
    results = [_design_single_footing(db, e, design.config) for e in elements]
    total_warnings = sum(len(r.get("warnings", [])) for r in results)
    total_ok = sum(1 for r in results if r.get("ok"))
    return {
        "ok": total_warnings == 0,
        "config": design.config,
        "n_elements": len(elements),
        "n_elements_ok": total_ok,
        "total_warnings": total_warnings,
        "elements": results,
    }


@app.task(name="civilcode_worker.tasks.design.run_footing_design", bind=True)
def run_footing_design(self: Task, design_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        d_uuid = UUID(design_id)
        design = db.execute(select(FootingDesign).where(FootingDesign.id == d_uuid)).scalar_one_or_none()
        if design is None:
            raise RuntimeError(f"FootingDesign {design_id} not found")
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
            design = db.execute(
                select(FootingDesign).where(FootingDesign.id == UUID(design_id))
            ).scalar_one_or_none()
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
