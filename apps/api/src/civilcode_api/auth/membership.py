"""Guardas de autorización basadas en Membership (user ↔ organization)."""

import re
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.organization import Membership, Organization
from ..models.project import Project
from ..models.user import User
from .dependencies import get_current_user


async def _require_membership(
    db: AsyncSession, user_id: UUID, organization_id: UUID
) -> Membership:
    stmt = select(Membership).where(
        Membership.user_id == user_id, Membership.organization_id == organization_id
    )
    result = await db.execute(stmt)
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a esta organización",
        )
    return m


async def require_org_membership(
    organization_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Membership:
    return await _require_membership(db, user.id, organization_id)


async def require_project_access(
    project_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    await _require_membership(db, user.id, project.organization_id)
    return project


_SLUG_INVALID = re.compile(r"[^a-z0-9]+")


def _email_to_slug(email: str) -> str:
    local = email.split("@")[0].lower()
    slug = _SLUG_INVALID.sub("-", local).strip("-")
    return slug or "user"


async def provision_personal_org(db: AsyncSession, user: User) -> Organization:
    """Crea Organization personal + Membership owner para un nuevo user.

    No hace commit — se asume que el caller (router de register) hace commit atomico.
    """
    base_slug = _email_to_slug(user.email)
    slug = base_slug
    suffix = 1
    # Resolver colisión de slug probando -2, -3, ...
    while True:
        existing = await db.execute(select(Organization).where(Organization.slug == slug))
        if existing.scalar_one_or_none() is None:
            break
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    org = Organization(name=user.full_name or user.email, slug=slug, is_personal=True)
    db.add(org)
    await db.flush()  # para tener org.id antes de crear Membership
    db.add(Membership(user_id=user.id, organization_id=org.id, role="owner"))
    return org
