from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class BeamDesign(Base):
    """Diseño a flexión + corte de una viga (o grupo continuo de vigas).

    element_ids: lista de UUIDs de Element (kind='beam') que forman la viga
    continua a diseñar. Se guarda en JSONB para no tener tabla pivote por ahora.
    config: fc_mpa, fy_mpa, fys_mpa, cover_mm, ductility (DES|DMO|Ninguna),
            live_load_kN_m (si no hay análisis real).
    result_summary: zonas con As_req, barras seleccionadas, φMn, ρ checks, warnings.
    """

    __tablename__ = "beam_designs"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Viga")
    element_ids: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True, default="pending")
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
