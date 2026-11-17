# apps/web — Next.js 16

Frontend de CivilCode Studio. Next.js 16 con App Router, React 19, TypeScript strict, Tailwind v4.

## Estructura (propuesta Fase 1)

```
src/
├── app/
│   ├── (marketing)/           Landing pública (SSR/SSG)
│   ├── (auth)/                login, register, forgot-password
│   ├── (app)/                 Workspace autenticado
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── workspace/[projectId]/   (shell con sidebar + viewer 3D)
│   │   ├── design/
│   │   ├── draw/              (editor 2D)
│   │   ├── documents/
│   │   └── settings/
│   └── (portal)/              Portales públicos cliente/constructor (SSR)
├── components/                Composiciones específicas (no reutilizables cross-app)
├── lib/                       Utilidades, hooks, API client
└── styles/
    └── globals.css            (tokens Tailwind v4 en @theme)
```

## Dev (futuro)

```bash
cd apps/web
pnpm install
pnpm dev
```
