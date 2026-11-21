"""Servicio de envolvente de demandas por elemento.

Lee registros de `element_forces` (ya persistidos por el task de upload XLSX)
y computa, para un conjunto de combos, la envolvente de M3 y V2 por estación.

Convenciones ETABS:
- M3: momento flector principal (kN·m). Positivo → fibra inferior en tensión.
- V2: cortante local eje 2 (kN).
- Station: distancia a lo largo del elemento desde el nodo I (m).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from civilcode_api.models.element_force import ElementForce


@dataclass
class EnvelopePoint:
    station_m: float
    m_pos_max: float = 0.0  # máximo momento positivo (kN·m)
    m_neg_max: float = 0.0  # máximo momento negativo (valor negativo; ej. -120 kN·m)
    v_max: float = 0.0  # máximo |V2| (kN)


@dataclass
class ElementEnvelope:
    element_tag: str
    combos: list[str]
    stations: list[float] = field(default_factory=list)
    points: list[EnvelopePoint] = field(default_factory=list)

    @property
    def mu_pos_max(self) -> float:
        return max((p.m_pos_max for p in self.points), default=0.0)

    @property
    def mu_neg_max(self) -> float:
        return min((p.m_neg_max for p in self.points), default=0.0)

    @property
    def vu_max(self) -> float:
        return max((p.v_max for p in self.points), default=0.0)

    def m_at_left_support(self) -> float:
        if not self.points:
            return 0.0
        return self.points[0].m_neg_max

    def m_at_right_support(self) -> float:
        if not self.points:
            return 0.0
        return self.points[-1].m_neg_max

    def m_pos_at_center(self) -> float:
        if not self.points:
            return 0.0
        mid_idx = len(self.points) // 2
        # busca el máximo positivo en el tercio central
        n = len(self.points)
        a = max(0, n // 3)
        b = min(n, 2 * n // 3 + 1)
        chunk = self.points[a:b] if b > a else [self.points[mid_idx]]
        return max((p.m_pos_max for p in chunk), default=0.0)

    def v_at_left_support(self) -> float:
        if not self.points:
            return 0.0
        # máximo de los primeros 3 puntos
        return max((p.v_max for p in self.points[: min(3, len(self.points))]), default=0.0)

    def v_at_right_support(self) -> float:
        if not self.points:
            return 0.0
        return max(
            (p.v_max for p in self.points[-min(3, len(self.points)) :]), default=0.0
        )


def list_available_combos(db: Session, revision_id: UUID) -> list[str]:
    """Combos únicos presentes en element_forces para una revisión."""
    rows = db.execute(
        select(ElementForce.output_case)
        .where(ElementForce.building_revision_id == revision_id)
        .distinct()
        .order_by(ElementForce.output_case)
    ).scalars().all()
    return [str(r) for r in rows]


def compute_element_envelope(
    db: Session,
    revision_id: UUID,
    element_tag: str,
    combos: list[str],
) -> ElementEnvelope:
    """Calcula envolvente de M3 y V2 para un elemento bajo los combos dados.

    En cada estación reportada por ETABS:
    - m_pos_max = max(M3) sobre los combos (si > 0)
    - m_neg_max = min(M3) sobre los combos (si < 0)
    - v_max   = max(|V2|) sobre los combos
    """
    env = ElementEnvelope(element_tag=element_tag, combos=combos)
    if not combos:
        return env

    rows = db.execute(
        select(
            ElementForce.station_m,
            ElementForce.m3_knm,
            ElementForce.v2_kn,
        )
        .where(ElementForce.building_revision_id == revision_id)
        .where(ElementForce.element_tag == element_tag)
        .where(ElementForce.output_case.in_(combos))
        .order_by(ElementForce.station_m)
    ).all()

    # Agrupa por station con tolerancia pequeña (centímetros).
    by_station: dict[float, EnvelopePoint] = {}
    for station, m3, v2 in rows:
        # cuantiza para evitar duplicados por ruido float
        key = round(float(station), 4)
        pt = by_station.get(key)
        if pt is None:
            pt = EnvelopePoint(station_m=key)
            by_station[key] = pt
        m3 = float(m3)
        v2 = float(v2)
        if m3 > pt.m_pos_max:
            pt.m_pos_max = m3
        if m3 < pt.m_neg_max:
            pt.m_neg_max = m3
        av2 = abs(v2)
        if av2 > pt.v_max:
            pt.v_max = av2

    env.points = [by_station[k] for k in sorted(by_station.keys())]
    env.stations = [p.station_m for p in env.points]
    return env


def envelope_series(env: ElementEnvelope) -> dict:
    """Formatea la envolvente como series listas para Plotly."""
    return {
        "stations_m": [p.station_m for p in env.points],
        "m_pos_kNm": [p.m_pos_max for p in env.points],
        "m_neg_kNm": [p.m_neg_max for p in env.points],
        "v_abs_kN": [p.v_max for p in env.points],
    }


@dataclass
class GroupEnvelope:
    """Envolvente concatenada de varios elementos en coordenadas de grupo.

    Las estaciones están en metros desde el origen del grupo (offset_m=0).
    """
    stations_m: list[float] = field(default_factory=list)
    m_pos_kNm: list[float] = field(default_factory=list)
    m_neg_kNm: list[float] = field(default_factory=list)
    v_abs_kN: list[float] = field(default_factory=list)


def compute_group_envelope(
    db: Session,
    revision_id: UUID,
    group_elements: list,  # list[ElementInGroup] — evita import circular
    combos: list[str],
) -> GroupEnvelope:
    """Concatena envolventes de cada elemento del grupo con su offset.

    Si un elemento fue recorrido invertido (flipped=True), su eje local I→J se
    mapea en reverso al eje del grupo: estación del grupo = offset + (L_elem − station_elem).
    """
    out = GroupEnvelope()
    if not combos:
        return out

    for eg in group_elements:
        env = compute_element_envelope(db, revision_id, eg.tag, combos)
        if not env.points:
            continue
        L = eg.length_m
        for p in env.points:
            if eg.flipped:
                s_global = eg.offset_m + max(0.0, L - p.station_m)
            else:
                s_global = eg.offset_m + p.station_m
            out.stations_m.append(round(s_global, 4))
            out.m_pos_kNm.append(p.m_pos_max)
            out.m_neg_kNm.append(p.m_neg_max)
            out.v_abs_kN.append(p.v_max)

    # Ordena por estación global y colapsa duplicados por conservadurismo
    if out.stations_m:
        idx = sorted(range(len(out.stations_m)), key=lambda i: out.stations_m[i])
        stations = [out.stations_m[i] for i in idx]
        mpos = [out.m_pos_kNm[i] for i in idx]
        mneg = [out.m_neg_kNm[i] for i in idx]
        vabs = [out.v_abs_kN[i] for i in idx]
        # Colapsa estaciones muy cercanas (≤ 1 cm) tomando el peor de cada señal
        collapsed_s: list[float] = []
        collapsed_mp: list[float] = []
        collapsed_mn: list[float] = []
        collapsed_v: list[float] = []
        for s, mp, mn, v in zip(stations, mpos, mneg, vabs):
            if collapsed_s and abs(s - collapsed_s[-1]) < 0.01:
                collapsed_mp[-1] = max(collapsed_mp[-1], mp)
                collapsed_mn[-1] = min(collapsed_mn[-1], mn)
                collapsed_v[-1] = max(collapsed_v[-1], v)
            else:
                collapsed_s.append(s)
                collapsed_mp.append(mp)
                collapsed_mn.append(mn)
                collapsed_v.append(v)
        out.stations_m = collapsed_s
        out.m_pos_kNm = collapsed_mp
        out.m_neg_kNm = collapsed_mn
        out.v_abs_kN = collapsed_v
    return out
