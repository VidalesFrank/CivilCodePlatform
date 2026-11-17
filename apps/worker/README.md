# apps/worker — Celery

Workers asíncronos para tareas largas: importación ETABS, análisis modal/espectral/NLTH/IDA, diseño, generación de DXF/PDF, cálculo de cantidades.

Usa `os.fork()` para OpenSees (no thread-safe). Ejecuta obligatoriamente en Linux (Docker en Windows está OK).

## Colas (propuestas Fase 2)

| Cola | Workers | Trabajos |
|---|---|---|
| `import` | 2 | `import_etabs`, `validate_building` |
| `analysis` | 2-4 | `modal`, `spectral`, `nlth`, `ida` |
| `design` | 2-4 | `design_beams`, `design_joists`, `design_columns`, `design_walls` |
| `rendering` | 1-2 | `render_drawing_dxf`, `render_memoria_pdf`, `render_3d_snapshot` |

## Dev (futuro)

```bash
cd apps/worker
uv sync
uv run celery -A worker.celery_app worker --loglevel=info -Q analysis,design
```
