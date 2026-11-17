from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class LoadPattern(Base):
    """Patrón de carga base (dead, live, seismic_x, seismic_y, wind_x...)."""

    __tablename__ = "load_patterns"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # tipos válidos: "dead", "live", "seismic", "wind", "snow", "other"
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    self_weight_multiplier: Mapped[float | None] = mapped_column(nullable=True, default=0.0)


class LoadCase(Base):
    """Caso de análisis (modal, estático, espectral...)."""

    __tablename__ = "load_cases"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # tipos válidos: "linear_static", "modal", "response_spectrum", "linear_time_history", "nonlinear"
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class Combination(Base):
    """Combinación lineal de patrones o casos para diseño."""

    __tablename__ = "combinations"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # tipos válidos: "linear_add", "envelope", "srss"
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="linear_add")
    # [{"pattern_name": "D", "factor": 1.2}, {"pattern_name": "L", "factor": 1.6}]
    factors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
