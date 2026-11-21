"""Agrupamiento puro (sin DB) de elementos frame colineales en BeamGroups.

Un BeamGroup representa una viga real: cadena de frames consecutivos y
colineales conectados por nodo compartido. Permite diseñar refuerzo
con continuidad y renderizar vistas en planta por piso.

Entrada:
    frames: list[FrameIn] con nodos resueltos.

Salida:
    list[BeamGroup] con offsets, apoyos y orientación.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


Point = tuple[float, float, float]


@dataclass
class FrameIn:
    id: Any  # UUID string o cualquier identificador
    tag: str
    level_id: Any | None
    section_name: str | None
    ni_id: Any
    nj_id: Any
    ni: Point
    nj: Point


@dataclass
class ElementInGroup:
    element_id: Any
    tag: str
    section_name: str | None
    offset_m: float
    length_m: float
    flipped: bool
    # Coordenadas globales del tramo (para render en planta)
    ni: Point
    nj: Point


@dataclass
class BeamGroup:
    id: str
    level_id: Any | None
    direction: Point  # unit vector
    total_length_m: float
    origin: Point
    end: Point  # punto global correspondiente a offset = total_length_m
    elements: list[ElementInGroup] = field(default_factory=list)
    supports_m: list[float] = field(default_factory=list)


def _vnorm(v: Point) -> float:
    return math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)


def _vunit(v: Point) -> Point:
    n = _vnorm(v)
    if n < 1e-9:
        return (0.0, 0.0, 0.0)
    return (v[0] / n, v[1] / n, v[2] / n)


def _vsub(a: Point, b: Point) -> Point:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _collinear(u: Point, v: Point, tol_deg: float = 7.0) -> bool:
    dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
    return abs(dot) >= math.cos(math.radians(tol_deg))


def group_frames(frames: list[FrameIn]) -> list[BeamGroup]:
    """Agrupa una lista de frames en BeamGroups por colinealidad y nodos compartidos."""
    if not frames:
        return []

    # Precalcular dirección y longitud por frame
    @dataclass
    class FrameData:
        frame: FrameIn
        direction: Point
        length: float

    data: dict[Any, FrameData] = {}
    for f in frames:
        L = _vnorm(_vsub(f.nj, f.ni))
        if L < 0.05:
            continue
        d = _vunit(_vsub(f.nj, f.ni))
        data[f.id] = FrameData(frame=f, direction=d, length=L)

    if not data:
        return []

    # Índice: nodo → frames que lo tocan
    node_touched: dict[Any, list[Any]] = {}
    for fid, fd in data.items():
        node_touched.setdefault(fd.frame.ni_id, []).append(fid)
        node_touched.setdefault(fd.frame.nj_id, []).append(fid)

    # Union-Find sobre frames vía colinealidad + nodo compartido
    parent: dict[Any, Any] = {fid: fid for fid in data}

    def find(x: Any) -> Any:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: Any, b: Any) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for incident in node_touched.values():
        if len(incident) < 2:
            continue
        for i in range(len(incident)):
            for j in range(i + 1, len(incident)):
                if _collinear(data[incident[i]].direction, data[incident[j]].direction):
                    union(incident[i], incident[j])

    # Componentes
    components: dict[Any, list[Any]] = {}
    for fid in data:
        components.setdefault(find(fid), []).append(fid)

    groups: list[BeamGroup] = []
    for member_ids in components.values():
        g = _build_chain(member_ids, data, node_touched)
        if g is not None:
            groups.append(g)

    # Orden determinístico
    groups.sort(key=lambda g: (g.origin[2], g.origin[0], g.origin[1]))
    for idx, g in enumerate(groups):
        g.id = f"GRP-{idx + 1:03d}"
    return groups


def _build_chain(
    member_ids: list[Any],
    data: dict,
    node_touched: dict[Any, list[Any]],
) -> BeamGroup | None:
    if len(member_ids) == 1:
        fid = member_ids[0]
        fd = data[fid]
        f = fd.frame
        # Normalizar sentido: dominante positivo en el eje predominante
        d = fd.direction
        if abs(d[0]) >= abs(d[1]) and abs(d[0]) >= abs(d[2]):
            flip = d[0] < 0
        elif abs(d[1]) >= abs(d[2]):
            flip = d[1] < 0
        else:
            flip = d[2] < 0
        origin = f.nj if flip else f.ni
        end = f.ni if flip else f.nj
        dir_canon: Point = (-d[0], -d[1], -d[2]) if flip else d
        return BeamGroup(
            id="",
            level_id=f.level_id,
            direction=dir_canon,
            total_length_m=fd.length,
            origin=origin,
            end=end,
            elements=[
                ElementInGroup(
                    element_id=f.id,
                    tag=f.tag,
                    section_name=f.section_name,
                    offset_m=0.0,
                    length_m=fd.length,
                    flipped=flip,
                    ni=f.ni,
                    nj=f.nj,
                )
            ],
            supports_m=[0.0, fd.length],
        )

    member_set = set(member_ids)
    # Endpoints: nodos tocados por solo 1 miembro del grupo
    endpoint_candidates: list[Any] = []
    for fid in member_ids:
        fd = data[fid]
        for nid in (fd.frame.ni_id, fd.frame.nj_id):
            count = sum(1 for e in node_touched.get(nid, []) if e in member_set)
            if count == 1 and nid not in endpoint_candidates:
                endpoint_candidates.append(nid)
    if not endpoint_candidates:
        endpoint_candidates = [data[member_ids[0]].frame.ni_id]

    def _node_coord(nid: Any) -> Point:
        for fid in member_ids:
            fd = data[fid]
            if fd.frame.ni_id == nid:
                return fd.frame.ni
            if fd.frame.nj_id == nid:
                return fd.frame.nj
        return (0.0, 0.0, 0.0)

    start_node = min(endpoint_candidates, key=_node_coord)
    start_coord = _node_coord(start_node)

    ordered: list[tuple[Any, bool]] = []
    current = start_node
    used: set[Any] = set()
    while True:
        next_fid: Any | None = None
        for fid in node_touched.get(current, []):
            if fid in member_set and fid not in used:
                next_fid = fid
                break
        if next_fid is None:
            break
        used.add(next_fid)
        fd = data[next_fid]
        flipped = fd.frame.ni_id != current
        ordered.append((next_fid, flipped))
        current = fd.frame.nj_id if not flipped else fd.frame.ni_id

    if not ordered:
        return None

    first_fd = data[ordered[0][0]]
    if ordered[0][1]:
        dir_canon = (-first_fd.direction[0], -first_fd.direction[1], -first_fd.direction[2])
    else:
        dir_canon = first_fd.direction

    group_elems: list[ElementInGroup] = []
    offset = 0.0
    supports_m: list[float] = [0.0]
    for fid, flipped in ordered:
        fd = data[fid]
        group_elems.append(
            ElementInGroup(
                element_id=fd.frame.id,
                tag=fd.frame.tag,
                section_name=fd.frame.section_name,
                offset_m=offset,
                length_m=fd.length,
                flipped=flipped,
                ni=fd.frame.ni,
                nj=fd.frame.nj,
            )
        )
        offset += fd.length
        supports_m.append(offset)

    end_coord = _node_coord(current)

    return BeamGroup(
        id="",
        level_id=first_fd.frame.level_id,
        direction=dir_canon,
        total_length_m=offset,
        origin=start_coord,
        end=end_coord,
        elements=group_elems,
        supports_m=supports_m,
    )
