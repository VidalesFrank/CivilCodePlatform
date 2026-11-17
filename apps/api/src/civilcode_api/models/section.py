from typing import Any
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Material(Base):
    """Material estructural (concreto, acero de refuerzo, estructural)."""

    __tablename__ = "materials"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # tipos válidos: "concrete", "rebar", "steel"
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    # fc (concrete), fy (rebar/steel), E, nu: en MPa o adim.
    fc: Mapped[float | None] = mapped_column(Float, nullable=True)
    fy: Mapped[float | None] = mapped_column(Float, nullable=True)
    elastic_modulus: Mapped[float | None] = mapped_column(Float, nullable=True)
    poisson: Mapped[float | None] = mapped_column(Float, nullable=True)


class Section(Base):
    """Sección transversal. Parametrizada con JSONB para flexibilidad (rect, I, circ, T...)."""

    __tablename__ = "sections"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    material_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("materials.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # tipos válidos: "rectangular", "circular", "T", "I", "custom"
    shape: Mapped[str] = mapped_column(String(32), nullable=False)
    # Para rectangular: {"b": 0.3, "h": 0.5}. Para circular: {"d": 0.4}. Etc.
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
