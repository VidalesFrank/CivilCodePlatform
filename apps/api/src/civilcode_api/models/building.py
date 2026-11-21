from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Building(Base):
    """Edificio dentro de un proyecto. Puede tener múltiples BuildingRevision."""

    __tablename__ = "buildings"

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Revisión "activa" (la que se muestra por default). Null si no hay revisiones aún.
    active_revision_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="SET NULL", use_alter=True, name="fk_building_active_revision"),
        nullable=True,
    )

    project: Mapped["Project"] = relationship(back_populates="buildings")
    revisions: Mapped[list["BuildingRevision"]] = relationship(
        back_populates="building",
        cascade="all, delete-orphan",
        foreign_keys="BuildingRevision.building_id",
    )


class BuildingRevision(Base):
    """Snapshot inmutable del modelo estructural (resultado de un import o edición)."""

    __tablename__ = "building_revisions"

    building_id: Mapped[UUID] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    revision_number: Mapped[int] = mapped_column(nullable=False, default=1)
    # fuentes válidas: "etabs_e2k", "etabs_xlsx", "manual"
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    # estados válidos: "draft", "importing", "imported", "invalid"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    source_file_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Demandas (Element Forces) importadas opcionalmente desde Excel de ETABS.
    forces_file_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # estados: "none", "queued", "importing", "loaded", "invalid"
    forces_status: Mapped[str] = mapped_column(String(32), nullable=False, default="none")
    forces_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    building: Mapped["Building"] = relationship(
        back_populates="revisions", foreign_keys=[building_id]
    )
