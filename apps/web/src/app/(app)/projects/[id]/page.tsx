'use client'

import { BuildingsPanel } from '@/components/project/BuildingsPanel'
import { Breadcrumb } from '@/components/shell/Breadcrumb'
import {
  ApiError,
  type OverviewStats,
  type Project,
  type RecentActivityItem,
  projects as projectsApi,
  stats as statsApi,
} from '@/lib/api'
import {
  BeamIcon,
  ColumnIcon,
  CubeIcon,
  DxfIcon,
  MomentIcon,
  SheetIcon,
  WallIcon,
} from '@civilcode/icons'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@civilcode/ui'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'

type Tab = 'overview' | 'model' | 'analysis' | 'design' | 'documents'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'model', label: 'Modelo 3D' },
  { id: 'analysis', label: 'Análisis' },
  { id: 'design', label: 'Diseño' },
  { id: 'documents', label: 'Documentos' },
]

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([projectsApi.get(id), statsApi.overview(id)])
      .then(([p, s]) => {
        setProject(p)
        setOverview(s)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <p className="text-cc-danger-600">{error ?? 'Proyecto no encontrado'}</p>
        <Link href="/projects" className="text-cc-cyan-600 text-sm hover:underline">
          Volver a proyectos
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Hero light con breadcrumb + nombre + stats inline */}
      <section className="border-cc-gray-200 border-b bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Breadcrumb
            items={[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/projects', label: 'Proyectos' },
              { label: project.code },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="info">{project.code}</Badge>
                <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl tracking-tight dark:text-white">
                  {project.name}
                </h1>
              </div>
              <p className="mt-1.5 text-cc-gray-500 text-sm">
                {project.client ?? 'Sin cliente'}
                {project.location && ` · ${project.location}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <InlineStat label="Edificios" value={overview?.n_buildings ?? 0} />
              <InlineStat
                label="Rev. imported"
                value={overview?.n_revisions_imported ?? 0}
                sub={overview ? `/ ${overview.n_revisions_total}` : undefined}
              />
              <InlineStat label="Diseños" value={overview?.n_designs_completed ?? 0} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs defaultValue="overview">
          <TabsList className="overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab project={project} overview={overview} />
          </TabsContent>
          <TabsContent value="model">
            <BuildingsPanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="analysis">
            <PlaceholderTab
              title="Análisis"
              phase="Abre un análisis desde 'Modelo 3D' en cada revisión importada"
            />
          </TabsContent>
          <TabsContent value="design">
            <DesignTab />
          </TabsContent>
          <TabsContent value="documents">
            <PlaceholderTab
              title="Documentos"
              phase="Descarga DXF / PDF desde cada diseño completado"
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}

function InlineStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-cc-gray-200 bg-cc-gray-50 px-3 py-1.5 dark:border-cc-navy-700 dark:bg-cc-navy-800">
      <span className="font-mono font-bold text-cc-cyan-600 text-sm dark:text-cc-cyan-400">
        {value}
        {sub && <span className="text-cc-gray-400 text-xs ml-0.5">{sub}</span>}
      </span>
      <span className="cc-label-mono text-[10px]">{label}</span>
    </div>
  )
}

function OverviewTab({
  project,
  overview,
}: {
  project: Project
  overview: OverviewStats | null
}) {
  return (
    <div className="space-y-6">
      {/* 4 stat cards premium */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <OverviewStat
          icon={<CubeIcon size={20} />}
          accent="#22d3ee"
          label="Edificios"
          value={overview?.n_buildings ?? 0}
        />
        <OverviewStat
          icon={<DxfIcon size={20} />}
          accent="#3b82f6"
          label="Revisiones imported"
          value={overview?.n_revisions_imported ?? 0}
          sublabel={overview ? `${overview.n_revisions_total} totales` : undefined}
        />
        <OverviewStat
          icon={<MomentIcon size={20} />}
          accent="#6366f1"
          label="Análisis completados"
          value={overview?.n_analyses_completed ?? 0}
          sublabel={overview ? `${overview.n_analyses_total} totales` : undefined}
        />
        <OverviewStat
          icon={<BeamIcon size={20} />}
          accent="#8b5cf6"
          label="Diseños completados"
          value={overview?.n_designs_completed ?? 0}
          sublabel={overview ? `${overview.n_designs_total} totales` : undefined}
        />
      </div>

      {/* Info + Descripción */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <CardTitle>Información</CardTitle>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Código" value={project.code} />
              <Row label="Nombre" value={project.name} />
              <Row label="Cliente" value={project.client ?? '—'} />
              <Row label="Ubicación" value={project.location ?? '—'} />
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <CardTitle>Descripción</CardTitle>
            <CardDescription className="mt-2 whitespace-pre-wrap">
              {project.description ?? 'Sin descripción. Agrega una desde la edición del proyecto.'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Actividad reciente */}
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="mb-3">Actividad reciente</CardTitle>
          {!overview || overview.recent_activity.length === 0 ? (
            <p className="py-4 text-center text-cc-gray-500 text-sm">
              Sin actividad aún. Sube un modelo ETABS desde la tab "Modelo 3D" para comenzar.
            </p>
          ) : (
            <ul className="divide-y divide-cc-gray-100 dark:divide-cc-navy-800">
              {overview.recent_activity.map((a, i) => (
                <ActivityRow key={`${a.kind}-${a.created_at}-${i}`} item={a} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OverviewStat({
  icon,
  accent,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
  sublabel?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: accent,
              border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
            }}
          >
            {icon}
          </span>
          <p className="cc-label-mono text-[10px]">{label}</p>
        </div>
        <p className="font-mono font-bold text-cc-gray-900 text-2xl dark:text-white">{value}</p>
        {sublabel && <p className="mt-1 text-cc-gray-400 text-xs">{sublabel}</p>}
      </CardContent>
    </Card>
  )
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  const when = new Date(item.created_at).toLocaleString('es-CO', {
    hour12: false,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const icon =
    item.kind === 'import' ? (
      <CubeIcon size={16} className="text-cc-cyan-600" />
    ) : item.kind === 'analysis' ? (
      <MomentIcon size={16} className="text-cc-blue-600" />
    ) : (
      <BeamIcon size={16} className="text-cc-cyan-600" />
    )
  const kindLabel = { import: 'Importación', analysis: 'Análisis', design: 'Diseño' }[item.kind]
  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    item.status === 'imported' || item.status === 'completed'
      ? 'success'
      : item.status === 'completed_with_warnings'
        ? 'warning'
        : item.status === 'invalid' || item.status === 'failed'
          ? 'danger'
          : 'info'
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-cc-gray-900 dark:text-white">
            <span className="text-cc-gray-500">{kindLabel}: </span>
            <span className="font-medium">{item.label}</span>
          </p>
          <p className="truncate text-cc-gray-400 text-xs">{when}</p>
        </div>
      </div>
      {item.status && <Badge variant={statusVariant}>{item.status}</Badge>}
    </li>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="cc-label-mono text-[10px]">{label}</dt>
      <dd className="text-cc-gray-900 text-sm dark:text-white">{value}</dd>
    </div>
  )
}

function PlaceholderTab({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <SheetIcon size={48} className="mx-auto mb-4 text-cc-gray-400" />
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2">{phase}</CardDescription>
      </CardContent>
    </Card>
  )
}

function DesignTab() {
  const MODULES = [
    {
      href: '/design/beams',
      label: 'Vigas',
      Icon: BeamIcon,
      accent: '#22d3ee',
      active: true,
      phase: 'Fase 3a-b · listo',
    },
    {
      href: '/design/columns',
      label: 'Columnas',
      Icon: ColumnIcon,
      accent: '#3b82f6',
      active: true,
      phase: 'Fase 3c · listo',
    },
    {
      href: '/design/walls',
      label: 'Muros',
      Icon: WallIcon,
      accent: '#6366f1',
      active: true,
      phase: 'Fase 3d · listo',
    },
    {
      href: '/design/footings',
      label: 'Zapatas',
      Icon: WallIcon,
      accent: '#8b5cf6',
      active: true,
      phase: 'Fase 3e · listo',
    },
    {
      href: '/design/joists',
      label: 'Nervios',
      Icon: BeamIcon,
      accent: '#10b981',
      active: false,
      phase: 'Comparte pipeline de vigas',
    },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {MODULES.map(({ href, label, Icon, accent, active, phase }, i) => (
        <Link
          key={href}
          href={active ? href : '#'}
          className="cc-tool-card cc-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-2"
          data-active={active}
          style={{
            ['--_card-accent' as string]: accent,
            animationDelay: `${i * 60}ms`,
          }}
          onClick={(e) => {
            if (!active) e.preventDefault()
          }}
        >
          <div className="flex items-start justify-between">
            <span
              className="cc-tool-card-icon"
              style={{ ['--_card-accent' as string]: accent }}
            >
              <Icon size={20} />
            </span>
            <Badge variant={active ? 'success' : 'neutral'}>
              {active ? 'Listo' : 'Pronto'}
            </Badge>
          </div>
          <div>
            <p className="font-semibold text-sm text-cc-gray-900 dark:text-white">{label}</p>
            <p className="mt-1 text-xs text-cc-gray-500 dark:text-cc-gray-400">{phase}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
