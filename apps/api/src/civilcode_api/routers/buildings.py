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
from ..models.element import Element
from ..models.project import Project
from ..models.structure import Level, Node
from ..models.user import User
from ..schemas.building import (
    BuildingDetail,
    BuildingPublic,
    BuildingRevisionPublic,
    CreateBuildingRequest,
    ElementPublic,
    LevelPublic,
    NodePublic,
    RevisionGeometry,
)
from ..models.element_force import ElementForce
from ..models.section import Section as SectionModel
from ..schemas.beam_groups import BeamGroupPublic, BeamGroupSpan, BeamGroupsResponse
from ..schemas.element_force import ForcesSummary
from ..storage import put_object
from ..tasks import dispatch_forces_import, dispatch_import

from engine.building.beam_grouping import FrameIn, group_frames

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


@router.get(
    "/{building_id}/revisions/{revision_id}/geometry",
    response_model=RevisionGeometry,
)
async def get_revision_geometry(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RevisionGeometry:
    """Geometría de una revisión importada: niveles, nodos y elementos."""
    from ..auth.membership import _require_membership

    revision = (
        await db.execute(select(BuildingRevision).where(BuildingRevision.id == revision_id))
    ).scalar_one_or_none()
    if revision is None or revision.building_id != building_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revisión no encontrada")
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; aún no hay geometría",
        )

    building = (
        await db.execute(select(Building).where(Building.id == building_id))
    ).scalar_one_or_none()
    project = (
        await db.execute(select(Project).where(Project.id == building.project_id))
    ).scalar_one_or_none() if building else None
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await _require_membership(db, user.id, project.organization_id)

    levels = (
        await db.execute(
            select(Level).where(Level.building_revision_id == revision_id).order_by(Level.elevation)
        )
    ).scalars().all()
    nodes = (
        await db.execute(
            select(Node).where(Node.building_revision_id == revision_id)
        )
    ).scalars().all()
    elements = (
        await db.execute(
            select(Element).where(Element.building_revision_id == revision_id)
        )
    ).scalars().all()

    return RevisionGeometry(
        levels=[LevelPublic.model_validate(x) for x in levels],
        nodes=[NodePublic.model_validate(x) for x in nodes],
        elements=[ElementPublic.model_validate(x) for x in elements],
    )


# ──────────────────────────────────────────────────────────────────────
# Element Forces (demandas) — carga desde XLSX exportado de ETABS
# ──────────────────────────────────────────────────────────────────────

FORCES_ALLOWED_EXTS = {".xlsx", ".xls"}


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


@router.post(
    "/{building_id}/revisions/{revision_id}/forces/upload",
    response_model=BuildingRevisionPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_forces(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> BuildingRevisionPublic:
    """Sube un XLSX de ETABS (hoja Element Forces - Beams) y encola su parseo."""
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La revisión debe estar 'imported' antes de cargar demandas (estado actual: '{revision.status}').",
        )

    name = file.filename or ""
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    if ext not in FORCES_ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no soportada. Permitidas: {', '.join(FORCES_ALLOWED_EXTS)}",
        )

    settings = get_settings()
    key = f"buildings/{building_id}/forces-rev{revision.revision_number}-{uuid4().hex}{ext}"
    put_object(
        settings.s3_bucket_sources,
        key,
        file.file,
        file.content_type or "application/octet-stream",
    )

    # Limpia demandas previas de esta revisión para que el import quede idempotente.
    await db.execute(
        ElementForce.__table__.delete().where(ElementForce.building_revision_id == revision_id)
    )

    revision.forces_file_key = key
    revision.forces_status = "queued"
    revision.forces_notes = f"Encolado: {name}"
    await db.commit()
    await db.refresh(revision)

    await dispatch_forces_import(str(revision_id))
    return BuildingRevisionPublic.model_validate(revision)


