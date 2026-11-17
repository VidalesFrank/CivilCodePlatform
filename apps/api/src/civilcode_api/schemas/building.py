from uuid import UUID

from pydantic import BaseModel, Field


class BuildingRevisionPublic(BaseModel):
    id: UUID
    building_id: UUID
    revision_number: int
    source: str
    status: str
    notes: str | None

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
