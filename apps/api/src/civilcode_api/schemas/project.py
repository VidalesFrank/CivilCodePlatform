from uuid import UUID

from pydantic import BaseModel, Field


class ProjectPublic(BaseModel):
    id: UUID
    organization_id: UUID
    code: str
    name: str
    client: str | None
    location: str | None
    description: str | None

    model_config = {"from_attributes": True}


class CreateProjectRequest(BaseModel):
    organization_id: UUID
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    client: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    client: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None
