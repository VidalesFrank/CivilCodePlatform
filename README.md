# CivilCode Studio

**Plataforma integral de ingeniería estructural** — importación ETABS → modelo canónico → visualización 3D → análisis → diseño NSR-10 → despiece → planos → memorias → portal cliente/constructor.

> Producto desarrollado por **CivilCode Solutions**. Nombre interno de la carpeta: `CivilCode_Platform`. Nombre público del producto: **CivilCode Studio**.

---

## Arquitectura (resumen)

Monorepo con separación estricta entre motor de ingeniería (Python puro), API, workers asíncronos y frontend.

```
CivilCode_Platform/
├── packages/
│   ├── engine/      ← Motor de ingeniería (Python, sin deps web)
│   ├── ui/          ← Design system React (Tailwind v4 + primitivas propias)
│   └── icons/       ← Iconografía de dominio estructural (SVG)
├── apps/
│   ├── api/         ← FastAPI (monolito modular por dominio)
│   ├── web/         ← Next.js 16 (App Router)
│   └── worker/      ← Celery workers (análisis, diseño, rendering)
├── infra/
│   ├── docker/      ← Dockerfiles por servicio
│   ├── nginx/       ← Reverse proxy producción
│   └── postgres/    ← Scripts de inicialización
└── docs/
    ├── adr/         ← Architecture Decision Records
    ├── engineering/ ← Documentación de algoritmos NSR-10
    ├── product/     ← Docs de producto y roadmap
    └── brand/       ← Identidad visual (logo, paleta)
```

Decisiones arquitectónicas detalladas en [`docs/adr/`](./docs/adr/).

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Engine | Python 3.11 + NumPy 1.26.4 + SciPy + OpenSeesPy + ezdxf |
| API | FastAPI 0.140 + SQLAlchemy 2 + Alembic + Pydantic 2 |
| Workers | Celery 5.4 + Redis 7 |
| Frontend | Next.js 16 + React 19 + TypeScript strict + Tailwind v4 |
| Visor 3D | Plotly (CDN) + Three.js como respaldo |
| Editor 2D de planos | Konva.js |
| DB | PostgreSQL 16 |
| Storage | MinIO (dev) / S3 (prod) |
| Infra | Docker Compose + Nginx |

Ver [`docs/adr/0002-technical-stack.md`](./docs/adr/0002-technical-stack.md) para justificaciones.

---

## Estado del proyecto

🚧 **Fase 0 — Fundación** (noviembre 2026). Auditoría de repos base completada; ADRs en redacción; esqueleto del monorepo en construcción.

Repos base de los que se migra código (por **copia**, sin submódulos):

- `C:\00_Desarrollo\Saas_PerformanceLabs` — motor estructural maduro (análisis modal, espectral, NLTHA, IDA, diseño NSR-10 columnas/vigas, catálogo NSR-10 con 99 municipios).
- `C:\00_Desarrollo\PlataformaDespieceVigas` — motores de diseño y despiece de vigas y nervios (NSR-10 flexión/cortante, traslapos comerciales, motor DXF propio).

Ambos repos originales se **preservan intactos**. Los motores de `PlataformaDespieceVigas` se portan de TypeScript a Python como parte de Fase 3.

---

## Desarrollo local

```bash
# TODO: completar al finalizar Fase 0 — por ahora, estructura de carpetas sola
docker compose up -d        # postgres + redis + minio
uv sync                     # instalar deps Python (workspace)
pnpm install                # instalar deps Node (workspace)
pnpm --filter @civilcode/web dev
```

---

## Licencia

Propietario — CivilCode Solutions. Todos los derechos reservados.
