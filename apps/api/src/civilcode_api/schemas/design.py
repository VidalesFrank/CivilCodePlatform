from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class BeamDesignConfig(BaseModel):
    fc_mpa: float = Field(default=21.0, ge=14.0, le=70.0)
    fy_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    fys_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    cover_mm: float = Field(default=40.0, ge=15.0, le=100.0)
    ductility: str = Field(default="DMO", pattern="^(DES|DMO|Ninguna)$")
    live_load_kN_m2: float = Field(default=2.0, ge=0.0, le=20.0)
    dead_extra_kN_m2: float = Field(default=1.5, ge=0.0, le=20.0)
    tributary_width_m: float = Field(default=1.0, ge=0.1, le=20.0)


class CreateBeamDesignRequest(BaseModel):
    name: str = Field(default="Viga", min_length=1, max_length=128)
    element_ids: list[UUID] = Field(min_length=1)
    config: BeamDesignConfig = Field(default_factory=BeamDesignConfig)


class CreateDesignByLevelRequest(BaseModel):
    """Alternativa: diseña todas las vigas de un nivel con la misma config."""

    level_id: UUID
    config: BeamDesignConfig = Field(default_factory=BeamDesignConfig)
    name_prefix: str = Field(default="Vigas nivel")


class BeamDesignPublic(BaseModel):
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
