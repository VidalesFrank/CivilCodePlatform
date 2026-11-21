from uuid import UUID

from pydantic import BaseModel


class BeamGroupSpan(BaseModel):
    element_id: UUID
    tag: str
    section_name: str | None
    offset_m: float
    length_m: float
    flipped: bool
    # Coordenadas globales del tramo (para render en planta)
    ni: tuple[float, float, float]
    nj: tuple[float, float, float]


class BeamGroupPublic(BaseModel):
    id: str
    level_id: UUID | None
    total_length_m: float
    n_spans: int
    direction: tuple[float, float, float]
    origin: tuple[float, float, float]
    end: tuple[float, float, float]
    supports_m: list[float]
    spans: list[BeamGroupSpan]


class BeamGroupsResponse(BaseModel):
    level_id: UUID | None
    n_beams: int  # elementos beam en el nivel
    n_groups: int
    groups: list[BeamGroupPublic]
