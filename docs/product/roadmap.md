# Roadmap — CivilCode Studio

Última actualización: **2026-11-15**. Timeline sujeto a ajuste tras cada fase.

## Fase 0 — Fundación (1-2 semanas) 🚧 EN CURSO

- [x] Auditoría exhaustiva de `Saas_PerformanceLabs` y `PlataformaDespieceVigas`.
- [x] Decisiones estratégicas tomadas con el founder.
- [x] Estructura de monorepo creada.
- [x] ADRs 0001-0008 redactados.
- [x] Configs raíz (pnpm, uv, docker-compose, editorconfig, gitignore).
- [ ] Commits pendientes en repos originales (los hace el founder).
- [ ] Inicializar git en `CivilCode_Platform/` (pendiente de luz verde).

## Fase 1 — Plataforma base, importación y visualización 3D (3-4 semanas)

- [ ] Copiar `Saas_PerformanceLabs/packages/engine/` → `packages/engine/`. Tests verdes en nueva ubicación.
- [ ] `packages/ui/` con 15 primitivos base + Storybook.
- [ ] `packages/icons/` con 20 iconos de dominio estructural.
- [ ] `apps/api/` skeleton: health, auth (cookies HttpOnly), proyectos, migraciones Alembic.
- [ ] `apps/web/` skeleton: shell (TopBar + Sidebar + CentralArea), dashboard vacío, proyectos.
- [ ] `apps/worker/` skeleton: Celery + Redis up, task demo con WebSocket feedback.
- [ ] Modelo de datos v1: Organization, User, Project, Building, Level, Element, Section, Material, Combination.
- [ ] Worker `import_etabs` + endpoint `POST /api/v1/buildings/import` + UI de upload con progreso.
- [ ] Visor 3D (migrar `ModelViewer3D.tsx` de Perf Labs) con selección y panel de propiedades.

**Criterio de aceptación:** ingeniero crea proyecto, sube `VitaTorre_Red_V00.e2k`, ve el edificio en 3D, selecciona viga y ve geometría + sección.

## Fase 2 — Análisis (2-3 semanas)

- [ ] Workers Celery: `modal`, `spectral` (migrados de Perf Labs).
- [ ] Resultados vinculados a elementos por `element_local_id`.
- [ ] Panel de propiedades muestra solicitaciones Pu/Mu/Vu por elemento y combinación.
- [ ] Advertencias del importador visibles en UI.

## Fase 3 — Portado de motores de vigas + nervios (4-5 semanas)

- [ ] Fixtures de validación cruzada TS↔Python (3-5 vigas de referencia).
- [ ] Portar: `rebar` → `envelope` → `beam-grouper` → `flexure` → `shear` → `optimizer` → `commercial-splices`.
- [ ] Portar `joist.designer`.
- [ ] Portar generador DXF con `ezdxf` (reemplaza `dxf-writer` TS).
- [ ] Portar generador PDF memoria con WeasyPrint/ReportLab.
- [ ] UI módulo vigas: lista + envolvente + despiece 2D SVG + tabla + adoptar.
- [ ] Workers Celery: `design_beams`, `design_joists`.

## Fase 3.5 — Torsión en vigas (1-2 semanas, opcional)

- [ ] Advertencia explícita cuando T no despreciable.
- [ ] Diseño a torsión NSR-10 C.11.5 para vigas de borde.

## Fase 4 — Detallado + editor 2D de planos + export (5-6 semanas)

- [ ] `DetailingUnit` persistido con vínculo a `DesignResult`.
- [ ] Editor 2D con Konva: canvas infinito, zoom, selección, cotas, textos, cajetín.
- [ ] Templates de lámina (A0, A1, personalizado).
- [ ] Viewports con `auto_update` (dirty/clean).
- [ ] Export PDF + DXF desde el editor.

**Criterio de aceptación — MVP:** ingeniero completa el flujo: crear proyecto → importar E2K → ver 3D → seleccionar viga → diseñar → adoptar → despiezar → arrastrar a lámina → exportar PDF+DXF+memoria.

## Fase 5 — Ampliación de motores (6-10 semanas)

Prioridad sugerida (ajustable):
- [ ] Zapatas aisladas, combinadas, corridas, excéntricas, vigas de amarre.
- [ ] Columnas (adoptar diseño de Perf Labs) + despiece propio.
- [ ] Muros RC 3D (finalizar lo de Perf Labs al 70-80%).
- [ ] Pilas preexcavadas.
- [ ] Pilotes y cabezales.
- [ ] Losas macizas y aligeradas.

## Fase 6 — Documentación y colaboración (3-4 semanas)

- [ ] Memorias Markdown/MDX → PDF LaTeX-grade (ecuaciones MathJax, figuras).
- [ ] Cantidades por elemento, nivel, proyecto; resúmenes.
- [ ] Portal cliente con visualización controlada y documentos aprobados.
- [ ] Portal constructor con selección 3D → plano vigente + comentarios/RFIs.
- [ ] Sistema de comentarios con anchors 3D y 2D.
- [ ] Versioning de láminas y documentos.

## Fase 7 — BIM (6+ semanas)

- [ ] Import IFC (ifcopenshell).
- [ ] Visualización multidisciplinar en 3D (toggle de disciplinas).
- [ ] Coordinación de modelos (sin colisiones todavía; solo visual).

## Fase 8 — Multiempresa comercial (continuo)

- [ ] Multitenancy (schema-per-org o tenant_id).
- [ ] Billing (Stripe), planes, feature flags.
- [ ] White-labeling.
- [ ] SSO (opcional).

---

## Timeline agregado

| Hito | Semanas desde inicio |
|---|---|
| Fase 0 completa | 2 |
| Fase 1 (importar + visualizar + skeleton completo) | 6 |
| Fase 2 (análisis) | 9 |
| Fase 3 (motores vigas+nervios portados) | 14 |
| Fase 4 (editor planos + MVP completo) | 20 |
| Fase 5 (todos los elementos) | 30 |
| Fase 6 (colaboración + portales) | 34 |
| Fase 7 (BIM) | 40 |
| Fase 8 (comercialización) | 40+ |

Con 1 desarrollador full-time + apoyo continuo del founder como SME.
