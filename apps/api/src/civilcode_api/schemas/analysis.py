from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CreateAnalysisRequest(BaseModel):
    kind: str = Field(
        default="quick_check",
        description="Tipo de análisis. Soportados: quick_check.",
    )
    inputs: dict[str, Any] = Field(default_factory=dict)


class AnalysisRunPublic(BaseModel):
    id: UUID
    building_revision_id: UUID
    created_by_user_id: UUID
    kind: str
    status: str
    inputs: dict[str, Any]
    result_summary: dict[str, Any] | None
    log: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
