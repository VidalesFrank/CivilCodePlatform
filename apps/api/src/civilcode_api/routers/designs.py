from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..db import get_db
from ..models.building import Building, BuildingRevision
from ..models.design import BeamDesign
from ..models.element import Element
from ..models.project import Project
from ..models.structure import Level
from ..models.user import User
from ..schemas.design import (
    BeamDesignPublic,
    CreateBeamDesignRequest,
    CreateDesignByLevelRequest,
)
from ..services.dxf_export import generate_beam_design_dxf
from ..services.pdf_report import generate_beam_design_pdf
from ..tasks import dispatch_beam_design

router = APIRouter(tags=["designs"])


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
    "/buildings/{building_id}/revisions/{revision_id}/beam-designs",
    response_model=list[BeamDesignPublic],
)
async def list_beam_designs(
    building_id: UUID,
    revision_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BeamDesignPublic]:
    await _assert_revision_access(db, user.id, building_id, revision_id)
    rows = (
        await db.execute(
            select(BeamDesign)
            .where(BeamDesign.building_revision_id == revision_id)
            .order_by(BeamDesign.created_at.desc())
        )
    ).scalars().all()
    return [BeamDesignPublic.model_validate(r) for r in rows]


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/beam-designs",
    response_model=BeamDesignPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_beam_design(
    building_id: UUID,
    revision_id: UUID,
    body: CreateBeamDesignRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BeamDesignPublic:
    revision = await _assert_revision_access(db, user.id, building_id, revision_id)
    if revision.status != "imported":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Revisión en estado '{revision.status}'; debe estar 'imported'.",
        )

    # Validar que los elementos existan, sean beams, y pertenezcan a esta revisión
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
    non_beams = [e.tag for e in el_rows if e.kind != "beam"]
    if non_beams:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hay elementos que no son vigas: {non_beams[:5]}",
        )

    design = BeamDesign(
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

    await dispatch_beam_design(str(design.id))
    return BeamDesignPublic.model_validate(design)


@router.post(
    "/buildings/{building_id}/revisions/{revision_id}/beam-designs/by-level",
    response_model=BeamDesignPublic,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_beam_design_by_level(
    building_id: UUID,
    revision_id: UUID,
    body: CreateDesignByLevelRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BeamDesignPublic:
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

    beams = (
        await db.execute(
            select(Element)
            .where(Element.building_revision_id == revision_id)
            .where(Element.level_id == body.level_id)
            .where(Element.kind == "beam")
        )
    ).scalars().all()
    if not beams:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El nivel '{lev.name}' no tiene vigas.",
        )

    design = BeamDesign(
        building_revision_id=revision_id,
        created_by_user_id=user.id,
        name=f"{body.name_prefix} {lev.name}",
        element_ids=[str(b.id) for b in beams],
        config=body.config.model_dump(),
        status="pending",
    )
    db.add(design)
    await db.commit()
    await db.refresh(design)

    await dispatch_beam_design(str(design.id))
    return BeamDesignPublic.model_validate(design)


async def _load_design_with_access(
    db: AsyncSession, user_id: UUID, design_id: UUID
) -> BeamDesign:
    from ..auth.membership import _require_membership

    design = (
        await db.execute(select(BeamDesign).where(BeamDesign.id == design_id))
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
    await _require_membership(db, user_id, project.organization_id)
    return design


@router.get("/beam-designs/{design_id}", response_model=BeamDesignPublic)
async def get_beam_design(
    design_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BeamDesignPublic:
    design = await _load_design_with_access(db, user.id, design_id)
    return BeamDesignPublic.model_validate(design)


@router.get("/beam-designs/{design_id}/export/dxf")
async def export_beam_design_dxf(
    design_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    design = await _load_design_with_access(db, user.id, design_id)
    if not design.status.startswith("completed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Diseño en estado '{design.status}'. Debe estar completed para exportar.",
        )
    result = design.result_summary or {}
    elements = result.get("elements", [])
    payload = {"name": design.name, "config": design.config}
    dxf_bytes = generate_beam_design_dxf(payload, elements)
    filename = f"beam-design-{design.name.replace(' ', '_')[:40]}-{design.id.hex[:8]}.dxf"
    return Response(
        content=dxf_bytes,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/beam-designs/{design_id}/export/pdf")
async def export_beam_design_pdf(
    design_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    design = await _load_design_with_access(db, user.id, design_id)
    if not design.status.startswith("completed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Diseño en estado '{design.status}'. Debe estar completed para exportar.",
        )
    payload = {"name": design.name, "config": design.config}
    pdf_bytes = generate_beam_design_pdf(payload, design.result_summary or {})
    filename = f"memoria-{design.name.replace(' ', '_')[:40]}-{design.id.hex[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
