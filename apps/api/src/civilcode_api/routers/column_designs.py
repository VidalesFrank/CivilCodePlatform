from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..db import get_db
from ..models.building import Building, BuildingRevision
from ..models.column_design import ColumnDesign
from ..models.element import Element
from ..models.project import Project
from ..models.structure import Level
from ..models.user import User
from ..schemas.column_design import (
    ColumnDesignPublic,
    CreateColumnDesignByLevelRequest,
    CreateColumnDesignRequest,
)
from ..tasks import dispatch_column_design

router = APIRouter(tags=["column-designs"])


async def _assert_revision_access(
    db: AsyncSession, user_id: UUID, building_id: UUID, revision_id: UUID
) -> BuildingRevision:
    from ..auth.membership import _require_membership

    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == revision_id))
    ).scalar_one_or_none()
    if revision is None or revision.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revisión no encontrada")
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
    "/buildings/{building_id}/revisions/{revision_id}/column-designs",
    response_model=list[ColumnDesignPublic],
)
async def list_column_designs(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ColumnDesignPublic]:
    await _assert_revision_access(db, user.id, building_id, revision_id)
    rows = (
        await db.execute(
            select(ColumnDesign)
            .where(ColumnDesign.building_revision_id == revision_id)
            .order_by(ColumnDesign.created_at.desc())
        )
    ).scalars().all()
    return [ColumnDesignPublic.model_validate(r) for r in rows]


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/column-designs",
    response_model=ColumnDesignPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_column_design(
    building_id: UUID,
    revision_id: UUID,
    body: CreateColumnDesignRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColumnDesignPublic:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; debe estar 'imported'.",
        )
    el_rows = (
        await db.execute(
            select(Element)
            .where(Element.id.in_(body.element_ids))
            .where(Element.building_revision_id == revision_id)
        )
    ).scalars().all()
    found_ids = {e.id for e in el_rows}
    missing = [str(eid) for eid in body.element_ids if eid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Elementos no encontrados en esta revisión: {missing[:5]}",
        )
    non_cols = [e.tag for e in el_rows if e.kind != "column"]
    if non_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hay elementos que no son columnas: {non_cols[:5]}",
        )

    design = ColumnDesign(
        building_revision_id=revision_id,
        created_by_user_id=user.id,
        name=body.name,
        element_ids=[str(eid) for eid in body.element_ids],
        config=body.config.model_dump(),
        status="pending",
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)
    await dispatch_column_design(str(design.id))
    return ColumnDesignPublic.model_validate(design)


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/column-designs/by-level",
    response_model=ColumnDesignPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_column_design_by_level(
    building_id: UUID,
    revision_id: UUID,
    body: CreateColumnDesignByLevelRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColumnDesignPublic:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; debe estar 'imported'.",
        )
    lev = (
        await db.execute(select(Level).where(Level.id == body.level_id))
    ).scalar_one_or_none()
    if lev is None or lev.building_revision_id != revision_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nivel no encontrado")

    cols = (
        await db.execute(
            select(Element)
            .where(Element.building_revision_id == revision_id)
            .where(Element.level_id == body.level_id)
            .where(Element.kind == "column")
        )
    ).scalars().all()
    if not cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El nivel '{lev.name}' no tiene columnas.",
        )

    design = ColumnDesign(
        building_revision_id=revision_id,
        created_by_user_id=user.id,
        name=f"{body.name_prefix} {lev.name}",
        element_ids=[str(b.id) for b in cols],
        config=body.config.model_dump(),
        status="pending",
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)
    await dispatch_column_design(str(design.id))
    return ColumnDesignPublic.model_validate(design)


@router.get("/column-designs/{design_id}", response_model=ColumnDesignPublic)
async def get_column_design(
    design_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColumnDesignPublic:
    from ..auth.membership import _require_membership

    design = (
        await db.execute(select(ColumnDesign).where(ColumnDesign.id == design_id))
    ).scalar_one_or_none()
    if design is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == design.building_revision_id))
    ).scalar_one_or_none()
    building = (
        await db.execute(select(Building).where(Building.id == revision.building_id))
    ).scalar_one_or_none() if revision else None
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none() if building else None
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user.id, project.organization_id)
    return ColumnDesignPublic.model_validate(design)
