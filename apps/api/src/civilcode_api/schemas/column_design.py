from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ColumnDesignConfig(BaseModel):
    fc_mpa: float = Field(default=28.0, ge=14.0, le=70.0)
    fy_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    fys_mpa: float = Field(default=420.0, ge=240.0, le=550.0)
    cover_mm: float = Field(default=40.0, ge=15.0, le=100.0)
    ductility: str = Field(default="DMO", pattern="^(DES|DMO|Ninguna)$")
    rho_long_target: float = Field(default=0.015, ge=0.01, le=0.08)
    tributary_area_m2: float = Field(default=20.0, ge=1.0, le=200.0)
    levels_above: int = Field(default=1, ge=1, le=50)
    dead_slab_kN_m2: float = Field(default=5.0, ge=0.0, le=30.0)
    live_kN_m2: float = Field(default=2.0, ge=0.0, le=20.0)
    # Demandas directas (override): si están, no se usan las estimadas
    Pu_kN: float | None = None
    Mux_kNm: float | None = None
    Muy_kNm: float | None = None
    Vu_kN: float | None = None


class CreateColumnDesignByLevelRequest(BaseModel):
    level_id: UUID
    config: ColumnDesignConfig = Field(default_factory=ColumnDesignConfig)
    name_prefix: str = Field(default="Columnas nivel")


class CreateColumnDesignRequest(BaseModel):
    name: str = Field(default="Columnas", min_length=1, max_length=128)
    element_ids: list[UUID] = Field(min_length=1)
    config: ColumnDesignConfig = Field(default_factory=ColumnDesignConfig)


class ColumnDesignPublic(BaseModel):
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
