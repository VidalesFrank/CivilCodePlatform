from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class BuildingRevisionPublic(BaseModel):
    id: UUID
    building_id: UUID
    revision_number: int
    source: str
    status: str
    notes: str | None
    forces_status: str = "none"
    forces_notes: str | None = None

    model_config = {"from_attributes": True}


class BuildingPublic(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    active_revision_id: UUID | None

    model_config = {"from_attributes": True}


class BuildingDetail(BuildingPublic):
    revisions: list[BuildingRevisionPublic]


class CreateBuildingRequest(BaseModel):
    project_id: UUID
    name: str = Field(min_length=1, max_length=255)


class LevelPublic(BaseModel):
    id: UUID
    name: str
    elevation: float
    height: float | None

    model_config = {"from_attributes": True}


class NodePublic(BaseModel):
    id: UUID
    tag: str
    x: float
    y: float
    z: float
    level_id: UUID | None

    model_config = {"from_attributes": True}


class ElementPublic(BaseModel):
    id: UUID
    tag: str
    kind: str
    level_id: UUID | None
    section_id: UUID | None
    node_i_id: UUID | None
    node_j_id: UUID | None
    properties: dict[str, Any]

    model_config = {"from_attributes": True}


class RevisionGeometry(BaseModel):
    levels: list[LevelPublic]
    nodes: list[NodePublic]
    elements: list[ElementPublic]
