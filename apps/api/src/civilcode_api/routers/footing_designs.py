from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..db import get_db
from ..models.building import Building, BuildingRevision
from ..models.element import Element
from ..models.footing_design import FootingDesign
from ..models.project import Project
from ..models.structure import Level
from ..models.user import User
from ..schemas.footing_design import (
    CreateFootingDesignByLevelRequest,
    FootingDesignPublic,
)
from ..tasks import dispatch_footing_design

router = APIRouter(tags=["footing-designs"])


async def _assert_revision_access(
    db: AsyncSession, user_id: UUID, building_id: UUID, revision_id: UUID
) -> BuildingRevision:
    from ..auth.membership import _require_membership

    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == revision_id))
    ).scalar_one_or_none()
    if revision is None or revision.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    building = (
        await db.execute(select(Building).where(Building.id == building_id))
    ).scalar_one_or_none()
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none() if building else None
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user_id, project.organization_id)
    return revision


@router.get(
    "/buildings/{building_id}/revisions/{revision_id}/footing-designs",
    response_model=list[FootingDesignPublic],
)
async def list_footing_designs(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[FootingDesignPublic]:
    await _assert_revision_access(db, user.id, building_id, revision_id)
    rows = (
        await db.execute(
            select(FootingDesign)
            .where(FootingDesign.building_revision_id == revision_id)
            .order_by(FootingDesign.created_at.desc())
        )
    ).scalars().all()
    return [FootingDesignPublic.model_validate(r) for r in rows]


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/footing-designs/by-level",
    response_model=FootingDesignPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_footing_design_by_level(
    building_id: UUID,
    revision_id: UUID,
    body: CreateFootingDesignByLevelRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FootingDesignPublic:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; debe estar 'imported'.",
        )
    lev = (await db.execute(select(Level).where(Level.id == body.level_id))).scalar_one_or_none()
    if lev is None or lev.building_revision_id != revision_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nivel no encontrado")
    # Footings son columnas típicamente — buscamos elementos kind='column' del nivel base.
    # O usar kind='footing' si el import lo marca. Por ahora soportamos ambos.
    cols = (
        await db.execute(
            select(Element)
            .where(Element.building_revision_id == revision_id)
            .where(Element.level_id == body.level_id)
            .where(Element.kind.in_(("footing", "column")))
        )
    ).scalars().all()
    if not cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El nivel '{lev.name}' no tiene columnas/zapatas para diseñar.",
        )
    design = FootingDesign(
        building_revision_id=revision_id,
        created_by_user_id=user.id,
        name=f"{body.name_prefix} {lev.name}",
        element_ids=[str(c.id) for c in cols],
        config=body.config.model_dump(),
        status="pending",
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)
    await dispatch_footing_design(str(design.id))
    return FootingDesignPublic.model_validate(design)
