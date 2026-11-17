from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..auth.membership import require_project_access
from ..db import get_db
from ..models.building import Building, BuildingRevision
from ..models.project import Project
from ..models.user import User
from ..schemas.building import (
    BuildingDetail,
    BuildingPublic,
    BuildingRevisionPublic,
    CreateBuildingRequest,
)

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("", response_model=list[BuildingPublic])
async def list_buildings_by_project(
    project: Annotated[Project, Depends(require_project_access)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BuildingPublic]:
    stmt = (
        select(Building).where(Building.project_id == project.id).order_by(Building.created_at)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [BuildingPublic.model_validate(b) for b in rows]


@router.post("", response_model=BuildingPublic, status_code=status.HTTP_201_CREATED)
async def create_building(
    body: CreateBuildingRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuildingPublic:
    # Valida acceso al proyecto via require_project_access manual
    from ..auth.membership import _require_membership

    result = await db.execute(select(Project).where(Project.id == body.project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    await _require_membership(db, user.id, project.organization_id)

    building = Building(project_id=body.project_id, name=body.name, active_revision_id=None)
    db.add(building)
    await db.commit()
    await db.refresh(building)
    return BuildingPublic.model_validate(building)


@router.get("/{building_id}", response_model=BuildingDetail)
async def get_building_detail(
    building_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuildingDetail:
    from ..auth.membership import _require_membership

    building = (
        await db.execute(select(Building).where(Building.id == building_id))
    ).scalar_one_or_none()
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user.id, project.organization_id)

    revs = (
        await db.execute(
            select(BuildingRevision)
            .where(BuildingRevision.building_id == building_id)
            .order_by(BuildingRevision.revision_number.desc())
        )
    ).scalars().all()

    return BuildingDetail(
        id=building.id,
        project_id=building.project_id,
        name=building.name,
        active_revision_id=building.active_revision_id,
        revisions=[BuildingRevisionPublic.model_validate(r) for r in revs],
    )
