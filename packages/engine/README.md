# @civilcode/engine (Python)

Motor de ingeniería de CivilCode Studio. **Paquete Python puro, sin dependencias web.** Ver [ADR-0003](../../docs/adr/0003-engine-python-contract.md).

## Contenido

(Esta carpeta está vacía en Fase 0. Se poblará en:
- Fase 1 con copia de `Saas_PerformanceLabs/packages/engine/` (análisis, secciones, OpenSees, NSR-10, materiales, performance).
- Fase 3 con portado desde `PlataformaDespieceVigas/backend/src/design/` y `/export/` (vigas, nervios, despiece, DXF, memoria).)

## Instalar (futuro)

```bash
cd packages/engine
uv sync
uv run pytest
```

## Reglas inmutables

- **NO importar** FastAPI, SQLAlchemy, Celery, Redis, boto3 ni ningún framework web.
- Entradas/salidas: dataclasses o Pydantic BaseModel propias del dominio.
- Tests obligatorios: sin test no se mergea código de ingeniería.

Ver [ADR-0003](../../docs/adr/0003-engine-python-contract.md) para detalles.
