# ADR-0008: Identidad visual y design system

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales · Diseño

## Contexto

Necesitamos un sistema visual coherente que cubra:
- Workspace técnico interno del ingeniero (densidad alta, 3D, editor 2D).
- Dashboard administrativo.
- Portales públicos (cliente, constructor) — tono más ligero, SSR, SEO.
- Memorias PDF y planos (cajetines, títulos) — print-ready.

Referencias visuales aportadas por el founder: `Logos.png` (logo oficial de CivilCode), `descarga.jpg` (Yaro Nexora Web), `Modern IT Services - TechNova`, `NovaLyne.jpg`.

Análisis en el diagnóstico inicial: paleta derivada del logo (navy + cyan), modo oscuro default en workspace, modo claro default en dashboard y portales.

## Decisión

### Paleta primaria (tokens CSS, para Tailwind v4 `@theme`)

```css
--cc-navy-950: #060E1F;
--cc-navy-900: #0B1E3F;   /* fondos dark principales (sidebar, header) */
--cc-navy-800: #122A54;   /* superficies elevadas en dark */
--cc-navy-700: #1A3A70;   /* bordes y divisores dark */
--cc-navy-600: #244A8E;

--cc-blue-700: #1858C7;
--cc-blue-600: #1E6FE8;   /* acción primaria, links, selección */
--cc-blue-500: #2E82FA;   /* hover primario */
--cc-blue-400: #5AA0FF;

--cc-cyan-600: #0098BD;
--cc-cyan-500: #00B8E0;   /* acento, barras de progreso, highlights */
--cc-cyan-400: #4DD0F0;
--cc-cyan-300: #6DE0F5;   /* chips, badges informativos */

--cc-white: #FFFFFF;
--cc-gray-50: #F7F9FC;    /* fondo light */
--cc-gray-100: #ECF1F7;
--cc-gray-200: #DAE2EE;
--cc-gray-300: #BDC9D9;
--cc-gray-500: #64748B;
--cc-gray-700: #334155;
--cc-gray-900: #0F1724;   /* texto principal en light */
```

### Semánticos (estados de diseño estructural)

```css
--cc-success-600: #059669;
--cc-success-500: #10B981;   /* CUMPLE · APROBADO */
--cc-success-100: #D1FAE5;

--cc-warn-600: #D97706;
--cc-warn-500: #F59E0B;      /* REVISIÓN · PENDIENTE */
--cc-warn-100: #FEF3C7;

--cc-danger-600: #DC2626;
--cc-danger-500: #EF4444;    /* NO CUMPLE · RECHAZADO */
--cc-danger-100: #FEE2E2;

--cc-info-500: #0EA5E9;      /* informativo */
--cc-neutral-500: #94A3B8;   /* SIN DISEÑAR */
```

### Tipografía

- **UI principal:** **Inter** (variable, pesos 400/500/600/700). Cargada vía `next/font` con subset latin.
- **Monoespaciada** (IDs de elementos, coordenadas, valores numéricos en tablas densas): **JetBrains Mono** (variable).
- **Display** (hero de landing, opcional): Inter en pesos 700/800 con tracking ajustado, sin fuente adicional por ahora.

### Modos

- **Dark default** en rutas `/app/workspace`, `/app/design/*`, `/app/draw/*`, `/app/analysis/*`.
- **Light default** en `/app/dashboard`, `/app/projects`, `/portal/*`, páginas públicas, memorias PDF.
- Toggle persistente por usuario en preferencias.

### Elevación

- Sombras muy sutiles (`0 1px 2px rgba(0,0,0,0.05)` máximo en light; en dark solo bordes de 1px).
- Capas se distinguen por color de fondo + borde `1px solid var(--cc-navy-700)` o `1px solid var(--cc-gray-200)`.

### Iconografía

- **Lucide** (`lucide-react`, stroke 1.5) para iconos genéricos.
- **`packages/icons/`** para iconos de dominio estructural (set propio, ~20): viga, columna, muro, zapata, pila, pilote, cabezal, nervio, losa, nodo, eje, nivel, diafragma, apoyo, carga, combinación, momento, cortante, deformada, plano.

### Componentes

- **Primitivos propios** en `packages/ui/` construidos sobre **Radix UI headless** + Tailwind v4.
- Sin MUI, Ant, Chakra.
- Lista mínima para Fase 1 (15 componentes): Button, Input, Label, Select, Dialog, Toast, Table, Tabs, SplitPane, Tooltip, CommandPalette, Card, Badge, Avatar, Skeleton.

### Logo

- Oficial: `Logos.png` del repo. **No rediseñar**.
- Variantes a derivar (Fase 1):
  - Marca completa (logo + wordmark) para header expandido y portales.
  - Isotipo (solo hexágono) para sidebar colapsada, favicon, loader.
  - Fondo claro y fondo oscuro.
  - Formatos: SVG, PNG@1x/@2x, ICO.

## Alternativas consideradas

- **Material Design** — Rechazado: prescriptivo y genérico.
- **Chakra / Mantine** — Rechazado: librerías pesadas, difíciles de personalizar al 100% con identidad propia.
- **Modo único (solo light o solo dark)** — Rechazado: ingenieros pasan horas en workspace; dark reduce fatiga. Portales/dashboard en light proyecta profesionalismo.

## Consecuencias

**Fáciles:**
- Paleta pequeña y disciplinada: fácil de mantener consistente.
- Tokens CSS permiten dual mode (dark/light) sin duplicar componentes.
- Radix UI resuelve accesibilidad gratis (ARIA, foco, teclado).

**Difíciles:**
- Mantener coherencia dark/light en cada componente requiere diseñar ambos modos desde el inicio.
- Iconografía propia tarda — pero es inversión de marca con alto impacto.

**Deuda aceptada:**
- Memorias PDF en MVP usan la misma paleta que la web; refinamiento print-specific en Fase 6.

## Enlaces

- [`Logos.png`](../../Logos.png) · [`NovaLyne.jpg`](../../NovaLyne.jpg) · [`descarga.jpg`](../../descarga.jpg) · [Modern IT Services](../../Modern%20IT%20Services%20&%20Software%20Solutions%20Website%20UI_UX%20Design.jpg)
- ADR-0002 (Stack técnico — Tailwind v4)
- Futuro: `packages/ui/README.md` (uso del design system)
