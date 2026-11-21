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

    raw_data: dict = {}
    with pd.ExcelFile(xlsx_path) as xl:
        sheet_names = xl.sheet_names
        for sheet, key in _TABLE_MAP.items():
            if sheet not in sheet_names:
                raw_data[key] = None
                continue
            df = pd.read_excel(xl, sheet_name=sheet, skiprows=1, header=0)
            if len(df) > 0:
                units_row = df.iloc[0]
                df = df.iloc[1:].reset_index(drop=True)
            else:
                units_row = pd.Series(dtype=object)

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
    # model_builder usa la clave "element_type"; aceptamos tambien "type" por compat.
    sections_canon = model.get("sections") or {}
    n_frames = 0
    for label, f in (model.get("frames") or {}).items():
        kind_raw = str(f.get("element_type") or f.get("type") or "").lower()
        kind = "beam" if kind_raw == "beam" else ("column" if kind_raw == "column" else kind_raw or "beam")
        sec_name = f.get("section")
        story = f.get("story")
        joint_i = str(f.get("joint_i", ""))
        joint_j = str(f.get("joint_j", ""))

        props = {k: v for k, v in f.items() if k not in ("type", "element_type", "section", "story", "joint_i", "joint_j")}
        # Hidrata geometry con dimensiones reales de la sección para el visor 3D.
        sec_info = sections_canon.get(sec_name) if sec_name else None
        if isinstance(sec_info, dict):
            b_m = sec_info.get("b_m")
            h_m = sec_info.get("h_m")
            shape = sec_info.get("shape")
            if isinstance(b_m, (int, float)) and b_m > 0 and isinstance(h_m, (int, float)) and h_m > 0:
                props["geometry"] = {"base": float(b_m), "height": float(h_m), "shape": shape}
        if sec_name:
            props.setdefault("design_section", sec_name)

        db.add(
            Element(
                building_revision_id=revision_id,
                tag=str(label),
                kind=kind,
                section_id=sec_by_name[sec_name].id if sec_name in sec_by_name else None,
                level_id=level_by_name[story].id if story in level_by_name else None,
                node_i_id=node_by_tag[joint_i].id if joint_i in node_by_tag else None,
                node_j_id=node_by_tag[joint_j].id if joint_j in node_by_tag else None,
                properties=props,
            )
        )
        n_frames += 1

    n_shells = 0
    for label, sh in (model.get("shells") or {}).items():
        kind_raw = str(sh.get("element_type") or sh.get("type") or "").lower()
        kind = "slab" if kind_raw == "slab" else ("wall" if kind_raw == "wall" else kind_raw or "slab")
        story = sh.get("story")
        db.add(
            Element(
                building_revision_id=revision_id,
                tag=str(label),
                kind=kind,
                section_id=None,
                level_id=level_by_name[story].id if story in level_by_name else None,
                properties={k: v for k, v in sh.items() if k not in ("type", "element_type", "story")},
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


# ──────────────────────────────────────────────────────────────────────────
# Element Forces (demandas) — parseo de Excel ETABS
# ──────────────────────────────────────────────────────────────────────────

from civilcode_api.models.element_force import ElementForce


# Hojas candidatas donde ETABS exporta las fuerzas de vigas (según versión).
_FORCES_SHEET_CANDIDATES = (
    "Element Forces - Beams",
    "Element Forces – Beams",  # en-dash (algunos exports usan este)
    "Element Forces - Frames",
)

# Candidatos de columna para identificar al elemento. Se prueban en orden y
# ganamos el que mejor matchee con los tags de los elementos en la DB.
_ID_COLUMN_CANDIDATES: tuple[str, ...] = (
    "unique name",
    "uniquename",
    "element label",
    "object label",
    "label",
    "beam",
    "frame",
    "name",
)

# Mapa flexible columna → nombres posibles (case-insensitive, trimmed).
_COL_ALIASES: dict[str, tuple[str, ...]] = {
    "output_case": ("output case", "outputcase", "case"),
    "case_type": ("case type", "casetype"),
    "step_type": ("step type", "steptype"),
    "station": ("station", "station (m)", "station m"),
    "m3": ("m3", "m3 (kn-m)", "m3 kn-m"),
    "v2": ("v2", "v2 (kn)", "v2 kn"),
    "t": ("t", "torsion", "t (kn-m)"),
}


def _normalize_col(name: object) -> str:
    return str(name or "").strip().lower()


def _resolve_columns(cols: list[str]) -> dict[str, str | None]:
    """Mapea nombre lógico → nombre real de columna en el XLSX."""
    lookup = {_normalize_col(c): c for c in cols}
    out: dict[str, str | None] = {}
    for key, aliases in _COL_ALIASES.items():
        found: str | None = None
        for a in aliases:
            if a in lookup:
                found = lookup[a]
                break
        out[key] = found
    return out


def _find_forces_sheet(xl_sheets: list[str]) -> str | None:
    for s in _FORCES_SHEET_CANDIDATES:
        if s in xl_sheets:
            return s
    # búsqueda laxa por sustring (case-insensitive)
    low = {s.lower(): s for s in xl_sheets}
    for key in ("element forces - beams", "element forces beams", "element forces - frames"):
        for lname, orig in low.items():
            if key in lname:
                return orig
    return None


def _normalize_tag(v: object) -> str:
    """Normaliza un identificador a string (sin decimales si es entero)."""
    import math

    if v is None:
        return ""
    if isinstance(v, float):
        if math.isnan(v):
            return ""
        if v.is_integer():
            return str(int(v))
        return str(v)
    s = str(v).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s


def _pick_best_id_column(df, cols: list[str], known_tags: set[str]) -> str | None:
    """Elige la columna cuyos valores mejor matcheen con los tags conocidos."""
    normalized = {_normalize_col(c): c for c in cols}
    best_col: str | None = None
    best_hits = -1
    # Evalúa solo las columnas candidatas presentes
    for cand in _ID_COLUMN_CANDIDATES:
        orig = normalized.get(cand)
        if orig is None:
            continue
        sample = df[orig].head(1500)
        tags_sample = {_normalize_tag(v) for v in sample}
        tags_sample.discard("")
        hits = len(tags_sample & known_tags)
        if hits > best_hits:
            best_hits = hits
            best_col = orig
    # Si no encontramos ningún candidato o cero hits, fallback a la primera
    # columna no-numérica/no-combo plausible.
    if best_col is None and normalized:
        for key in ("unique name", "label", "beam", "frame"):
            if key in normalized:
                return normalized[key]
    return best_col


def _load_forces_rows(
    xlsx_path: str, known_tags: set[str] | None = None
) -> tuple[list[dict], str, str]:
    """Lee la hoja de Element Forces y devuelve (rows, sheet_name, id_col).

    Cada row es un dict con llaves: unique_name, output_case, case_type,
    step_type, station, m3, v2, t.

    Si `known_tags` se pasa, se elige la columna de identificador que mejor
    matchee con esos tags.
    """
    import pandas as pd

    rows: list[dict] = []
    with pd.ExcelFile(xlsx_path) as xl:
        sheet = _find_forces_sheet(list(xl.sheet_names))
        if sheet is None:
            raise ValueError(
                "No encontré la hoja 'Element Forces - Beams' en el XLSX. "
                "Hojas disponibles: " + ", ".join(xl.sheet_names[:10])
            )
        # ETABS: fila 0 = título de tabla, fila 1 = headers, fila 2 = unidades.
        df = pd.read_excel(xl, sheet_name=sheet, skiprows=1, header=0)
        if len(df) > 0:
            df = df.iloc[1:].reset_index(drop=True)

        cols = list(df.columns.astype(str))
        resolved = _resolve_columns(cols)

        required = ("output_case", "station", "m3", "v2")
        missing = [k for k in required if resolved.get(k) is None]
        if missing:
            raise ValueError(
                f"Columnas faltantes en la hoja '{sheet}': {', '.join(missing)}. "
                f"Columnas disponibles: {', '.join(cols[:15])}"
            )

        # Elige la columna de identificador con el mejor match contra known_tags
        id_col = _pick_best_id_column(df, cols, known_tags or set())
        if id_col is None:
            raise ValueError(
                f"No pude identificar la columna del elemento. Columnas disponibles: {', '.join(cols[:15])}"
            )

        for _, r in df.iterrows():
            uname = _normalize_tag(r.get(id_col))
            if not uname:
                continue

            def _f(key: str) -> float:
                col = resolved.get(key)
                if col is None:
                    return 0.0
                v = r.get(col)
                try:
                    f = float(v)
                    return f if (f == f) else 0.0  # filtra NaN
                except (TypeError, ValueError):
                    return 0.0

            def _s(key: str) -> str:
                col = resolved.get(key)
                if col is None:
                    return ""
                v = r.get(col)
                if v is None or (isinstance(v, float) and pd.isna(v)):
                    return ""
                return str(v).strip()

            rows.append({
                "unique_name": uname,
                "output_case": _s("output_case"),
                "case_type": _s("case_type"),
                "step_type": _s("step_type"),
                "station": _f("station"),
                "m3": _f("m3"),
                "v2": _f("v2"),
                "t": _f("t"),
            })
    return rows, sheet, id_col


@app.task(name="civilcode_worker.tasks.import.run_forces_import", bind=True)
def run_forces_import(self: Task, revision_id: str) -> dict:
    """Parsea un XLSX de Element Forces y persiste en element_forces.

    Pipeline:
    1. Descarga forces_file_key de MinIO.
    2. Lee hoja 'Element Forces - Beams' con pandas.
    3. Filtra casos modales (LinModRitz, LinRespSpec).
    4. Linkea element_tag → element_id de la revisión.
    5. Bulk insert.
    6. Marca forces_status='loaded' y guarda summary en forces_notes.
    """
    Session = _sync_session_factory()
    db = Session()
    rev_uuid = UUID(revision_id)
    try:
        rev = db.execute(
            select(BuildingRevision).where(BuildingRevision.id == rev_uuid)
        ).scalar_one_or_none()
        if rev is None:
            raise ValueError(f"Revisión {revision_id} no existe")
        if not rev.forces_file_key:
            raise ValueError("La revisión no tiene forces_file_key")

        rev.forces_status = "importing"
        rev.forces_notes = "Parseando XLSX…"
        db.commit()

        settings = get_settings()
        s3 = _s3_client()

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            local = tmpdir_path / Path(rev.forces_file_key).name
            s3.download_file(settings.s3_bucket_sources, rev.forces_file_key, str(local))

            # Mapa element_tag → element_id (de esta revisión). También armamos
            # un mapa por "object_label" (campo que ETABS guarda en properties)
            # porque algunos Excel exportan el Label en lugar del Unique Name.
            elements_full = db.execute(
                select(Element.id, Element.tag, Element.properties).where(
                    Element.building_revision_id == rev_uuid
                )
            ).all()
            id_by_tag: dict[str, UUID] = {}
            id_by_label: dict[str, UUID] = {}
            tag_by_label: dict[str, str] = {}
            for (eid, tag, props) in elements_full:
                tag_s = str(tag)
                id_by_tag[tag_s] = eid
                if isinstance(props, dict):
                    lbl = props.get("object_label") or props.get("label")
                    if lbl is not None:
                        lbl_s = _normalize_tag(lbl)
                        if lbl_s:
                            id_by_label[lbl_s] = eid
                            tag_by_label[lbl_s] = tag_s
            # Known tags = unión de ambos para que el matcher elija la mejor columna
            known_tags = set(id_by_tag.keys()) | set(id_by_label.keys())

            rows, sheet, id_col = _load_forces_rows(str(local), known_tags=known_tags)

            # Limpia cualquier dato parcial previo.
            db.execute(
                delete(ElementForce).where(ElementForce.building_revision_id == rev_uuid)
            )
            db.flush()

            # Bulk insert. Resuelve tag → element_id probando primero por tag
            # canónico y luego por object_label. Si matchea por label, persistimos
            # el tag canónico en element_tag para que el design task lo encuentre.
            n_inserted = 0
            n_skipped_modal = 0
            n_unlinked = 0
            n_matched_by_label = 0
            cases: set[str] = set()
            tags_with_forces: set[str] = set()
            batch: list[dict] = []
            for row in rows:
                ct = row["case_type"].lower()
                if "linmodritz" in ct or "linrespspec" in ct:
                    n_skipped_modal += 1
                    continue
                excel_val = row["unique_name"]
                eid = id_by_tag.get(excel_val)
                stored_tag = excel_val
                if eid is None:
                    # Fallback: matchea por object_label
                    eid = id_by_label.get(excel_val)
                    if eid is not None:
                        stored_tag = tag_by_label.get(excel_val, excel_val)
                        n_matched_by_label += 1
                if eid is None:
                    n_unlinked += 1
                cases.add(row["output_case"])
                tags_with_forces.add(stored_tag)
                batch.append({
                    "building_revision_id": rev_uuid,
                    "element_id": eid,
                    "element_tag": stored_tag,
                    "output_case": row["output_case"],
                    "case_type": row["case_type"],
                    "step_type": row["step_type"],
                    "station_m": row["station"],
                    "m3_knm": row["m3"],
                    "v2_kn": row["v2"],
                    "t_knm": row["t"],
                })
                if len(batch) >= 2000:
                    db.execute(ElementForce.__table__.insert(), batch)
                    n_inserted += len(batch)
                    batch = []
            if batch:
                db.execute(ElementForce.__table__.insert(), batch)
                n_inserted += len(batch)

        rev.forces_status = "loaded"
        rev.forces_notes = (
            f"OK · hoja '{sheet}' · col ID: {id_col} · {n_inserted} registros · "
            f"{len(tags_with_forces)} elementos · {len(cases)} casos"
            + (f" · {n_matched_by_label} matcheadas por label" if n_matched_by_label else "")
            + (f" · {n_unlinked} filas sin match con elementos" if n_unlinked else "")
            + (f" · {n_skipped_modal} modales ignorados" if n_skipped_modal else "")
        )
        db.commit()
        return {
            "status": "loaded",
            "n_records": n_inserted,
            "n_elements_with_forces": len(tags_with_forces),
            "n_load_cases": len(cases),
            "n_unlinked": n_unlinked,
            "n_skipped_modal": n_skipped_modal,
        }
    except Exception as exc:
        db.rollback()
        try:
            rev = db.execute(
                select(BuildingRevision).where(BuildingRevision.id == rev_uuid)
            ).scalar_one_or_none()
            if rev is not None:
                rev.forces_status = "invalid"
                rev.forces_notes = f"Error: {exc}"
                db.commit()
        except Exception:
            pass
        raise RuntimeError(f"{exc}\n{traceback.format_exc()}") from exc
    finally:
        db.close()
