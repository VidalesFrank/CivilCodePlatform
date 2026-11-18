"""Task Celery — analyze.run_quick_check

Análisis preliminar: calcula métricas geométricas, de masa y de distribución
del modelo importado SIN correr OpenSees. Pensado como first-cut para
verificar que el modelo tiene buena pinta antes de un análisis completo.

Entregables (result_summary):
- total_mass_tons (estimación con densidad concreto 2400 kg/m3)
- mass_by_level: [{level_name, elevation, mass_tons}]
- element_counts: {beam, column, wall, slab, joist}
- element_counts_by_level: [{level_name, counts}]
- total_concrete_volume_m3
- beam_total_length_m, column_total_height_m
- height_m, n_stories
- warnings: lista de hallazgos (desplazamientos planos, nodos sueltos, etc.)
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
from civilcode_api.models.analysis import AnalysisRun
from civilcode_api.models.element import Element
from civilcode_api.models.section import Section
from civilcode_api.models.structure import Level, Node

from ..celery_app import app

CONCRETE_DENSITY_KG_M3 = 2400.0


def _sync_session_factory() -> sessionmaker[Session]:
    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "").replace("+psycopg", "")
    engine = create_engine(sync_url, future=True)
    return sessionmaker(engine, expire_on_commit=False, future=True)


def _section_area_m2(sec: Section) -> float | None:
    """Area de la sección en m2.

    Prefiere A_m2 precalculada por el adapter/parser. Si no esta, intenta
    reconstruir desde dimensiones (b_m/h_m para rectangulares, D para circulares).
    """
    if not sec.params:
        return None
    a_direct = sec.params.get("A_m2")
    if a_direct is not None:
        try:
            return float(a_direct)
        except (TypeError, ValueError):
            pass

    # Rectangular: b_m x h_m (convención del adapter). B/D tambien aceptados.
    b = sec.params.get("b_m") or sec.params.get("B") or sec.params.get("base") or sec.params.get("width")
    h = sec.params.get("h_m") or sec.params.get("D") or sec.params.get("depth") or sec.params.get("height")
    try:
        if b is not None and h is not None:
            return float(b) * float(h)
    except (TypeError, ValueError):
        pass

    # Circular: shape == 'concrete circle' con D (diametro)
    shape_hint = (sec.params.get("shape") or sec.shape or "").lower()
    d_circle = sec.params.get("D") or sec.params.get("diameter")
    if "circle" in shape_hint and d_circle is not None:
        try:
            r = float(d_circle) / 2.0
            return math.pi * r * r
        except (TypeError, ValueError):
            return None
    return None


def _element_length_m(e: Element, node_by_id: dict[UUID, Node]) -> float:
    ni = node_by_id.get(e.node_i_id) if e.node_i_id else None
    nj = node_by_id.get(e.node_j_id) if e.node_j_id else None
    if not ni or not nj:
        return 0.0
    dx = nj.x - ni.x
    dy = nj.y - ni.y
    dz = nj.z - ni.z
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def _quick_check(db: Session, revision_id: UUID) -> dict:
    levels = db.execute(
        select(Level).where(Level.building_revision_id == revision_id).order_by(Level.elevation)
    ).scalars().all()
    nodes = db.execute(
        select(Node).where(Node.building_revision_id == revision_id)
    ).scalars().all()
    sections = db.execute(
        select(Section).where(Section.building_revision_id == revision_id)
    ).scalars().all()
    elements = db.execute(
        select(Element).where(Element.building_revision_id == revision_id)
    ).scalars().all()

    sec_area = {s.id: _section_area_m2(s) for s in sections}
    node_by_id: dict[UUID, Node] = {n.id: n for n in nodes}
    level_by_id: dict[UUID, Level] = {lev.id: lev for lev in levels}
    level_name = {lev.id: lev.name for lev in levels}

    element_counts: dict[str, int] = {}
    counts_by_level: dict[UUID, dict[str, int]] = {lev.id: {} for lev in levels}
    volume_by_level: dict[UUID, float] = {lev.id: 0.0 for lev in levels}
    length_by_kind: dict[str, float] = {}
    total_volume = 0.0
    warnings: list[str] = []

    for e in elements:
        kind = e.kind or "unknown"
        element_counts[kind] = element_counts.get(kind, 0) + 1
        length = _element_length_m(e, node_by_id)
        length_by_kind[kind] = length_by_kind.get(kind, 0.0) + length

        area = sec_area.get(e.section_id) if e.section_id else None
        vol = (area * length) if area is not None else 0.0
        total_volume += vol

        if e.level_id and e.level_id in counts_by_level:
            counts_by_level[e.level_id][kind] = counts_by_level[e.level_id].get(kind, 0) + 1
            volume_by_level[e.level_id] += vol

    total_mass_kg = total_volume * CONCRETE_DENSITY_KG_M3
    total_mass_tons = total_mass_kg / 1000.0

    mass_by_level = [
        {
            "level_id": str(lev.id),
            "level_name": lev.name,
            "elevation_m": lev.elevation,
            "volume_m3": round(volume_by_level[lev.id], 3),
            "mass_tons": round(volume_by_level[lev.id] * CONCRETE_DENSITY_KG_M3 / 1000.0, 3),
        }
        for lev in levels
    ]

    counts_by_level_out = [
        {
            "level_id": str(lev.id),
            "level_name": lev.name,
            "elevation_m": lev.elevation,
            "counts": counts_by_level[lev.id],
        }
        for lev in levels
    ]

    # Altura total: diferencia entre nivel más alto y más bajo
    height_m = 0.0
    if levels:
        height_m = levels[-1].elevation - levels[0].elevation

    # Warnings
    unassigned = sum(1 for e in elements if e.section_id is None)
    if unassigned > 0:
        warnings.append(f"{unassigned} elementos sin sección asignada")
    orphan_nodes = 0
    used_node_ids: set[UUID] = set()
    for e in elements:
        if e.node_i_id:
            used_node_ids.add(e.node_i_id)
        if e.node_j_id:
            used_node_ids.add(e.node_j_id)
    orphan_nodes = sum(1 for n in nodes if n.id not in used_node_ids)
    if orphan_nodes > 0:
        warnings.append(f"{orphan_nodes} nodos sin elementos conectados")

    # Elementos sin nodos resolvibles
    broken = sum(1 for e in elements if e.node_i_id not in node_by_id or e.node_j_id not in node_by_id)
    if broken > 0:
        warnings.append(f"{broken} elementos con node_i o node_j no encontrados")

    # Chequeo de distribución: si faltan columnas pero hay vigas
    if element_counts.get("beam", 0) > 0 and element_counts.get("column", 0) == 0:
        warnings.append("El modelo tiene vigas pero ninguna columna (posible subset/fixture incompleto)")

    return {
        "n_levels": len(levels),
        "n_nodes": len(nodes),
        "n_elements": len(elements),
        "n_sections": len(sections),
        "element_counts": element_counts,
        "element_counts_by_level": counts_by_level_out,
        "length_by_kind_m": {k: round(v, 2) for k, v in length_by_kind.items()},
        "total_concrete_volume_m3": round(total_volume, 3),
        "total_mass_tons": round(total_mass_tons, 3),
        "mass_by_level": mass_by_level,
        "height_m": round(height_m, 3),
        "n_stories": max(0, len(levels) - 1),
        "warnings": warnings,
    }


@app.task(name="civilcode_worker.tasks.analysis.run_quick_check", bind=True)
def run_quick_check(self: Task, run_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        run_uuid = UUID(run_id)
        run = db.execute(select(AnalysisRun).where(AnalysisRun.id == run_uuid)).scalar_one_or_none()
        if run is None:
            raise RuntimeError(f"AnalysisRun {run_id} not found")

        run.status = "running"
        run.started_at = datetime.now(UTC)
        db.commit()

        summary = _quick_check(db, run.building_revision_id)

        run.status = "completed"
        run.completed_at = datetime.now(UTC)
        run.result_summary = summary
        run.log = None
        db.commit()
        return {"status": "completed", **summary}
    except Exception as exc:
        tb = traceback.format_exc()
        try:
            run = db.execute(select(AnalysisRun).where(AnalysisRun.id == UUID(run_id))).scalar_one_or_none()
            if run is not None:
                run.status = "failed"
                run.completed_at = datetime.now(UTC)
                run.log = tb
                db.commit()
        except Exception:
            db.rollback()
        raise RuntimeError(f"{exc}\n{tb}") from exc
    finally:
        db.close()
