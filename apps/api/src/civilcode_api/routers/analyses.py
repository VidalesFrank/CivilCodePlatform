from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..db import get_db
from ..models.analysis import AnalysisRun
from ..models.building import Building, BuildingRevision
from ..models.project import Project
from ..models.user import User
from ..schemas.analysis import AnalysisRunPublic, CreateAnalysisRequest
from ..tasks import dispatch_quick_check

router = APIRouter(tags=["analyses"])


SUPPORTED_KINDS = {"quick_check"}


async def _assert_revision_access(
    db: AsyncSession,
    user_id: UUID,
    building_id: UUID,
    revision_id: UUID,
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
    "/buildings/{building_id}/revisions/{revision_id}/analyses",
    response_model=list[AnalysisRunPublic],
)
async def list_analyses(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AnalysisRunPublic]:
    await _assert_revision_access(db, user.id, building_id, revision_id)
    runs = (
        await db.execute(
            select(AnalysisRun)
            .where(AnalysisRun.building_revision_id == revision_id)
            .order_by(AnalysisRun.created_at.desc())
        )
    ).scalars().all()
    return [AnalysisRunPublic.model_validate(r) for r in runs]


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/analyses",
    response_model=AnalysisRunPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_analysis(
    building_id: UUID,
    revision_id: UUID,
    body: CreateAnalysisRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnalysisRunPublic:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; debe estar 'imported' para analizar",
        )
    if body.kind not in SUPPORTED_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de análisis no soportado: '{body.kind}'. Soportados: {sorted(SUPPORTED_KINDS)}",
        )

    run = AnalysisRun(
        building_revision_id=revision_id,
        created_by_user_id=user.id,
        kind=body.kind,
        status="pending",
        inputs=body.inputs,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    await dispatch_quick_check(str(run.id))
    return AnalysisRunPublic.model_validate(run)


@router.get("/analyses/{run_id}", response_model=AnalysisRunPublic)
async def get_analysis(
    run_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnalysisRunPublic:
    from ..auth.membership import _require_membership

    run = (
        await db.execute(select(AnalysisRun).where(AnalysisRun.id == run_id))
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == run.building_revision_id))
    ).scalar_one_or_none()
    if revision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    building = (
        await db.execute(select(Building).where(Building.id == revision.building_id))
    ).scalar_one_or_none()
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none() if building else None
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user.id, project.organization_id)

    return AnalysisRunPublic.model_validate(run)
