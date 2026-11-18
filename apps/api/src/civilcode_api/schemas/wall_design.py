from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class WallDesignConfig(BaseModel):
    fc_mpa: float = Field(default=28.0, ge=14.0, le=70.0)
    fy_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    cover_mm: float = Field(default=20.0, ge=15.0, le=100.0)
    ductility: str = Field(default="DMO", pattern="^(DES|DMO|Ninguna)$")
    rho_h_target: float = Field(default=0.0025, ge=0.0012, le=0.02)
    rho_v_target: float = Field(default=0.0025, ge=0.0012, le=0.02)
    # Demandas (override)
    Pu_kN: float = Field(default=500.0, ge=0.0)
    Vu_kN: float = Field(default=150.0, ge=0.0)
    Mu_kNm: float = Field(default=200.0, ge=0.0)
    # Geometría (override si section/elements no la tienen)
    t_cm: float | None = None
    Lw_cm: float | None = None
    hw_cm: float | None = None


class CreateWallDesignByLevelRequest(BaseModel):
    level_id: UUID
    config: WallDesignConfig = Field(default_factory=WallDesignConfig)
    name_prefix: str = Field(default="Muros nivel")


class WallDesignPublic(BaseModel):
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
