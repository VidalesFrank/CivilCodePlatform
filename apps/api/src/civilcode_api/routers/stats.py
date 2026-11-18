from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..db import get_db
from ..models.analysis import AnalysisRun
from ..models.building import Building, BuildingRevision
from ..models.design import BeamDesign
from ..models.organization import Membership
from ..models.project import Project
from ..models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


class RecentActivityItem(BaseModel):
    kind: str  # "import" | "analysis" | "design"
    label: str
    project_name: str | None = None
    project_id: UUID | None = None
    building_id: UUID | None = None
    revision_id: UUID | None = None
    status: str | None = None
    created_at: str


class OverviewStats(BaseModel):
    n_projects: int
    n_buildings: int
    n_revisions_total: int
    n_revisions_imported: int
    n_analyses_total: int
    n_analyses_completed: int
    n_designs_total: int
    n_designs_completed: int
    recent_activity: list[RecentActivityItem]


@router.get("/overview", response_model=OverviewStats)
async def overview_stats(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    project_id: UUID | None = None,
) -> OverviewStats:
    """Stats agregadas visibles al usuario (filtradas por orgs a las que pertenece).

    Si project_id está presente, restringe a ese proyecto (y valida acceso).
    """
    # Orgs del usuario
    org_ids = (
        await db.execute(
            select(Membership.organization_id).where(Membership.user_id == user.id)
        )
    ).scalars().all()

    if not org_ids:
        return OverviewStats(
            n_projects=0,
            n_buildings=0,
            n_revisions_total=0,
            n_revisions_imported=0,
            n_analyses_total=0,
            n_analyses_completed=0,
            n_designs_total=0,
            n_designs_completed=0,
            recent_activity=[],
        )

    # Proyectos del usuario
    project_ids_q = select(Project.id).where(Project.organization_id.in_(org_ids))
    if project_id is not None:
        project_ids_q = project_ids_q.where(Project.id == project_id)
    project_ids = (await db.execute(project_ids_q)).scalars().all()

    n_projects = len(project_ids)

    if not project_ids:
        return OverviewStats(
            n_projects=0,
            n_buildings=0,
            n_revisions_total=0,
            n_revisions_imported=0,
            n_analyses_total=0,
            n_analyses_completed=0,
            n_designs_total=0,
            n_designs_completed=0,
            recent_activity=[],
        )

    building_ids_q = select(Building.id).where(Building.project_id.in_(project_ids))
    building_ids = (await db.execute(building_ids_q)).scalars().all()
    n_buildings = len(building_ids)

    revision_ids: list[UUID] = []
    n_revisions_imported = 0
    if building_ids:
        rev_rows = (
            await db.execute(
                select(BuildingRevision.id, BuildingRevision.status).where(
                    BuildingRevision.building_id.in_(building_ids)
                )
            )
        ).all()
        revision_ids = [r[0] for r in rev_rows]
        n_revisions_imported = sum(1 for r in rev_rows if r[1] == "imported")

    n_revisions_total = len(revision_ids)

    # Análisis
    n_analyses_total = 0
    n_analyses_completed = 0
    if revision_ids:
        n_analyses_total = (
            await db.execute(
                select(func.count())
                .select_from(AnalysisRun)
                .where(AnalysisRun.building_revision_id.in_(revision_ids))
            )
        ).scalar_one()
        n_analyses_completed = (
            await db.execute(
                select(func.count())
                .select_from(AnalysisRun)
                .where(AnalysisRun.building_revision_id.in_(revision_ids))
                .where(AnalysisRun.status == "completed")
            )
        ).scalar_one()

    # Diseños de vigas
    n_designs_total = 0
    n_designs_completed = 0
    if revision_ids:
        n_designs_total = (
            await db.execute(
                select(func.count())
                .select_from(BeamDesign)
                .where(BeamDesign.building_revision_id.in_(revision_ids))
            )
        ).scalar_one()
        n_designs_completed = (
            await db.execute(
                select(func.count())
                .select_from(BeamDesign)
                .where(BeamDesign.building_revision_id.in_(revision_ids))
                .where(BeamDesign.status.in_(["completed", "completed_with_warnings"]))
            )
        ).scalar_one()

    # Actividad reciente: últimos 8 eventos entre revisiones, análisis, diseños
    recent: list[RecentActivityItem] = []
    project_name_by_id: dict[UUID, str] = {}
    if project_ids:
        for pid, pname in (
            await db.execute(
                select(Project.id, Project.name).where(Project.id.in_(project_ids))
            )
        ).all():
            project_name_by_id[pid] = pname

    if revision_ids:
        rev_rows = (
            await db.execute(
                select(
                    BuildingRevision.id,
                    BuildingRevision.building_id,
                    BuildingRevision.revision_number,
                    BuildingRevision.status,
                    BuildingRevision.created_at,
                    Building.name,
                    Building.project_id,
                )
                .join(Building, BuildingRevision.building_id == Building.id)
                .where(BuildingRevision.id.in_(revision_ids))
                .order_by(BuildingRevision.created_at.desc())
                .limit(10)
            )
        ).all()
        for rev_id, b_id, n, st, ca, bname, pid in rev_rows:
            recent.append(
                RecentActivityItem(
                    kind="import",
                    label=f"{bname} rev #{n}",
                    status=st,
                    project_id=pid,
                    project_name=project_name_by_id.get(pid),
                    building_id=b_id,
                    revision_id=rev_id,
                    created_at=ca.isoformat(),
                )
            )

        ana_rows = (
            await db.execute(
                select(AnalysisRun, Building, Project)
                .join(BuildingRevision, AnalysisRun.building_revision_id == BuildingRevision.id)
                .join(Building, BuildingRevision.building_id == Building.id)
                .join(Project, Building.project_id == Project.id)
                .where(BuildingRevision.id.in_(revision_ids))
                .order_by(AnalysisRun.created_at.desc())
                .limit(10)
            )
        ).all()
        for ar, b, p in ana_rows:
            recent.append(
                RecentActivityItem(
                    kind="analysis",
                    label=f"{b.name} · {ar.kind}",
                    status=ar.status,
                    project_id=p.id,
                    project_name=p.name,
                    building_id=b.id,
                    revision_id=ar.building_revision_id,
                    created_at=ar.created_at.isoformat(),
                )
            )

        design_rows = (
            await db.execute(
                select(BeamDesign, Building, Project)
                .join(BuildingRevision, BeamDesign.building_revision_id == BuildingRevision.id)
                .join(Building, BuildingRevision.building_id == Building.id)
                .join(Project, Building.project_id == Project.id)
                .where(BuildingRevision.id.in_(revision_ids))
                .order_by(BeamDesign.created_at.desc())
                .limit(10)
            )
        ).all()
        for bd, b, p in design_rows:
            recent.append(
                RecentActivityItem(
                    kind="design",
                    label=f"{b.name} · {bd.name}",
                    status=bd.status,
                    project_id=p.id,
                    project_name=p.name,
                    building_id=b.id,
                    revision_id=bd.building_revision_id,
                    created_at=bd.created_at.isoformat(),
                )
            )

    recent.sort(key=lambda r: r.created_at, reverse=True)

    return OverviewStats(
        n_projects=n_projects,
        n_buildings=n_buildings,
        n_revisions_total=n_revisions_total,
        n_revisions_imported=n_revisions_imported,
        n_analyses_total=n_analyses_total,
        n_analyses_completed=n_analyses_completed,
        n_designs_total=n_designs_total,
        n_designs_completed=n_designs_completed,
        recent_activity=recent[:8],
    )
