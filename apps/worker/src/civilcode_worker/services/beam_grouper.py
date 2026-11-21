"""Wrapper del agrupador puro (engine.building.beam_grouping) con lookup DB.

Re-exporta `BeamGroup` y `ElementInGroup` para que el task pueda seguir
importando desde esta ruta.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from civilcode_api.models.element import Element
from civilcode_api.models.section import Section
from civilcode_api.models.structure import Node

from engine.building.beam_grouping import (
    BeamGroup,
    ElementInGroup,
    FrameIn,
    group_frames,
)

__all__ = ["BeamGroup", "ElementInGroup", "group_beams"]


def group_beams(
    db: Session,
    element_ids: list[UUID],
    level_id: UUID | None = None,
) -> list[BeamGroup]:
    """Carga elementos + nodos desde DB y delega al agrupador puro."""
    if not element_ids:
        return []

    elements = (
        db.query(Element)
        .filter(Element.id.in_(element_ids), Element.kind == "beam")
        .all()
    )
    if level_id is not None:
        elements = [e for e in elements if e.level_id == level_id]
    if not elements:
        return []

    # Carga nodos relacionados
    node_ids: set[UUID] = set()
    for e in elements:
        if e.node_i_id:
            node_ids.add(e.node_i_id)
        if e.node_j_id:
            node_ids.add(e.node_j_id)
    nodes = db.query(Node).filter(Node.id.in_(node_ids)).all() if node_ids else []
    node_by_id: dict[UUID, Node] = {n.id: n for n in nodes}

    # Carga section names
    section_ids = {e.section_id for e in elements if e.section_id}
    sections: dict[UUID, Section] = {}
    if section_ids:
        rows = db.query(Section).filter(Section.id.in_(section_ids)).all()
        sections = {s.id: s for s in rows}

    frames: list[FrameIn] = []
    for e in elements:
        if not e.node_i_id or not e.node_j_id:
            continue
        ni = node_by_id.get(e.node_i_id)
        nj = node_by_id.get(e.node_j_id)
        if ni is None or nj is None:
            continue
        sec = sections.get(e.section_id) if e.section_id else None
        frames.append(
            FrameIn(
                id=e.id,
                tag=str(e.tag),
                level_id=e.level_id,
                section_name=sec.name if sec else None,
                ni_id=e.node_i_id,
                nj_id=e.node_j_id,
                ni=(float(ni.x), float(ni.y), float(ni.z)),
                nj=(float(nj.x), float(nj.y), float(nj.z)),
            )
        )

    return group_frames(frames)
