from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..auth.membership import require_project_access
from ..config import get_settings
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
from ..storage import put_object
from ..tasks import dispatch_import

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


ALLOWED_EXTS = {".e2k": "etabs_e2k", ".xlsx": "etabs_xlsx"}


@router.post(
    "/{building_id}/revisions/upload",
    response_model=BuildingRevisionPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_building_revision(
    building_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
) -> BuildingRevisionPublic:
    from ..auth.membership import _require_membership

    building = (
        await db.execute(select(Building).where(Building.id == building_id))
    ).scalar_one_or_none()
    if building is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Edificio no encontrado")
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user.id, project.organization_id)

    name = file.filename or ""
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extension no soportada. Permitidas: {', '.join(ALLOWED_EXTS)}",
        )

    # Siguiente revision_number para este building
    max_rev = (
        await db.execute(
            select(func.coalesce(func.max(BuildingRevision.revision_number), 0)).where(
                BuildingRevision.building_id == building_id
            )
        )
    ).scalar_one()
    next_num = int(max_rev) + 1

    settings = get_settings()
    key = f"buildings/{building_id}/rev-{next_num}-{uuid4().hex}{ext}"
    put_object(
        settings.s3_bucket_sources,
        key,
        file.file,
        file.content_type or "application/octet-stream",
    )

    revision = BuildingRevision(
        building_id=building_id,
        created_by_user_id=user.id,
        revision_number=next_num,
        source=ALLOWED_EXTS[ext],
        status="draft",
        source_file_key=key,
        notes=f"Upload de {name}",
    )
    db.add(revision)
    await db.flush()  # Asigna revision.id antes de referenciarlo en el building
    building.active_revision_id = revision.id
    await db.commit()
    await db.refresh(revision)
    return BuildingRevisionPublic.model_validate(revision)


@router.post(
    "/{building_id}/revisions/{revision_id}/import",
    response_model=BuildingRevisionPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def dispatch_revision_import(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuildingRevisionPublic:
    """Encola la task Celery de import para una revisión draft."""
    from ..auth.membership import _require_membership

    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == revision_id))
    ).scalar_one_or_none()
    if revision is None or revision.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revisión no encontrada")

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

    if revision.status not in ("draft", "invalid"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede reimportar una revisión en estado '{revision.status}'",
        )

    revision.status = "queued"
    revision.notes = "Encolada para import"
    await db.commit()
    await db.refresh(revision)

    await dispatch_import(str(revision_id))
    return BuildingRevisionPublic.model_validate(revision)
