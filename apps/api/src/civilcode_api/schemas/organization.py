from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationPublic(BaseModel):
    id: UUID
    name: str
    slug: str
    is_personal: bool

    model_config = {"from_attributes": True}


class MembershipPublic(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str

    model_config = {"from_attributes": True}


class OrganizationWithRole(OrganizationPublic):
    role: str


class CreateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$")
