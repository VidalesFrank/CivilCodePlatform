# Architecture Decision Records (ADRs)

Decisiones arquitectónicas de CivilCode Studio en formato [MADR](https://adr.github.io/madr/) simplificado.

## Índice

| # | Título | Estado |
|---|---|---|
| [0001](./0001-monorepo-structure.md) | Estructura de monorepo | Aceptado |
| [0002](./0002-technical-stack.md) | Stack técnico y versiones | Aceptado |
| [0003](./0003-engine-python-contract.md) | Engine Python como contrato — sin dependencias web | Aceptado |
| [0004](./0004-porting-ts-to-python.md) | Portado de motores TS → Python desde el inicio | Aceptado |
| [0005](./0005-product-name-civilcode-studio.md) | Nombre del producto — "CivilCode Studio" | Aceptado |
| [0006](./0006-auth-cookies-refresh.md) | Autenticación — JWT access + refresh en cookies HttpOnly | Aceptado |
| [0007](./0007-mvp-scope.md) | Alcance del MVP | Propuesto |
| [0008](./0008-visual-identity.md) | Identidad visual y design system | Aceptado |

## Cómo crear una nueva ADR

1. Copia [`template.md`](./template.md) a `NNNN-slug-corto.md` (N siguiente disponible).
2. Completa las secciones: Contexto, Decisión, Alternativas consideradas, Consecuencias, Enlaces.
3. Añade entrada al índice de arriba.
4. Commit con mensaje `docs(adr): NNNN - título corto`.

## Estados

- **Propuesto** — en discusión, no implementado todavía.
- **Aceptado** — acordado e implementado o en implementación.
- **Deprecado** — ya no se aplica, pero se mantiene por historia.
- **Reemplazado por ADR-XXXX** — superseded; enlazar a la nueva.
