# ADR-0006: Autenticación — JWT access + refresh en cookies HttpOnly

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales · Arquitectura

## Contexto

`Saas_PerformanceLabs` usa JWT en `localStorage`. Esto es funcional para una app interna, pero CivilCode Studio tendrá:

- **Portales públicos** (cliente, constructor) accesibles vía enlaces compartibles con expiración.
- **Usuarios no técnicos** que pueden caer en ataques XSS si una dependencia introduce vulnerabilidad.
- **Multi-pestaña / multi-dispositivo** con refresh largo y access corto.
- Requisito futuro de **revocación** fina (ej: ingeniero despide cliente → invalidar token).

`localStorage` es vulnerable a XSS. Cookies HttpOnly, no.

## Decisión

**Autenticación basada en dos cookies HttpOnly:**

| Cookie | TTL | Propósito |
|---|---|---|
| `cc_access` | 15 minutos | JWT access token (contiene user_id, roles, org_id) |
| `cc_refresh` | 30 días | Refresh token (random opaque string, hash en DB) |

**Configuración de cookies:**
- `HttpOnly=true` (inaccesible desde JS)
- `Secure=true` (solo HTTPS en prod; dev puede usar `Secure=false` en localhost)
- `SameSite=Lax` (mitiga CSRF en la mayoría de casos; combinado con doble-submit token para operaciones sensibles)
- `Path=/`
- `Domain` según entorno

**Flujo:**
1. **Login**: `POST /api/v1/auth/login` → setea `cc_access` y `cc_refresh`.
2. **Request autenticado**: navegador envía cookies automáticamente; FastAPI dependency `get_current_user` lee `cc_access`, valida firma, devuelve user.
3. **Access expira**: FastAPI responde 401. Cliente llama `POST /api/v1/auth/refresh` (envía `cc_refresh` automático), recibe nuevo `cc_access`.
4. **Logout**: `POST /api/v1/auth/logout` → invalida `cc_refresh` en DB + setea cookies vacías con `Max-Age=0`.
5. **Revocación**: endpoint admin para marcar refresh tokens como revocados.

**Portales públicos (cliente, constructor):**
- No usan `cc_access`/`cc_refresh`. Usan un **share token** (query param `?t=...` o cookie short-lived `cc_share`) que mapea a `ShareLink` en DB con permisos específicos y expiración.

**CSRF mitigación:**
- `SameSite=Lax` cubre el 95% de los casos.
- Para operaciones destructivas o cambios de permisos: header custom `X-CSRF-Token` + token embebido en HTML inicial (patrón double-submit).

## Alternativas consideradas

- **JWT en localStorage (como Perf Labs)** — Rechazado: XSS compromete todo.
- **JWT en sessionStorage** — Rechazado: mismo problema que localStorage + pérdida al cerrar pestaña.
- **Session cookies server-side (sin JWT)** — Considerado. Más simple, pero perdemos stateless scaling. Para etapa SaaS está OK, pero JWT+refresh ofrece mejor UX con access corto + refresh largo.
- **OAuth2 / OIDC con proveedor externo (Auth0, Clerk)** — Diferido a cuando el producto crezca a multiempresa (Fase 8).

## Consecuencias

**Fáciles:**
- Cliente JS no maneja tokens — menos código, menos bugs.
- Compatible con SSR de Next.js (middleware lee cookies).
- Resistente a XSS.

**Difíciles:**
- Requiere configuración CORS cuidadosa (`credentials: 'include'` en fetch del cliente; API con `allow_credentials=True`).
- Setup local HTTPS necesita cert (mkcert) o proxy — en dev HTTP, `Secure=false`.

**Deuda aceptada:**
- CSRF double-submit en operaciones sensibles (no todas): gestionar lista explícita en código.

## Enlaces

- Futuro: `apps/api/app/auth/` (implementación)
- ADR-0002 (Stack)
