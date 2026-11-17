from uuid import UUID

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Level(Base):
    """Nivel/piso del edificio."""

    __tablename__ = "levels"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    elevation: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)


class Axis(Base):
    """Eje en planta (A, B, 1, 2...)."""

    __tablename__ = "axes"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    # "x" (vertical en planta) o "y" (horizontal en planta)
    direction: Mapped[str] = mapped_column(String(4), nullable=False)
    coordinate: Mapped[float] = mapped_column(Float, nullable=False)


class Node(Base):
    """Nodo con coordenada global."""

    __tablename__ = "nodes"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    level_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("levels.id", ondelete="SET NULL"), nullable=True
    )
    tag: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    z: Mapped[float] = mapped_column(Float, nullable=False)
