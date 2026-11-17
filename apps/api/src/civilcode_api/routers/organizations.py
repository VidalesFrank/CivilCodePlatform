from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..auth.membership import require_org_membership
from ..db import get_db
from ..models.organization import Membership, Organization
from ..models.user import User
from ..schemas.organization import (
    CreateOrganizationRequest,
    MembershipPublic,
    OrganizationPublic,
    OrganizationWithRole,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationWithRole])
async def list_my_organizations(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[OrganizationWithRole]:
    stmt = (
        select(Organization, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id)
        .order_by(Organization.created_at)
    )
    rows = (await db.execute(stmt)).all()
    return [
        OrganizationWithRole(
            id=org.id, name=org.name, slug=org.slug, is_personal=org.is_personal, role=role
        )
        for org, role in rows
    ]


@router.post("", response_model=OrganizationPublic, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: CreateOrganizationRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationPublic:
    exists = await db.execute(select(Organization).where(Organization.slug == body.slug))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug ya existe")

    org = Organization(name=body.name, slug=body.slug, is_personal=False)
    db.add(org)
    await db.flush()
    db.add(Membership(user_id=user.id, organization_id=org.id, role="owner"))
    await db.commit()
    await db.refresh(org)
    return OrganizationPublic.model_validate(org)


@router.get("/{organization_id}", response_model=OrganizationPublic)
async def get_organization(
    organization_id: UUID,
    _: Annotated[Membership, Depends(require_org_membership)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrganizationPublic:
    result = await db.execute(select(Organization).where(Organization.id == organization_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return OrganizationPublic.model_validate(org)


class _MemberRow(MembershipPublic):
    email: str
    full_name: str


@router.get("/{organization_id}/members", response_model=list[_MemberRow])
async def list_members(
    organization_id: UUID,
    _: Annotated[Membership, Depends(require_org_membership)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[_MemberRow]:
    from ..models.user import User as UserModel

    stmt = (
        select(Membership, UserModel.email, UserModel.full_name)
        .join(UserModel, UserModel.id == Membership.user_id)
        .where(Membership.organization_id == organization_id)
        .order_by(Membership.created_at)
    )
    rows = (await db.execute(stmt)).all()
    return [
        _MemberRow(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            email=email,
            full_name=full_name,
        )
        for m, email, full_name in rows
    ]
