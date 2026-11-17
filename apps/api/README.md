# apps/api — FastAPI

API HTTP de CivilCode Studio. Monolito modular organizado por **dominio** (no por módulo UI).

## Estructura (propuesta Fase 1)

```
app/
├── main.py                    (ASGI entrypoint)
├── config.py                  (settings via pydantic-settings)
├── db.py                      (SessionLocal, engine)
├── auth/                      (JWT, cookies, refresh, dependencies)
├── models/                    (SQLAlchemy ORM organizado por agregado)
├── schemas/                   (Pydantic request/response)
├── routers/
│   ├── auth.py
│   ├── projects.py
│   ├── buildings.py           (import, geometry, hierarchy)
│   ├── analysis.py            (modal, spectral, nlth, ida)
│   ├── design.py              (columns, walls, beams, joists, foundations)
│   ├── detailing.py
│   ├── drawings.py            (sheets, viewports)
│   ├── documents.py           (memorias, cantidades)
│   └── sharing.py             (share links, portals)
├── services/                  (lógica de aplicación entre routers y engine)
├── engine_adapter.py          (traduce DTOs HTTP ↔ engine DTOs)
├── ws/                        (WebSocket handlers: jobs, comments)
└── alembic/                   (migraciones)
```

## Dev (futuro)

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload
```
