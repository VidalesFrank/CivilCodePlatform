"""Task Celery — design_walls.run_wall_design

Diseño simplificado de muros estructurales según NSR-10 (C.14, C.21.9):
- Clasificación por relación hw/Lw.
- Cortante en plano: Vn = Acv·(αc·√fc + ρh·fy), con αc dependiente de hw/Lw.
- Cuantías mínimas horizontal/vertical (C.14.3): ρh ≥ 0.0025, ρv ≥ 0.0025.
- Spacing máximo: s_max = min(3t, 450 mm).
- Capacidad axial pura tipo columna: φPn_max = 0.80·φ·[0.85·fc·(Ag − Ast) + fy·Ast].
- Decisión elementos de borde confinados: proxy simple (Pu/Ag > 0.2·fc o Mu grande).
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
from civilcode_api.models.section import Section
from civilcode_api.models.structure import Node
from civilcode_api.models.wall_design import WallDesign

from ..celery_app import app
from ._rc_helpers import (
    PHI_AXIAL_TIED,
    PHI_SHEAR,
    REBAR_DB,
    bar_area_cm2,
)


def _sync_session_factory() -> sessionmaker[Session]:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("+psycopg", "")
    engine = create_engine(sync_url, future=True)
    return sessionmaker(engine, expire_on_commit=False, future=True)


def _alpha_c(hw_Lw: float) -> float:
    """αc del factor Vc: 0.25 si hw/Lw ≤ 1.5, 0.17 si ≥ 2.0, lineal entre."""
    if hw_Lw <= 1.5:
        return 0.25
    if hw_Lw >= 2.0:
        return 0.17
    return 0.25 - (0.25 - 0.17) * (hw_Lw - 1.5) / 0.5


def _select_wall_mesh(
    t_cm: float, rho_target: float, fy_mpa: float
) -> dict:
    """Selecciona barra y spacing para malla de muro.

    Tomamos espaciamiento ~20 cm, y ajustamos el diámetro para dar rho_target.
    As requerido por metro: rho * t_mm * 1000 (mm²/m)
    As_barra * 1000/s_cm = requerido → elegir combinación práctica.
    """
    s_max_cm = min(3.0 * t_cm, 45.0)
    best: dict | None = None
    for bar_name, db_mm in REBAR_DB[:5]:  # #3..#7 típico
        ab_cm2 = bar_area_cm2(db_mm)
        # ρ_prov con cierto spacing s
        for s_cm in (10.0, 15.0, 20.0, 25.0, 30.0):
            if s_cm > s_max_cm:
                continue
            as_per_m = ab_cm2 * (100.0 / s_cm)  # cm²/m
            rho_prov = as_per_m / (t_cm * 100.0)  # as/t
            if rho_prov >= rho_target:
                over = rho_prov - rho_target
                cand = {
                    "bar": bar_name,
                    "spacing_cm": s_cm,
                    "rho_prov": round(rho_prov, 5),
                    "as_per_m_cm2": round(as_per_m, 3),
                    "_over": over,
                }
                if best is None or over < best["_over"]:
                    best = cand
    if best is None:
        # fallback más agresivo
        ab = bar_area_cm2(15.9)
        best = {
            "bar": "#5",
            "spacing_cm": 15.0,
            "rho_prov": round(ab * (100.0 / 15.0) / (t_cm * 100.0), 5),
            "as_per_m_cm2": round(ab * (100.0 / 15.0), 3),
        }
    best.pop("_over", None)
    return best


def _design_single_wall(db: Session, element: Element, config: dict) -> dict:
    fc = float(config.get("fc_mpa", 28.0))
    fy = float(config.get("fy_mpa", 420.0))
    cover_mm = float(config.get("cover_mm", 20.0))
    ductility = str(config.get("ductility", "DMO"))

    # Para muros, los overrides de demanda son clave (sin análisis real)
    Pu = float(config.get("Pu_kN", 500.0))  # axial de servicio × 1.4 aprox
    Vu = float(config.get("Vu_kN", 150.0))
    Mu = float(config.get("Mu_kNm", 200.0))

    rho_h_target = float(config.get("rho_h_target", 0.0025))
    rho_v_target = float(config.get("rho_v_target", 0.0025))

    # Geometría del muro
    ni = db.get(Node, element.node_i_id) if element.node_i_id else None
    nj = db.get(Node, element.node_j_id) if element.node_j_id else None
    if not ni or not nj:
        return {"element_id": str(element.id), "ok": False, "error": "nodos no encontrados"}
    sec = db.get(Section, element.section_id) if element.section_id else None
    # Para muros, la sección ETABS típica da espesor; Lw y hw los sacamos por
    # proxy desde el elemento o permitimos override en config.
    t_cm = float(config.get("t_cm")) if config.get("t_cm") is not None else 20.0
    Lw_cm = float(config.get("Lw_cm")) if config.get("Lw_cm") is not None else 300.0
    hw_cm = float(config.get("hw_cm")) if config.get("hw_cm") is not None else max(100.0, abs(nj.z - ni.z) * 100.0)
    if sec and sec.params:
        t_cm = float(sec.params.get("b_m") or sec.params.get("t_m") or 0.20) * 100.0

    Ag_cm2 = t_cm * Lw_cm
    hw_Lw = hw_cm / Lw_cm if Lw_cm > 0 else 1.0

    classification = (
        "pier corto (hw/Lw ≤ 0.5)"
        if hw_Lw <= 0.5
        else "muro bajo (hw/Lw ≤ 2)"
        if hw_Lw <= 2.0
        else "muro esbelto"
    )

    # Capacidad a cortante
    alpha = _alpha_c(hw_Lw)
    mesh_h = _select_wall_mesh(t_cm, rho_h_target, fy)
    mesh_v = _select_wall_mesh(t_cm, max(rho_v_target, mesh_h["rho_prov"] if Vu > 0 else rho_v_target), fy)

    Acv_mm2 = t_cm * 10.0 * Lw_cm * 10.0
    # Vn = Acv*(alpha*sqrt(fc) + rho_h*fy), unidades MPa·mm² → N → kN /1000
    Vn_N = Acv_mm2 * (alpha * math.sqrt(fc) + mesh_h["rho_prov"] * fy)
    Vn_max_N = 0.83 * math.sqrt(fc) * Acv_mm2
    Vn_kN = min(Vn_N, Vn_max_N) / 1000.0
    phi_Vn_kN = PHI_SHEAR * Vn_kN

    # Capacidad axial (como columna con As total proxy = ρv*Ag)
    Ast_cm2 = mesh_v["rho_prov"] * Ag_cm2
    phi_Pn_max_kN = (
        0.80
        * PHI_AXIAL_TIED
        * (0.85 * fc * (Ag_cm2 - Ast_cm2) * 100.0 + fy * Ast_cm2 * 100.0)
        / 1000.0
    )

    # Boundary elements decision (C.21.9)
    needs_boundary = (Pu / Ag_cm2 > 0.2 * fc / 100.0) or (Mu > 0.5 * phi_Pn_max_kN * Lw_cm / 100.0)
    boundary_length_cm = Lw_cm / 10.0 if needs_boundary else 0.0

    warnings: list[str] = []
    if hw_Lw < 0.5:
        warnings.append("hw/Lw < 0.5: fuera de alcance del módulo (tratar como viga de gran peralte).")
    if mesh_h["rho_prov"] < 0.0025:
        warnings.append(f"ρh ({mesh_h['rho_prov']:.4f}) < 0.0025 NSR-10 C.11/14.")
    if mesh_v["rho_prov"] < 0.0025:
        warnings.append(f"ρv ({mesh_v['rho_prov']:.4f}) < 0.0025 NSR-10.")
    if phi_Vn_kN < Vu:
        warnings.append(f"φVn ({phi_Vn_kN:.1f} kN) < Vu ({Vu:.1f} kN). Aumentar ρh o t.")
    if Vn_N > Vn_max_N:
        warnings.append("Vn requerido excede Vn_max = 0.83·√fc·Acv. Sección insuficiente.")
    if Pu > phi_Pn_max_kN:
        warnings.append(f"φPn_max ({phi_Pn_max_kN:.1f} kN) < Pu ({Pu:.1f} kN).")
    if ductility == "DES" and needs_boundary:
        warnings.append("Elementos de borde confinados requeridos (DES).")

    return {
        "element_id": str(element.id),
        "tag": element.tag,
        "ok": not warnings,
        "classification": classification,
        "geom": {
            "t_cm": round(t_cm, 1),
            "Lw_cm": round(Lw_cm, 1),
            "hw_cm": round(hw_cm, 1),
            "hw_Lw": round(hw_Lw, 3),
            "Ag_cm2": round(Ag_cm2, 1),
        },
        "demands": {"Pu_kN": round(Pu, 2), "Vu_kN": round(Vu, 2), "Mu_kNm": round(Mu, 2)},
        "reinforcement": {
            "horizontal": mesh_h,
            "vertical": mesh_v,
        },
        "capacity": {
            "phi_Vn_kN": round(phi_Vn_kN, 2),
            "Vn_max_kN": round(0.75 * Vn_max_N / 1000.0, 2),
            "phi_Pn_max_kN": round(phi_Pn_max_kN, 2),
        },
        "boundary_elements": {
            "required": needs_boundary,
            "length_cm": round(boundary_length_cm, 1),
        },
        "warnings": warnings,
    }


def _run_design(db: Session, design: WallDesign) -> dict:
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
    results = [_design_single_wall(db, e, design.config) for e in elements]
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


@app.task(name="civilcode_worker.tasks.design.run_wall_design", bind=True)
def run_wall_design(self: Task, design_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        d_uuid = UUID(design_id)
        design = db.execute(select(WallDesign).where(WallDesign.id == d_uuid)).scalar_one_or_none()
        if design is None:
            raise RuntimeError(f"WallDesign {design_id} not found")
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
            design = db.execute(select(WallDesign).where(WallDesign.id == UUID(design_id))).scalar_one_or_none()
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
