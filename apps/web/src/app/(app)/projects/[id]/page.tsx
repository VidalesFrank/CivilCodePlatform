'use client'

import { BuildingsPanel } from '@/components/project/BuildingsPanel'
import {
  ApiError,
  type OverviewStats,
  type Project,
  type RecentActivityItem,
  projects as projectsApi,
  stats as statsApi,
} from '@/lib/api'
import { BeamIcon, ColumnIcon, CubeIcon, DxfIcon, MomentIcon, SheetIcon, WallIcon } from '@civilcode/icons'
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
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <p className="text-cc-danger-600">{error ?? 'Proyecto no encontrado'}</p>
        <Link href="/projects" className="text-cc-blue-600 text-sm hover:underline">
          Volver a proyectos
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <Link
            href="/projects"
            className="text-cc-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1"
          >
            ← Proyectos
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">{project.code}</Badge>
          <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl dark:text-white">
            {project.name}
          </h1>
        </div>
        <p className="mt-1 text-cc-gray-500 text-sm">
          {project.client ?? 'Sin cliente'} · {project.location ?? 'Sin ubicación'}
        </p>
      </div>

      <Tabs defaultValue="overview" className="mb-4">
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
          <PlaceholderTab title="Análisis" phase="Fase 2 — abrir desde Modelo 3D en la revisión" />
        </TabsContent>
        <TabsContent value="design">
          <DesignTab />
        </TabsContent>
        <TabsContent value="documents">
          <PlaceholderTab title="Documentos" phase="Descarga DXF/PDF desde cada diseño completado" />
        </TabsContent>
      </Tabs>
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
      {/* Stats cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <OverviewStat
          icon={<CubeIcon size={20} className="text-cc-cyan-600" />}
          label="Edificios"
          value={overview?.n_buildings ?? 0}
        />
        <OverviewStat
          icon={<DxfIcon size={20} className="text-cc-blue-600" />}
          label="Revisiones imported"
          value={overview?.n_revisions_imported ?? 0}
          sublabel={overview ? `${overview.n_revisions_total} totales` : undefined}
        />
        <OverviewStat
          icon={<MomentIcon size={20} className="text-cc-blue-600" />}
          label="Análisis completados"
          value={overview?.n_analyses_completed ?? 0}
          sublabel={overview ? `${overview.n_analyses_total} totales` : undefined}
        />
        <OverviewStat
          icon={<BeamIcon size={20} className="text-cc-cyan-600" />}
          label="Diseños completados"
          value={overview?.n_designs_completed ?? 0}
          sublabel={overview ? `${overview.n_designs_total} totales` : undefined}
        />
      </div>

      {/* Info + Descripción + Actividad */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <CardTitle className="text-base">Información</CardTitle>
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
            <CardTitle className="text-base">Descripción</CardTitle>
            <CardDescription className="mt-2 whitespace-pre-wrap">
              {project.description ?? 'Sin descripción. Agrega una desde edición del proyecto.'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Actividad reciente del proyecto */}
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="mb-3 text-base">Actividad reciente</CardTitle>
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
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sublabel?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <p className="text-cc-gray-500 text-xs uppercase tracking-wide">{label}</p>
        </div>
        <p className="font-bold text-cc-gray-900 text-2xl dark:text-white">{value}</p>
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
      <dt className="text-cc-gray-500">{label}</dt>
      <dd className="text-cc-gray-900 dark:text-white">{value}</dd>
    </div>
  )
}

function PlaceholderTab({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <SheetIcon size={48} className="mx-auto mb-4 text-cc-gray-400" />
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-2">{phase}</CardDescription>
      </CardContent>
    </Card>
  )
}

function DesignTab() {
  const MODULES = [
    { href: '/design/beams', label: 'Vigas', Icon: BeamIcon, phase: 'Fase 3a-b · listo' },
    { href: '/design/columns', label: 'Columnas', Icon: ColumnIcon, phase: 'Fase 3c · listo' },
    { href: '/design/walls', label: 'Muros', Icon: WallIcon, phase: 'Fase 3d · próximamente' },
    { href: '/design/footings', label: 'Zapatas', Icon: WallIcon, phase: 'Fase 3e · próximamente' },
    { href: '/design/joists', label: 'Nervios', Icon: BeamIcon, phase: 'Fase 3f · próximamente' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {MODULES.map(({ href, label, Icon, phase }) => (
        <Link
          key={href}
          href={href}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-lg"
        >
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <Icon size={28} className="mb-3 text-cc-blue-600" />
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="mt-1">{phase}</CardDescription>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
