"""Task Celery — import_etabs.run

Pipeline:
1. Baja source_file_key de MinIO.
2. Si .e2k: E2KParser → XLSX.
3. Si ETABS 23: etabs_adapter → ETABS 17.
4. Lee tablas con pandas → raw_data.
5. DataValidator → ValidationReport.
6. CanonicalModelBuilder → canonical_model (dict).
7. canonical_to_sql → inserta Level, Node, Element, Section, Material, LoadPattern.
8. Marca BuildingRevision.status = 'imported' + guarda notes con summary.
"""

from __future__ import annotations

import io
import json
import tempfile
import traceback
from pathlib import Path
from uuid import UUID

import boto3
from botocore.client import Config as BotoConfig
from celery import Task
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session, sessionmaker

from civilcode_api.config import get_settings
from civilcode_api.models.building import BuildingRevision
from civilcode_api.models.element import Element
from civilcode_api.models.loads import Combination, LoadCase, LoadPattern
from civilcode_api.models.section import Material, Section
from civilcode_api.models.structure import Axis, Level, Node

from ..celery_app import app

# ── Pipeline del engine ───────────────────────────────────────────────────────

from engine.building.e2k_parser import E2KParser
from engine.building.etabs_adapter import adapt_e23_to_e17, detect_version
from engine.building.linear.model_builder import CanonicalModelBuilder
from engine.building.linear.validator import DataValidator


# TABLE_MAP reused from Perf Labs structural_import_task
_TABLE_MAP = {
    "Objects and Elements - Joints": 'TABLE:  "OBJECTS AND ELEMENTS - JOINTS"',
    "Objects and Elements - Frames": 'TABLE:  "OBJECTS AND ELEMENTS - FRAMES"',
    "Objects and Elements - Shells": 'TABLE:  "OBJECTS AND ELEMENTS - SHELLS"',
    "Floor Connectivity": 'TABLE:  "FLOOR CONNECTIVITY"',
    "Material Properties - Concrete": 'TABLE:  "MATERIAL PROPERTIES - CONCRETE"',
    "Mass Summary by Diaphragm": 'TABLE:  "MASS SUMMARY BY DIAPHRAGM"',
    "Joint Assignments - Diaphragms": 'TABLE:  "JOINT ASSIGNMENTS - DIAPHRAGMS"',
    "Joint Assignments - Restraints": 'TABLE:  "JOINT ASSIGNMENTS - RESTRAINTS"',
    "Frame Sections": 'TABLE:  "FRAME SECTIONS"',
    "Frame Assignments - Sections": 'TABLE:  "FRAME ASSIGNMENTS - SECTIONS"',
    "Frame Assignments - Local Axes": 'TABLE:  "FRAME ASSIGNMENTS - LOCAL AXES"',
    "Frame Assignments - Offsets": 'TABLE:  "FRAME ASSIGNMENTS - OFFSETS"',
    "Frame Loads - Distributed": 'TABLE:  "FRAME LOADS - DISTRIBUTED"',
    "Shell Assignments - Sections": 'TABLE:  "SHELL ASSIGNMENTS - SECTIONS"',
    "Shell Sections - Slab": 'TABLE:  "SHELL SECTIONS - SLAB"',
    "Shell Loads - Uniform": 'TABLE:  "SHELL LOADS - UNIFORM"',
    "Shell Sections - Wall": 'TABLE:  "SHELL SECTIONS - WALL"',
    "Pier Section Properties": 'TABLE:  "PIER SECTION PROPERTIES"',
    "Shell Assignments - Pier Spandr": 'TABLE:  "SHELL ASSIGNMENTS - PIER SPANDR"',
    "Concrete Column Rebar Data": 'TABLE:  "CONCRETE COLUMN REBAR DATA"',
    "Concrete Beam Rebar Data": 'TABLE:  "CONCRETE BEAM REBAR DATA"',
    "Grid Definitions": 'TABLE:  "GRID DEFINITIONS"',
}


def _s3_client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        region_name=s.s3_region,
        config=BotoConfig(signature_version="s3v4"),
    )


def _sync_session_factory():
    """Session SQLAlchemy sincrónica (Celery tasks no son async)."""
    s = get_settings()
    # async URL (postgresql+asyncpg) → sync (postgresql+psycopg)
    sync_url = s.database_url.replace("+asyncpg", "+psycopg")
    engine = create_engine(sync_url, pool_pre_ping=True)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _load_raw_data(xlsx_path: str) -> tuple[dict, list[str]]:
    import pandas as pd

    xl = pd.ExcelFile(xlsx_path)
    sheet_names = xl.sheet_names
    raw_data: dict = {}
    for sheet, key in _TABLE_MAP.items():
        if sheet not in sheet_names:
            raw_data[key] = None
            continue
        df = pd.read_excel(xl, sheet_name=sheet, skiprows=1, header=0)
        units_row = df.iloc[0] if len(df) > 0 else pd.Series(dtype=object)
        df = df.drop(index=0).reset_index(drop=True)

        _id_cols = (
            "Element Label",
            "Object Label",
            "Unique Name",
            "Label",
            "Joint I",
            "Joint J",
            "Joint 1",
            "Joint 2",
            "Joint 3",
            "Joint 4",
        )
        for col in _id_cols:
            if col in df.columns:
                df[col] = df[col].map(
                    lambda v: ""
                    if v is None or (isinstance(v, float) and pd.isna(v))
                    else (
                        str(v)[:-2]
                        if isinstance(v, float) and v.is_integer()
                        else str(v).strip()
                    )
                )

        if sheet == "Frame Sections":
            area_unit = str(units_row.get("Area", "m2") or "m2").lower()
            if "cm" in area_unit:
                for col, factor in [
                    ("Area", 1e4),
                    ("I33", 1e8),
                    ("I22", 1e8),
                    ("J", 1e8),
                ]:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors="coerce") / factor

        raw_data[key] = df
    return raw_data, sheet_names


