# ADR-0002: Stack técnico y versiones

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales · Arquitectura
**Historia:** Fase 0

## Contexto

Elegimos el stack base de CivilCode Studio. Criterios: reutilización máxima de `Saas_PerformanceLabs` (que ya tiene un stack maduro y productivo), curva de aprendizaje baja, soporte a largo plazo, y adecuación a workloads de ingeniería estructural (análisis numérico intensivo, visualización 3D, generación de documentos).

## Decisión

### Backend / Engine

| Componente | Decisión | Versión |
|---|---|---|
| Lenguaje | Python | **3.11** |
| Gestor deps | **uv** (workspaces) | ≥0.5 |
| Linter/formatter | **ruff** | ≥0.8 |
| Framework API | **FastAPI** + Uvicorn | ≥0.140 |
| ORM | **SQLAlchemy 2** + Alembic | 2.0.x |
| Validación | **Pydantic 2** | ≥2.13 |
| Tareas asíncronas | **Celery 5.4** + Redis 7 | — |
| Análisis numérico | **NumPy 1.26.4** (pin, no 2.x), **SciPy** ≥1.11 | — |
| Análisis estructural | **OpenSeesPy**, **opseestools**, **opstool 1.0.13** | — |
| Procesamiento Excel | openpyxl, xlsxwriter | — |
| Generación DXF | **ezdxf** | ≥1.3 |
| Generación PDF | **WeasyPrint** o ReportLab (decisión en ADR específico de memorias) | — |
| Sismología | obspy 1.5.1 | — |

### Frontend

| Componente | Decisión | Versión |
|---|---|---|
| Runtime | Node | **22 LTS** |
| Gestor deps | **pnpm** (workspaces) | ≥9.15 |
| Linter/formatter | **biome** | ≥1.9 |
| Framework | **Next.js 16** (App Router) | 16.x |
| UI | **React 19** | 19.x |
| Lenguaje | **TypeScript strict** | 5.7.x |
| Estilos | **Tailwind CSS v4** (CSS-first, tokens en `@theme`) | 4.x |
| Visor 3D | **Plotly** (CDN, no npm) | — |
| Editor 2D de planos | **Konva.js** | ≥9 |
| Maps | Leaflet 1.9 + react-leaflet | — |
| Tests | **vitest** | ≥2 |

### Infraestructura

| Componente | Decisión |
|---|---|
| DB | **PostgreSQL 16** (dev y prod, sin SQLite en ningún entorno) |
| Cache / cola | **Redis 7** |
| Object storage | **MinIO** en dev (S3-compatible), S3 / GCS en prod |
| Containers | **Docker + Docker Compose** |
| Reverse proxy | **Nginx** en prod |

## Alternativas consideradas

- **Django en lugar de FastAPI** — Rechazado: Perf Labs ya usa FastAPI con éxito; async-first mejor para workloads largos; Celery se integra limpio.
- **Vite SPA en lugar de Next.js** — Rechazado: queremos SSR para portales cliente/constructor (SEO, enlaces compartibles); Next cubre SPA interna y SSR pública.
- **SvelteKit / Remix** — Rechazado: Perf Labs ya es React; ecosistema (Radix UI, react-three-fiber, react-leaflet) más maduro.
- **Poetry en lugar de uv** — Rechazado: uv es significativamente más rápido, workspaces nativos, lock file reproducible.
- **npm / yarn en lugar de pnpm** — Rechazado: pnpm usa content-addressable storage, ahorra espacio y tiempo en monorepos.
- **Tailwind v3** — Rechazado: Perf Labs ya migró a v4 CSS-first; no retroceder.
- **MUI / Ant Design / Chakra** — Rechazado: librerías pesadas, difíciles de personalizar al 100% con identidad propia. Primitivas propias + Radix UI headless + Tailwind.
- **SVG puro para editor 2D** — Rechazado: Konva da mejor performance con miles de entidades y picking.
- **SQLite en dev + PostgreSQL en prod** — Rechazado: divergencia de dialecto, JSONB, queries específicas → bugs que solo aparecen en prod.

## Consecuencias

**Fáciles:**
- Migración de código desde Perf Labs casi 1:1 (mismo stack).
- Equipo de un dev + founder puede operarlo sin DevOps dedicado.

**Difíciles:**
- OpenSeesPy requiere `os.fork()` en Linux para pushover/NLTHA (no thread-safe) — ya resuelto en Perf Labs, pero significa que los workers corren obligatoriamente en Linux (Docker en Windows está OK).
- Pin de NumPy 1.26.4 arrastra deuda — revisar cuando OpenSeesPy soporte NumPy 2.x.

**Deuda aceptada:**
- `opstool 1.0.13` tiene incompatibilidad con Python 3.12 (f-strings); parcheo en Dockerfile hasta que opstool actualice.

## Enlaces

- [`pyproject.toml`](../../pyproject.toml)
- [`package.json`](../../package.json)
- [`docker-compose.yml`](../../docker-compose.yml)
