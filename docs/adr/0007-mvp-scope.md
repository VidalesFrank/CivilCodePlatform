# ADR-0007: Alcance del MVP

**Fecha:** 2026-11-15
**Estado:** Propuesto (pendiente confirmación final del founder)
**Decisores:** Frank Vidales · Arquitectura

## Contexto

Necesitamos un MVP con alcance claro, defensible, y que demuestre el flujo end-to-end del producto. Un MVP demasiado grande arriesga nunca terminarse; demasiado pequeño no valida la arquitectura.

## Decisión (propuesta)

**MVP = un flujo completo y confiable, con vigas + nervios como elementos de ejemplo.**

### Dentro del MVP ✅

1. **Autenticación** — registro, login, logout, refresh (cookies HttpOnly, ADR-0006).
2. **Proyectos** — crear, listar, abrir, metadatos básicos (nombre, código, cliente, ubicación).
3. **Importación ETABS** — E2K + XLSX, reporte de validación, warnings. Caso de prueba: `VitaTorre_Red_V00.e2k`.
4. **Modelo canónico** — persistido en PostgreSQL + archivos en MinIO.
5. **Visualizador 3D** — geometría extruida, selección, panel de propiedades. Filtros por nivel, categoría, visible/oculto.
6. **Análisis modal + espectral NSR-10** — vía workers Celery, con feedback en tiempo real (WebSocket).
7. **Diseño de vigas + nervios** — motores portados de TypeScript a Python (ADR-0004). Propuesta + adopción.
8. **Despiece** — barras longitudinales, estribos, traslapos, ganchos, longitudes de desarrollo.
9. **Editor 2D de planos** — 1 a 3 láminas con viewports de plantas de vigas + detalles despiece.
10. **Exportación** — PDF (lámina + memoria básica), DXF (plano).
11. **Dashboard mínimo** — lista de proyectos activos + accesos a módulos permitidos.

### Fuera del MVP (fases posteriores) ❌

| Área | Fase |
|---|---|
| Diseño de columnas (código base en Perf Labs) | 5 |
| Diseño de muros RC (código base en Perf Labs, 70-80%) | 5 |
| Diseño de zapatas, pilas, pilotes, cabezales | 5 |
| Diseño de losas (macizas, aligeradas) | 5 |
| Análisis NLTH, IDA, pushover (código base en Perf Labs) | 5 |
| Diseño a torsión en vigas (gap crítico identificado) | 3.5 (post-MVP corto) |
| Portal cliente (visualización controlada) | 6 |
| Portal constructor (selección 3D → plano vigente) | 6 |
| Memorias LaTeX-grade (ecuaciones, figuras) | 6 |
| Cálculo de cantidades detallado + presupuestos | 6 |
| Comentarios y revisiones colaborativas | 6 |
| Importación IFC / integración BIM | 7 |
| Multiempresa (tenancy) + billing | 8 |
| White-labeling | 8 |

## Alternativas consideradas

- **Solo vigas (sin nervios) en MVP** — Rechazado: los nervios comparten repo y motor con vigas; portarlos juntos cuesta ~15% más de esfuerzo pero duplica el valor demostrable.
- **Añadir columnas al MVP** — Rechazado: el motor de columnas de Perf Labs está listo, pero el despiece de columnas NO existe en ningún lado. Diseñar columnas sin poder despiezarlas rompe el "flujo end-to-end" del MVP.
- **MVP sin editor 2D (solo exports automáticos)** — Rechazado: la propuesta de valor incluye "disminuir dependencia de AutoCAD"; sin editor eso es mentira.

## Consecuencias

**Fáciles:**
- Scope defensible: "1 flujo completo, 2 tipos de elementos, 1 plano real".
- Timeline realista: **12-16 semanas** con 1 dev full-time + apoyo del founder como SME.
- Cada módulo fuera del MVP tiene cimientos ya hechos (columnas en Perf Labs, etc.) para Fase 5 rápida.

**Difíciles:**
- Tentación de añadir "solo una cosa más" (columnas, portal). Resistir — scope creep mata MVPs.
- El editor 2D es la pieza más riesgosa. Alcance mínimo: Konva, ~15 herramientas, sin funciones de dibujo libre avanzado.

**Deuda aceptada:**
- Torsión en vigas: warning en MVP, implementación en Fase 3.5.
- Memorias en MVP serán "feas" (jspdf/weasyprint simple). Mejora en Fase 6.

## Enlaces

- ADR-0004 (Portado TS→Python)
- Roadmap completo: `docs/product/roadmap.md` (por crear)