# ── Adapter canonical dict → SQL ──────────────────────────────────────────────


def canonical_to_sql(db: Session, revision_id: UUID, model: dict) -> dict:
    """Persiste el modelo canónico en las tablas de dominio.

    Borra datos previos de esta revisión (idempotente) y repuebla.
    Devuelve un dict con counts.
    """
    # Limpieza idempotente
    for table in (Element, Node, Section, Material, Level, Axis, LoadPattern, LoadCase, Combination):
        db.execute(delete(table).where(table.building_revision_id == revision_id))

    # Levels
    level_by_name: dict[str, Level] = {}
    for name, info in (model.get("stories") or {}).items():
        lvl = Level(
            building_revision_id=revision_id,
            name=str(name),
            elevation=float(info.get("elevation_m", 0.0)),
            height=float(info.get("height_m", 0.0)) or None,
        )
        db.add(lvl)
        level_by_name[name] = lvl
    db.flush()

    # Materials
    mat_by_name: dict[str, Material] = {}
    for mname, minfo in (model.get("materials") or {}).items():
        mat = Material(
            building_revision_id=revision_id,
            name=str(mname),
            kind="concrete",
            fc=float(minfo.get("fc_mpa")) if minfo.get("fc_mpa") is not None else None,
            fy=None,
            elastic_modulus=float(minfo.get("E_mpa")) if minfo.get("E_mpa") is not None else None,
            poisson=float(minfo.get("poisson")) if minfo.get("poisson") is not None else None,
        )
        db.add(mat)
        mat_by_name[mname] = mat
    db.flush()

    # Sections
    sec_by_name: dict[str, Section] = {}
    for sname, sinfo in (model.get("sections") or {}).items():
        mat_name = sinfo.get("material")
        sec = Section(
            building_revision_id=revision_id,
            material_id=mat_by_name[mat_name].id if mat_name in mat_by_name else None,
            name=str(sname),
            shape=str(sinfo.get("type", "custom")).lower() or "custom",
            params={k: v for k, v in sinfo.items() if k not in ("type", "material")},
        )
        db.add(sec)
        sec_by_name[sname] = sec
    db.flush()

    # Nodes
    node_by_tag: dict[str, Node] = {}
    for label, j in (model.get("joints") or {}).items():
        story = j.get("story")
        node = Node(
            building_revision_id=revision_id,
            level_id=level_by_name[story].id if story in level_by_name else None,
            tag=str(label),
            x=float(j.get("x", 0.0)),
            y=float(j.get("y", 0.0)),
            z=float(j.get("z", 0.0)),
        )
        db.add(node)
        node_by_tag[str(label)] = node
    db.flush()

    # Elements: frames (beam/column) + shells (slab/wall)
    n_frames = 0
    for label, f in (model.get("frames") or {}).items():
        kind_raw = str(f.get("type", "")).lower()
        kind = "beam" if kind_raw == "beam" else ("column" if kind_raw == "column" else kind_raw or "beam")
        sec_name = f.get("section")
        story = f.get("story")
        joint_i = str(f.get("joint_i", ""))
        joint_j = str(f.get("joint_j", ""))
        db.add(
            Element(
                building_revision_id=revision_id,
                tag=str(label),
                kind=kind,
                section_id=sec_by_name[sec_name].id if sec_name in sec_by_name else None,
                level_id=level_by_name[story].id if story in level_by_name else None,
                node_i_id=node_by_tag[joint_i].id if joint_i in node_by_tag else None,
                node_j_id=node_by_tag[joint_j].id if joint_j in node_by_tag else None,
                properties={k: v for k, v in f.items() if k not in ("type", "section", "story", "joint_i", "joint_j")},
            )
        )
        n_frames += 1

    n_shells = 0
    for label, sh in (model.get("shells") or {}).items():
        kind_raw = str(sh.get("type", "")).lower()
        kind = "slab" if kind_raw == "slab" else ("wall" if kind_raw == "wall" else kind_raw or "slab")
        story = sh.get("story")
        db.add(
            Element(
                building_revision_id=revision_id,
                tag=str(label),
                kind=kind,
                section_id=None,
                level_id=level_by_name[story].id if story in level_by_name else None,
                properties={k: v for k, v in sh.items() if k not in ("type", "story")},
            )
        )
        n_shells += 1

    # LoadPatterns
    # El model_builder actual produce list[str] (solo nombres); versiones
    # anteriores producían dict[name, info|type_str]. Soportamos ambos.
    lp_count = 0
    raw_lp = model.get("metadata", {}).get("load_patterns") or []
    if isinstance(raw_lp, dict):
        lp_iter = raw_lp.items()
    else:
        lp_iter = ((name, None) for name in raw_lp)

    for name, info in lp_iter:
        type_str = ""
        if isinstance(info, dict):
            type_str = str(info.get("type", "")).lower()
        elif isinstance(info, str):
            type_str = info.lower()
        else:
            type_str = str(name).lower()  # heurística: usar el nombre
        kind = (
            "live"
            if "live" in type_str
            else "seismic"
            if "seis" in type_str or "quake" in type_str
            else "wind"
            if "wind" in type_str
            else "dead"
        )
        db.add(
            LoadPattern(
                building_revision_id=revision_id,
                name=str(name),
                kind=kind,
            )
        )
        lp_count += 1

    return {
        "n_levels": len(level_by_name),
        "n_materials": len(mat_by_name),
        "n_sections": len(sec_by_name),
        "n_nodes": len(node_by_tag),
        "n_frames": n_frames,
        "n_shells": n_shells,
        "n_load_patterns": lp_count,
    }


