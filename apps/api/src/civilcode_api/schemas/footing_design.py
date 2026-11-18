from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FootingDesignConfig(BaseModel):
    fc_mpa: float = Field(default=21.0, ge=14.0, le=70.0)
    fy_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    cover_mm: float = Field(default=75.0, ge=50.0, le=150.0)
    Pu_kN: float = Field(default=800.0, ge=0.0)
    P_serv_kN: float | None = None
    q_adm_kPa: float = Field(default=150.0, gt=0.0, le=1000.0)
    gamma_soil_kN_m3: float = Field(default=18.0, gt=0.0)
    overburden_depth_m: float = Field(default=1.0, ge=0.0)
    bc_cm: float = Field(default=40.0, gt=0.0)
    hc_cm: float = Field(default=40.0, gt=0.0)


class CreateFootingDesignByLevelRequest(BaseModel):
    level_id: UUID
    config: FootingDesignConfig = Field(default_factory=FootingDesignConfig)
    name_prefix: str = Field(default="Zapatas nivel")


class FootingDesignPublic(BaseModel):
    id: UUID
    building_revision_id: UUID
    created_by_user_id: UUID
    name: str
    element_ids: list[UUID]
    config: dict[str, Any]
    status: str
    result_summary: dict[str, Any] | None
    log: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
