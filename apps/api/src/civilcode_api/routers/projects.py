from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..auth.membership import _require_membership, require_project_access
from ..db import get_db
from ..models.organization import Membership
from ..models.project import Project
from ..models.user import User
from ..schemas.project import CreateProjectRequest, ProjectPublic, UpdateProjectRequest

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectPublic])
async def list_projects(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    organization_id: UUID | None = Query(default=None),
) -> list[ProjectPublic]:
    # Lista proyectos de organizaciones donde el user es miembro.
    # Si organization_id dado, filtra a esa org (valida membership).
    org_stmt = select(Membership.organization_id).where(Membership.user_id == user.id)
    if organization_id is not None:
        await _require_membership(db, user.id, organization_id)
        stmt = select(Project).where(Project.organization_id == organization_id)
    else:
        stmt = select(Project).where(Project.organization_id.in_(org_stmt))
    stmt = stmt.order_by(Project.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [ProjectPublic.model_validate(p) for p in rows]


@router.post("", response_model=ProjectPublic, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: CreateProjectRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectPublic:
    await _require_membership(db, user.id, body.organization_id)
    project = Project(
        organization_id=body.organization_id,
        created_by_user_id=user.id,
        code=body.code,
        name=body.name,
        client=body.client,
        location=body.location,
        description=body.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.get("/{project_id}", response_model=ProjectPublic)
async def get_project(
    project: Annotated[Project, Depends(require_project_access)],
) -> ProjectPublic:
    return ProjectPublic.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectPublic)
async def update_project(
    body: UpdateProjectRequest,
    project: Annotated[Project, Depends(require_project_access)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectPublic:
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return ProjectPublic.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project: Annotated[Project, Depends(require_project_access)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await db.delete(project)
    await db.commit()