# ── Celery task ───────────────────────────────────────────────────────────────


@app.task(name="civilcode_worker.tasks.import.run_import", bind=True)
def run_import(self: Task, revision_id: str) -> dict:
    SessionLocal = _sync_session_factory()
    db: Session = SessionLocal()
    try:
        rev_uuid = UUID(revision_id)
        rev = db.execute(select(BuildingRevision).where(BuildingRevision.id == rev_uuid)).scalar_one_or_none()
        if rev is None:
            raise RuntimeError(f"Revision {revision_id} not found")
        if not rev.source_file_key:
            raise RuntimeError("Revision has no source_file_key")

        rev.status = "importing"
        db.commit()

        settings = get_settings()
        s3 = _s3_client()

        # Descargar archivo a temp
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            local_src = tmpdir_path / Path(rev.source_file_key).name
            s3.download_file(settings.s3_bucket_sources, rev.source_file_key, str(local_src))

            # E2K → XLSX
            input_xlsx = local_src
            if local_src.suffix.lower() == ".e2k":
                parser = E2KParser(str(local_src))
                parser.parse()
                input_xlsx = tmpdir_path / "input_model.xlsx"
                parser.write_xlsx(str(input_xlsx))

            # Adapter E23 → E17 si aplica
            if detect_version(str(input_xlsx)) == "23":
                adapted = tmpdir_path / "input_e17.xlsx"
                adapt_e23_to_e17(str(input_xlsx), str(adapted))
                input_xlsx = adapted

            raw_data, sheet_names = _load_raw_data(str(input_xlsx))

            validator = DataValidator()
            report = validator.validate(raw_data, sheet_names)
            if report.has_critical:
                rev.status = "invalid"
                rev.notes = (
                    f"Validación falló. Críticos: {len(report.critical)}. "
                    f"Primeros: " + "; ".join(str(c) for c in report.critical[:3])
                )
                db.commit()
                return {
                    "status": "invalid",
                    "critical_count": len(report.critical),
                    "warning_count": len(report.warnings),
                }

            builder = CanonicalModelBuilder(raw_data)
            model = builder.build()

            # Guardar canonical model como artifact (opcional)
            canonical_json_bytes = json.dumps(model, ensure_ascii=False).encode("utf-8")
            canonical_key = f"buildings/{rev.building_id}/rev-{rev.revision_number}-canonical.json"
            s3.put_object(
                Bucket=settings.s3_bucket_sources,
                Key=canonical_key,
                Body=io.BytesIO(canonical_json_bytes),
                ContentType="application/json",
            )

            counts = canonical_to_sql(db, rev_uuid, model)

        rev.status = "imported"
        rev.notes = (
            f"Importado OK. "
            f"Niveles={counts['n_levels']}, Nodos={counts['n_nodes']}, "
            f"Vigas/Cols={counts['n_frames']}, Losas/Muros={counts['n_shells']}, "
            f"Secciones={counts['n_sections']}, Materiales={counts['n_materials']}, "
            f"Patrones={counts['n_load_patterns']}"
        )
        db.commit()
        return {"status": "imported", **counts}

    except Exception as exc:
        db.rollback()
        try:
            rev = db.execute(select(BuildingRevision).where(BuildingRevision.id == rev_uuid)).scalar_one_or_none()
            if rev is not None:
                rev.status = "invalid"
                rev.notes = f"Error: {exc}"
                db.commit()
        except Exception:
            pass
        raise RuntimeError(f"{exc}\n{traceback.format_exc()}") from exc
    finally:
        db.close()
