# ADR-0005: Nombre del producto — "CivilCode Studio"

**Fecha:** 2026-11-15
**Estado:** Aceptado
**Decisores:** Frank Vidales

## Contexto

El producto necesita un nombre público consistente para usar en UI, dominios, cajetines de plano, PDFs, correos a clientes/constructores y marketing futuro. El nombre interno de la carpeta técnica es `CivilCode_Platform`, pero no es el nombre comercial.

## Decisión

Nombre público del producto: **"CivilCode Studio"**.

- Nombre de la empresa: **CivilCode Solutions** (sin cambio).
- Nombre del producto SaaS: **CivilCode Studio**.
- Nombre de la carpeta técnica: `CivilCode_Platform` (sin cambio, por evitar romper paths en scripts y memorias existentes).
- Logo oficial: `Logos.png` del repo (hexágono + wordmark CivilCode). Sin rediseño.
- Tagline provisional: *"Plataforma integral de ingeniería estructural"* (se refinará con marketing).

### Uso en artefactos

- **UI web:** `<title>CivilCode Studio</title>`, logo + "Studio" en navbar.
- **Cajetín de plano:** firma "CivilCode Studio · [código proyecto] · [fecha] · [revisión]".
- **Memorias PDF:** header con logo + "CivilCode Studio · Memoria técnica".
- **Correos sistema:** From "CivilCode Studio <noreply@...>" (dominio por decidir).
- **Dominios candidatos** (reservar): `civilcode.studio`, `app.civilcode.co`, `studio.civilcodesolutions.com` — decidir en ADR específico cuando se defina deployment productivo.

## Alternativas consideradas

- **CivilCode Platform** — Rechazado: suena burocrático, "platform" es término sobrecargado.
- **CivilCode Suite** — Rechazado: "suite" sugiere colección de apps inconexas.
- **CivilCode Cloud** — Rechazado: enfatiza infraestructura en lugar de experiencia.
- **CivilCode Workbench** — Considerado pero rechazado por el founder a favor de "Studio".

"Studio" evoca workspace creativo + profesional (Visual Studio, Android Studio, Figma, FL Studio), lo que alinea con el posicionamiento: software técnico de alto nivel para ingenieros profesionales.

## Consecuencias

- Definido para toda comunicación interna y externa desde 2026-11-15.
- Cambio futuro requeriría refactor de strings en UI, templates PDF/DXF, plantillas de correo. Cuanto antes se consolide, menos deuda.

## Enlaces

- [`Logos.png`](../../Logos.png)
- README raíz
