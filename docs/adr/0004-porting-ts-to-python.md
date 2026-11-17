# ADR-0004: Portado de motores TS → Python desde el inicio

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales · Arquitectura
**Historia:** Decisión estratégica confirmada por el founder en Fase 0

## Contexto

`PlataformaDespieceVigas` tiene los siguientes motores escritos en **TypeScript puro** (sin acoplamiento a UI ni Express):

| Módulo | Archivo | Líneas aprox |
|---|---|---|
| Parser ETABS | `backend/src/parsers/etabs.parser.ts` | ~170 |
| Beam grouper (colinealidad, apoyos, voladizos) | `backend/src/design/beam-grouper.ts` | 292 |
| Envelope (interpolación + max/min por caso) | `backend/src/design/envelope.ts` | 120 |
| Flexión NSR-10 | `backend/src/design/flexure.ts` | 360 |
| Cortante NSR-10 (DES/DMO) | `backend/src/design/shear.ts` | 220 |
| Optimizer (capas, calibre único) | `backend/src/design/optimizer.ts` | ~250 |
| Traslapos comerciales | `backend/src/design/commercial-splices.ts` | ~250 |
| Rebar DB | `backend/src/design/rebar.ts` | ~100 |
| Joist designer (nervios) | `backend/src/design/joist.designer.ts` | ~? |
| Generador DXF propio | `backend/src/export/dxf.generator.ts` + `dxf-core/` | ~650 |
| Generador PDF memoria | `backend/src/export/memoria.generator.ts` | ~350 |

Opciones evaluadas:
- **Opción A — Portar a Python ya**, para unificar con `packages/engine`.
- **Opción B — Dejar TS, envolver en servicio HTTP** y llamar desde FastAPI; portar más adelante.

## Decisión

**Opción A: portar todo a Python desde el inicio.** El founder confirmó explícitamente esta decisión.

### Plan de portado (fases)

**Fase 3.1 — Portado core + tests de contrato (3 semanas)**
1. Escribir **fixtures de validación cruzada**: tomar 3-5 vigas del `Input_Etabs_nuevo.xlsx` de PlataformaDespieceVigas, correr el diseño en TS actual, capturar: envolvente, flexión, cortante, despiece, DXF, memoria. Guardar como JSON de referencia.
2. Portar módulos puros (en orden): `rebar.ts` → `envelope.ts` → `beam-grouper.ts` → `flexure.ts` → `shear.ts` → `optimizer.ts` → `commercial-splices.ts`.
3. Cada módulo se porta **con tests pytest que carguen los JSON de referencia** y verifiquen que el output Python coincide numéricamente con el TS (tolerancia 1e-6 para floats).

**Fase 3.2 — Portado de generadores de salida (2 semanas)**
4. Generador DXF: reemplazar `dxf-writer` TypeScript por **`ezdxf`** Python. Mantener la misma estructura de capas (CC_*) y bloques (CC_B_Eje, CC_B_Estribo_*). Validar comparando entidades DXF entre output TS y output Python para los mismos casos.
5. Generador PDF memoria: reemplazar `pdfkit` TypeScript por **WeasyPrint** o **ReportLab** (decisión en ADR aparte). Validar comparando contenido semántico (no pixel-perfect).

**Fase 3.3 — Integración con API (1 semana)**
6. Exponer motores vía endpoints `POST /api/v1/design/beams/compute` y `POST /api/v1/design/joists/compute`.
7. Workers Celery específicos para diseño largo.

### Gap crítico a resolver durante el portado

**Torsión** — la implementación TS actual extrae T del Excel pero **NO la diseña**. En el portado:
- Mínimo: advertencia explícita cuando T no es despreciable.
- Deseable: implementar diseño a torsión NSR-10 C.11.5 para vigas de borde.

## Alternativas consideradas

- **Opción B: wrapper Node vía HTTP** — Rechazada por el founder. Pros: integración inmediata (semanas). Contras: dos stacks en producción, duplicación de dominio futura, fricción al compartir código con diseño de columnas/muros/zapatas.
- **Reescritura completa desde cero en Python sin referenciar TS** — Rechazada: perderíamos la validación empírica que el motor TS ya tiene (outputs DXF reales verificados).

## Consecuencias

**Fáciles:**
- Un solo lenguaje de ingeniería en todo el producto. NumPy/SciPy disponibles si en el futuro queremos optimización, ML, análisis probabilístico.
- Tests unificados (pytest), lint unificado (ruff), despliegue unificado.
- Compartir utilidades entre despiece de vigas y despiece de otros elementos (en fases futuras: columnas, muros, zapatas).

**Difíciles:**
- 3-4 semanas de portado antes de tener diseño de vigas funcional en CivilCode Studio.
- Riesgo de divergencia numérica sutil (diferencias de redondeo, tipos float) — mitigado por la suite de fixtures de validación cruzada.

**Deuda aceptada:**
- `PlataformaDespieceVigas` queda como snapshot de referencia (no se elimina). Útil para comparar outputs durante el portado y como oracle si aparece una regresión.

## Enlaces

- `C:\00_Desarrollo\PlataformaDespieceVigas\` (código fuente a portar)
- ADR-0003 (Engine Python como contrato)
- Futuro ADR: Librería para generación de memorias PDF (WeasyPrint vs ReportLab)
