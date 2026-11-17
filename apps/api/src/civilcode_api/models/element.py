from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Element(Base):
    """Elemento estructural (viga, columna, muro, losa, zapata, nervio)."""

    __tablename__ = "elements"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tag: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # kinds válidos: "beam", "column", "wall", "slab", "footing", "joist"
    kind: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    section_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sections.id", ondelete="SET NULL"), nullable=True
    )
    level_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("levels.id", ondelete="SET NULL"), nullable=True
    )
    node_i_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True
    )
    node_j_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True
    )

    # Geometría extra, orientación, modificadores, flags de cálculo, etc.
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
