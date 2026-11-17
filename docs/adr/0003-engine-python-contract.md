# ADR-0003: Engine Python como contrato — sin dependencias web

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales · Arquitectura
**Historia:** Fase 0 — patrón validado en Saas_PerformanceLabs

## Contexto

En `Saas_PerformanceLabs`, el `packages/engine/` es un paquete Python puro: no importa FastAPI, Pydantic, SQLAlchemy ni nada web. Esto ha demostrado ventajas sustanciales en 1+ año de desarrollo:

- Se puede abrir en un Jupyter / REPL y experimentar con cálculos directamente.
- Los tests pytest corren en milisegundos sin necesidad de levantar servidor, DB ni Redis.
- El motor es reutilizable desde CLIs, notebooks, scripts batch o futuros microservicios si algún día se separa.
- Los cambios en el motor **nunca** rompen la API: sólo la capa de adaptador (`engine_adapter.py` en Perf Labs) traduce DTOs HTTP ↔ objetos de engine.

CivilCode Studio hereda este patrón y lo extiende: el engine es **el núcleo del producto**. Los motores de diseño de vigas/nervios (portados desde `PlataformaDespieceVigas`), los motores de análisis (OpenSees), los motores de despiece, DXF y memoria viven todos aquí.

## Decisión

**`packages/engine/` es un paquete Python puro** con las siguientes reglas estrictas:

1. **Prohibido importar:** FastAPI, Starlette, Flask, Django, SQLAlchemy, Alembic, Celery, Redis, boto3, cualquier framework web o cliente de BD.
2. **Permitido importar:** NumPy, SciPy, OpenSeesPy, opstool, opseestools, ezdxf, reportlab/weasyprint, pandas, obspy, pydantic (solo para DTOs internos tipados, NO para validación HTTP).
3. **Entradas y salidas** son dataclasses / Pydantic BaseModel propias del dominio estructural (`Building`, `Element`, `Load`, `DesignResult`, `BarRun`, etc.). Nunca requests, responses, SQLAlchemy models, Celery tasks.
4. **Sin efectos secundarios de red o filesystem**, salvo:
   - Lectura/escritura de archivos cuando se le pasa un path o file-like object (importadores E2K, generadores DXF/PDF).
   - Logs vía logger estándar `logging` (nunca print).
5. **Tests pytest** cubren la lógica. Fixtures con datos sintéticos + fixtures con modelos reales (anonymizados) de proyectos de referencia.
6. **El adaptador vive en `apps/api/app/engine_adapter.py`** (análogo al de Perf Labs): traduce DTOs del engine ↔ Pydantic schemas de FastAPI, llama al engine y maneja persistencia.

**Estructura interna propuesta:**

```
packages/engine/
├── pyproject.toml           (deps propias, instalable como paquete)
├── src/
│   └── civilcode_engine/
│       ├── __init__.py
│       ├── core/            (units, conversions, geometry primitives)
│       ├── model/           (Building, Level, Element, Load, Combination, Material, Section)
│       ├── importers/       (etabs_e2k, etabs_tables, csv, ifc)
│       ├── analysis/        (OpenSees runners, result adapters, modal, spectral, nlth, ida)
│       ├── seismic/         (nsr10 catalog, spectrum, ground motion)
│       ├── sections/        (geometry, reinforcement, fibers, Mander confinement)
│       ├── design/
│       │   ├── columns/     (Perf Labs — adaptado)
│       │   ├── walls/       (Perf Labs — adaptado)
│       │   ├── beams/       (portado de PlataformaDespieceVigas TS→Py)
│       │   ├── joists/      (portado — nervios)
│       │   └── foundations/ (Fase 5)
│       ├── normas/
│       │   └── nsr10/       (cláusulas específicas trazables)
│       ├── detailing/       (bar runs, splices, stirrups, dev lengths — portado)
│       ├── drawings/        (dxf export via ezdxf, svg primitives, sheet composition)
│       ├── docs/            (memoria generation — markdown/LaTeX → PDF)
│       └── quantities/      (bars, concrete, steel weights)
└── tests/
    ├── unit/                (tests por módulo)
    ├── integration/         (flujo completo: import → análisis → diseño → despiece)
    └── fixtures/            (modelos de referencia + salidas esperadas)
```

## Alternativas consideradas

- **Microservicio separado para el engine** — Rechazado: añade complejidad de red, serialización, versionado. Over-engineering para etapa actual.
- **Motor en C++/Rust con bindings Python** — Rechazado: performance no es cuello de botella actual (OpenSees ya es C++ under the hood); romperíamos la accesibilidad para el founder, que lee y modifica Python con fluidez.
- **Engine mezclado con la API** — Rechazado: ya sabemos que acopla y rompe tests; patrón anti-validado en muchos proyectos.

## Consecuencias

**Fáciles:**
- Abrir `packages/engine/` en PyCharm/VSCode y correr `pytest` en <5s.
- Refactorizar la API (ej: pasar a GraphQL mañana) no toca el engine.
- Reutilizar el engine en workers Celery (lo hacen ambos: API y worker lo importan).

**Difíciles:**
- Mantener disciplina — en PR reviews, cualquier `from fastapi import ...` dentro de `packages/engine/` se rechaza.
- Un linting rule (ruff `--select TID`) prohibirá imports de módulos web dentro del engine (a añadir cuando el engine tenga código).

**Deuda aceptada:**
- Pequeña duplicación entre schemas Pydantic del engine (DTOs internos) y schemas de FastAPI (validación HTTP). Es consciente y aceptable; un script podría generarlos automáticamente si crece el esfuerzo.

## Enlaces

- `Saas_PerformanceLabs/packages/engine/` (patrón de referencia)
- ADR-0001 (Estructura monorepo)
- ADR-0004 (Portado TS→Python)
