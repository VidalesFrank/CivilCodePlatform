"""Task Celery — design_columns.run_column_design

Diseño simplificado de columnas NSR-10:
- Flexo-compresión biaxial con fórmula de contorno de carga de Bresler (α=1).
- Capacidad axial pura: φPn_max = 0.80 · φ · [0.85·fc·(Ag − Ast) + fy·Ast]
  con φ = 0.65 (columnas con estribos).
- Capacidad a flexión por dirección: usando armado simétrico supuesto y
  fórmula de rectángulo equivalente (conservador; subestima Mn).
- Cortante: Vc = 0.17·√fc·b·d, confinamiento según ductilidad.
- Cuantía longitudinal: ρ entre 0.01 y 0.04 (recomendado; límite hasta 0.08 NSR-10 C.21.6.3.2).
- Estribos de confinamiento (C.21.6.4):
  * Zona lo = max(h, Ln/6, 450 mm)
  * s_o = min(6·db_long, b/4, 100 mm) para DES
  * s_o = min(8·db_long, b/4, 150 mm) para DMO

Entradas típicas (config):
- fc_mpa, fy_mpa, fys_mpa, cover_mm, ductility (DES/DMO/Ninguna)
- Pu_kN, Mux_kNm, Muy_kNm, Vu_kN (si no se pasan, se estiman por carga axial tributaria)
- tributary_area_m2, levels_count (para estimar Pu por self-weight si no se da)
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
from civilcode_api.models.column_design import ColumnDesign
from civilcode_api.models.element import Element
from civilcode_api.models.section import Section
from civilcode_api.models.structure import Node

from ..celery_app import app
from ._rc_helpers import (
    PHI_AXIAL_TIED,
    PHI_FLEX,
    PHI_SHEAR,
    REBAR_DB,
    bar_area_cm2,
    phi_mn_kNm,
    select_longitudinal_bars,
    vc_kN,
)

CONCRETE_DENSITY_KN_M3 = 24.0


def _sync_session_factory() -> sessionmaker[Session]:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("+psycopg", "")
    engine = create_engine(sync_url, future=True)
    return sessionmaker(engine, expire_on_commit=False, future=True)


def _phi_pn_max_kN(ag_cm2: float, ast_cm2: float, fc_mpa: float, fy_mpa: float) -> float:
    """φPn_max = 0.80 · φ · [0.85·fc·(Ag − Ast) + fy·Ast]  (NSR-10 C.22.4.2.2).

    Fuerzas en kN usando fc en MPa·cm² = 10·kN/cm²... ojo unidades:
    fc [MPa] = fc [N/mm²]. Ag en cm² → mm² = Ag*100. fy fy análogo.
    Pn [N] = 0.85·fc·(Ag−Ast)·100 + fy·Ast·100  → /1000 = kN
    """
    pn_N = 0.85 * fc_mpa * (ag_cm2 - ast_cm2) * 100.0 + fy_mpa * ast_cm2 * 100.0
    return 0.80 * PHI_AXIAL_TIED * pn_N / 1000.0


def _column_axial_tributary_pu_kN(
    tributary_area_m2: float,
    levels_above: int,
    dead_slab_kN_m2: float,
    live_kN_m2: float,
    self_weight_kN_m: float,
    story_height_m: float,
) -> float:
    """Estimación bruta de Pu: suma de cargas de n plantas × área aferente."""
    if tributary_area_m2 <= 0 or levels_above <= 0:
        return 0.0
    dead_total = (dead_slab_kN_m2 + 1.0) * tributary_area_m2 * levels_above
    live_total = live_kN_m2 * tributary_area_m2 * levels_above
    sw_column = self_weight_kN_m * story_height_m * levels_above
    return 1.2 * (dead_total + sw_column) + 1.6 * live_total


def _select_stirrup_spacing(
    ductility: str, h_cm: float, b_cm: float, long_bar_db_mm: float, ln_m: float
) -> dict:
    """Spacings de confinamiento según NSR-10 C.21.6.4.

    Devuelve s_conf (zona lo), s_general y lo en cm.
    """
    db_long_cm = long_bar_db_mm / 10.0
    if ductility == "DES":
        s_conf = min(6.0 * db_long_cm, b_cm / 4.0, 10.0)
        lo = max(h_cm, ln_m * 100.0 / 6.0, 45.0)
    elif ductility == "DMO":
        s_conf = min(8.0 * db_long_cm, b_cm / 4.0, 15.0)
        lo = max(h_cm, ln_m * 100.0 / 6.0, 45.0)
    else:
        s_conf = min(16.0 * db_long_cm, 48.0 * 0.95, b_cm, h_cm)
        lo = 0.0
    s_gen = min(16.0 * db_long_cm, 48.0 * 0.95, b_cm, h_cm)
    # Redondeos constructibles 2.5 cm
    s_conf = max(5.0, math.floor(s_conf / 2.5) * 2.5)
    s_gen = max(5.0, math.floor(s_gen / 2.5) * 2.5)
    return {"s_conf_cm": s_conf, "s_gen_cm": s_gen, "lo_cm": round(lo, 1)}


def _design_single_column(db: Session, element: Element, config: dict) -> dict:
    fc = float(config.get("fc_mpa", 28.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 40.0))
    ductility = str(config.get("ductility", "DMO"))
    pu_override = config.get("Pu_kN")
    mux_override = config.get("Mux_kNm")
    muy_override = config.get("Muy_kNm")
    vu_override = config.get("Vu_kN")
    rho_target = float(config.get("rho_long_target", 0.015))  # 1.5% default

    tributary_area_m2 = float(config.get("tributary_area_m2", 20.0))
    levels_above = int(config.get("levels_above", 1))
    dead_slab_kN_m2 = float(config.get("dead_slab_kN_m2", 5.0))  # losa 20cm + acabados
    live_kN_m2 = float(config.get("live_kN_m2", 2.0))

    # Geometría
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
    ag_cm2 = b_cm * h_cm
    d_cm = h_cm - cover_mm / 10.0 - 1.2  # cover + ~1.2 cm (barra+estribo)

    # Demandas
    self_weight_kN_m = b_m * h_m * CONCRETE_DENSITY_KN_M3
    pu_est = _column_axial_tributary_pu_kN(
        tributary_area_m2, levels_above, dead_slab_kN_m2, live_kN_m2,
        self_weight_kN_m, length_m,
    )
    pu = float(pu_override) if pu_override is not None else pu_est
    mux = float(mux_override) if mux_override is not None else 0.0
    muy = float(muy_override) if muy_override is not None else 0.0
    vu = float(vu_override) if vu_override is not None else pu * 0.1  # proxy conservador

    # Cuantía longitudinal propuesta → As total
    ast_target_cm2 = rho_target * ag_cm2

    # Seleccionar barras: distribución simétrica en 4 caras, min 4 barras total
    # Elegimos barra que de >= ast_target con número par y >=4
    best_bars = None
    for bar_name, db_mm in REBAR_DB:
        a = bar_area_cm2(db_mm)
        n = max(4, math.ceil(ast_target_cm2 / a))
        if n % 2 != 0:
            n += 1
        if n > 20:
            continue
        as_prov = n * a
        over = as_prov - ast_target_cm2
        rho_prov = as_prov / ag_cm2
        if rho_prov > 0.04:
            continue
        cand = {
            "bar": bar_name,
            "n": n,
            "db_mm": db_mm,
            "as_prov_cm2": round(as_prov, 3),
            "rho_prov": round(rho_prov, 4),
            "_over": over,
        }
        if best_bars is None or over < best_bars["_over"]:
            best_bars = cand

    if best_bars is None:
        # Fallback mínimo
        a = bar_area_cm2(19.05)
        best_bars = {
            "bar": "#6",
            "n": 4,
            "db_mm": 19.05,
            "as_prov_cm2": round(4 * a, 3),
            "rho_prov": round(4 * a / ag_cm2, 4),
        }
    best_bars.pop("_over", None)
    long_bars = {k: v for k, v in best_bars.items() if k != "db_mm"}
    db_long_mm = float(best_bars["db_mm"])

    as_total = float(best_bars["as_prov_cm2"])
    rho_long = as_total / ag_cm2
    rho_min_long = 0.01  # C.21.6.3.2
    rho_max_long = 0.04  # recomendado (hasta 0.08 permitido)

    # Capacidad axial
    phi_pn_max = _phi_pn_max_kN(ag_cm2, as_total, fc, fy)

    # Capacidad a flexión por dirección (como viga): mitad de As en cada cara extrema
    as_face_x_cm2 = as_total / 2.0
    as_face_y_cm2 = as_total / 2.0
    d_x = h_cm - cover_mm / 10.0 - 1.2
    d_y = b_cm - cover_mm / 10.0 - 1.2
    phi_mnx = phi_mn_kNm(as_face_x_cm2, fc, fy, b_cm, d_x)
    phi_mny = phi_mn_kNm(as_face_y_cm2, fc, fy, h_cm, d_y)

    # Chequeo Bresler α=1 (conservador); si Mux=Muy=0 solo aplica axial
    bresler = 0.0
    if phi_mnx > 0 and phi_mny > 0:
        bresler = mux / phi_mnx + muy / phi_mny
    else:
        bresler = float("inf") if (mux > 0 or muy > 0) else 0.0
    axial_util = pu / phi_pn_max if phi_pn_max > 0 else float("inf")

    # Cortante
    phi_vc = PHI_SHEAR * vc_kN(fc, b_cm, d_cm)
    # Estribo #3 doble rama en ambas direcciones
    av_cm2 = 2.0 * bar_area_cm2(9.52)
    stir = _select_stirrup_spacing(ductility, h_cm, b_cm, db_long_mm, length_m)
    vs_prov_kN = av_cm2 * (fy / 10.0) * d_cm / max(stir["s_gen_cm"], 1.0)
    phi_vn = PHI_SHEAR * (vc_kN(fc, b_cm, d_cm) + vs_prov_kN)

    warnings: list[str] = []
    if rho_long < rho_min_long:
        warnings.append(
            f"ρ_long ({rho_long:.3f}) < ρ_min ({rho_min_long}). Aumentar As."
        )
    if rho_long > rho_max_long:
        warnings.append(
            f"ρ_long ({rho_long:.3f}) > ρ_max recomendado ({rho_max_long}). Revisar sección."
        )
    if axial_util > 1.0:
        warnings.append(
            f"φPn_max ({phi_pn_max:.1f} kN) < Pu ({pu:.1f} kN). Insuficiente."
        )
    if math.isfinite(bresler) and bresler > 1.0:
        warnings.append(
            f"Bresler (Mux/φMnx + Muy/φMny = {bresler:.2f}) > 1.0. Insuficiente."
        )
    if not math.isfinite(bresler):
        warnings.append("No se puede calcular Bresler (φMn=0 en alguna dirección).")
    if phi_vn < vu:
        warnings.append(f"φVn ({phi_vn:.2f}) < Vu ({vu:.2f}). Reforzar estribos.")

    return {
        "element_id": str(element.id),
        "tag": element.tag,
        "ok": not warnings,
        "geom": {
            "b_cm": round(b_cm, 1),
            "h_cm": round(h_cm, 1),
            "d_cm": round(d_cm, 1),
            "length_m": round(length_m, 3),
            "ag_cm2": round(ag_cm2, 1),
        },
        "section_name": sec.name,
        "demands": {
            "Pu_kN": round(pu, 2),
            "Mux_kNm": round(mux, 2),
            "Muy_kNm": round(muy, 2),
            "Vu_kN": round(vu, 2),
            "Pu_estimated_kN": round(pu_est, 2),
        },
        "longitudinal": {**long_bars, "rho_min": rho_min_long, "rho_max": rho_max_long},
        "capacity": {
            "phi_Pn_max_kN": round(phi_pn_max, 2),
            "phi_Mnx_kNm": round(phi_mnx, 2),
            "phi_Mny_kNm": round(phi_mny, 2),
            "axial_utilization": round(axial_util, 3),
            "bresler": round(bresler, 3) if math.isfinite(bresler) else None,
        },
        "shear": {
            "phi_Vc_kN": round(phi_vc, 2),
            "phi_Vn_kN": round(phi_vn, 2),
            "stirrup": {"bar": "#3", "av_cm2": round(av_cm2, 3), **stir},
        },
        "warnings": warnings,
    }


def _run_design(db: Session, design: ColumnDesign) -> dict:
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

    results = [_design_single_column(db, e, design.config) for e in elements]
    total_warnings = sum(len(r.get("warnings", [])) for r in results)
    total_ok = sum(1 for r in results if r.get("ok"))
    avg_rho = (
        sum(r.get("longitudinal", {}).get("rho_prov", 0) or 0 for r in results)
        / max(len(results), 1)
    )

    return {
        "ok": total_warnings == 0,
        "config": design.config,
        "n_elements": len(elements),
        "n_elements_ok": total_ok,
        "total_warnings": total_warnings,
        "avg_rho_long": round(avg_rho, 4),
        "elements": results,
    }


@app.task(name="civilcode_worker.tasks.design.run_column_design", bind=True)
def run_column_design(self: Task, design_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        d_uuid = UUID(design_id)
        design = db.execute(select(ColumnDesign).where(ColumnDesign.id == d_uuid)).scalar_one_or_none()
        if design is None:
            raise RuntimeError(f"ColumnDesign {design_id} not found")

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
                select(ColumnDesign).where(ColumnDesign.id == UUID(design_id))
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
