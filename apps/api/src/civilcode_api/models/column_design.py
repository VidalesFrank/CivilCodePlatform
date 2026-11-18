from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ColumnDesign(Base):
    """Diseño a flexo-compresión biaxial + cortante de columnas."""

    __tablename__ = "column_designs"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False, default="Columnas")
    element_ids: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True, default="pending")
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
