# ADR-0001: Estructura de monorepo

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales (founder) · Arquitectura
**Historia:** Fase 0 — primera tanda de decisiones tras auditoría de repos existentes

## Contexto

CivilCode Studio integra funcionalidades de dos repos existentes (`Saas_PerformanceLabs` y `PlataformaDespieceVigas`) y debe soportar el crecimiento del producto a módulos adicionales (columnas, muros, cimentaciones, losas, portales cliente/constructor, BIM). Necesitamos una organización de código que:

- Permita compartir librerías entre backend (engine, API, workers) y frontend (UI, iconos).
- Mantenga el **engine de ingeniería como paquete Python puro sin dependencias web** (patrón ya validado en Saas_PerformanceLabs).
- Facilite correr todos los servicios con un solo `docker compose up`.
- Sea comprensible para un nuevo desarrollador en menos de 1 día.
- No introduzca complejidad prematura (microservicios, service mesh, repos múltiples).

## Decisión

**Monorepo único** con workspaces separados por lenguaje:

```
CivilCode_Platform/
├── packages/            ← Librerías reutilizables
│   ├── engine/          Python puro — motor de ingeniería (uv workspace)
│   ├── ui/              React + TS — design system (pnpm workspace)
│   └── icons/           React + TS — iconografía de dominio (pnpm workspace)
├── apps/                ← Deployables
│   ├── api/             FastAPI (uv workspace)
│   ├── web/             Next.js 16 (pnpm workspace)
│   └── worker/          Celery (uv workspace)
├── infra/               ← Ops: Dockerfiles, nginx, scripts DB
├── docs/                ← ADRs, docs de ingeniería, docs de producto, brand
└── (configs raíz: pnpm-workspace.yaml, pyproject.toml, docker-compose.yml, ...)
```

**Dos gestores de paquetes conviven:**
- **uv** para Python workspaces (`packages/engine`, `apps/api`, `apps/worker`).
- **pnpm** para TS workspaces (`packages/ui`, `packages/icons`, `apps/web`).

Ambos son rápidos, estándar emergente y bien mantenidos. No se usa Turbo / Nx / Lerna — simplicidad primero.

## Alternativas consideradas

- **Polyrepo (un repo por servicio)** — Rechazado: multiplica overhead de CI, versionado, PRs; dificulta refactor cross-cutting.
- **Monorepo con Turborepo + Nx** — Rechazado: complejidad extra sin beneficio claro en etapa temprana. Podemos adoptarlo más adelante si el pipeline lo justifica.
- **Submodules de Git para `Saas_PerformanceLabs` y `PlataformaDespieceVigas`** — Rechazado explícitamente por el founder: prefiere migración por copia, dejando los repos originales intactos como snapshot de referencia.

## Consecuencias

**Fáciles:**
- Un solo `git clone` para onboarding.
- Refactors transversales (engine ↔ API ↔ UI) en un solo PR.
- Versionado sincronizado automáticamente.
- Compartir tipos y utilidades entre frontend y backend.

**Difíciles:**
- CI debe ser inteligente (correr solo tests de paquetes afectados) — a resolver cuando el CI se implemente.
- Tamaño del repo crecerá con el tiempo; no versionar binarios (E2K, DXF, PDF) en git — ya reflejado en `.gitignore`.

**Deuda aceptada:**
- Dos gestores (uv + pnpm) requieren dos `install` en onboarding. Aceptable: un Makefile o script `bootstrap.sh` lo encapsula.

## Enlaces

- [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)
- [`pyproject.toml`](../../pyproject.toml)
- ADR-0002 (Stack técnico)
- ADR-0003 (Engine Python como contrato)
