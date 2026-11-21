from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AnalysisRun(Base):
    """Ejecución de análisis sobre una revisión importada.

    kind: 'quick_check' (métricas geométricas/de masa; no OpenSees),
          'linear_static' (futuro: OpenSees estático lineal),
          'modal', 'response_spectrum', etc.
    status: 'pending', 'running', 'completed', 'failed'.
    """

    __tablename__ = "analysis_runs"

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True, default="pending")

    inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    log: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