@router.get(
    "/{building_id}/revisions/{revision_id}/forces/summary",
    response_model=ForcesSummary,
)
async def get_forces_summary(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ForcesSummary:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)

    n_records = (
        await db.execute(
            select(func.count(ElementForce.id)).where(
                ElementForce.building_revision_id == revision_id
            )
        )
    ).scalar_one()
    n_elements = (
        await db.execute(
            select(func.count(func.distinct(ElementForce.element_tag))).where(
                ElementForce.building_revision_id == revision_id
            )
        )
    ).scalar_one()
    cases_rows = (
        await db.execute(
            select(ElementForce.output_case)
            .where(ElementForce.building_revision_id == revision_id)
            .distinct()
            .order_by(ElementForce.output_case)
        )
    ).scalars().all()
    cases = [str(c) for c in cases_rows]

    return ForcesSummary(
        status=revision.forces_status,
        notes=revision.forces_notes,
        n_records=int(n_records),
        n_elements_with_forces=int(n_elements),
        n_load_cases=len(cases),
        load_cases=cases,
    )


# ──────────────────────────────────────────────────────────────────────
# Detección de vigas continuas (BeamGroups) por nivel
# ──────────────────────────────────────────────────────────────────────


@router.get(
    "/{building_id}/revisions/{revision_id}/beam-groups",
    response_model=BeamGroupsResponse,
)
async def detect_beam_groups(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    level_id: UUID | None = None,
) -> BeamGroupsResponse:
    """Agrupa elementos beam colineales y conectados en vigas continuas."""
    await _assert_revision_access(db, user.id, building_id, revision_id)

    stmt_el = select(Element).where(
        Element.building_revision_id == revision_id, Element.kind == "beam"
    )
    if level_id is not None:
        stmt_el = stmt_el.where(Element.level_id == level_id)
    elements = (await db.execute(stmt_el)).scalars().all()

    if not elements:
        return BeamGroupsResponse(level_id=level_id, n_beams=0, n_groups=0, groups=[])

    # Nodos
    node_ids = {e.node_i_id for e in elements if e.node_i_id} | {
        e.node_j_id for e in elements if e.node_j_id
    }
    nodes_rows = (
        await db.execute(select(Node).where(Node.id.in_(node_ids)))
    ).scalars().all() if node_ids else []
    node_by_id = {n.id: n for n in nodes_rows}

    # Sections (para nombre)
    section_ids = {e.section_id for e in elements if e.section_id}
    section_name_by_id: dict[UUID, str] = {}
    if section_ids:
        rows = (
            await db.execute(select(SectionModel).where(SectionModel.id.in_(section_ids)))
        ).scalars().all()
        section_name_by_id = {s.id: s.name for s in rows}

    # Construye FrameIn
    frames: list[FrameIn] = []
    for e in elements:
        if not e.node_i_id or not e.node_j_id:
            continue
        ni = node_by_id.get(e.node_i_id)
        nj = node_by_id.get(e.node_j_id)
        if ni is None or nj is None:
            continue
        frames.append(
            FrameIn(
                id=str(e.id),
                tag=str(e.tag),
                level_id=str(e.level_id) if e.level_id else None,
                section_name=section_name_by_id.get(e.section_id) if e.section_id else None,
                ni_id=str(e.node_i_id),
                nj_id=str(e.node_j_id),
                ni=(float(ni.x), float(ni.y), float(ni.z)),
                nj=(float(nj.x), float(nj.y), float(nj.z)),
            )
        )

    groups = group_frames(frames)

    return BeamGroupsResponse(
        level_id=level_id,
        n_beams=len(elements),
        n_groups=len(groups),
        groups=[
            BeamGroupPublic(
                id=g.id,
                level_id=UUID(g.level_id) if g.level_id else None,
                total_length_m=round(g.total_length_m, 3),
                n_spans=len(g.elements),
                direction=g.direction,
                origin=g.origin,
                end=g.end,
                supports_m=[round(s, 3) for s in g.supports_m],
                spans=[
                    BeamGroupSpan(
                        element_id=UUID(eg.element_id),
                        tag=eg.tag,
                        section_name=eg.section_name,
                        offset_m=round(eg.offset_m, 3),
                        length_m=round(eg.length_m, 3),
                        flipped=eg.flipped,
                        ni=eg.ni,
                        nj=eg.nj,
                    )
                    for eg in g.elements
                ],
            )
            for g in groups
        ],
    )
