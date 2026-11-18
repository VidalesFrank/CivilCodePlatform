'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
} from '@civilcode/ui'
import {
  BeamIcon,
  CubeIcon,
  DxfIcon,
  MomentIcon,
  SheetIcon,
} from '@civilcode/icons'
import {
  auth,
  projects as projectsApi,
  stats as statsApi,
  type OverviewStats,
  type Project,
  type RecentActivityItem,
  type UserPublic,
} from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([auth.me(), statsApi.overview(), projectsApi.list()])
      .then(([u, s, ps]) => {
        setUser(u)
        setOverview(s)
        setProjects(ps)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const greeting = user?.full_name ? user.full_name.split(' ')[0] : 'Ingeniero'

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <p className="text-cc-gray-500 text-sm">Hola de nuevo,</p>
        <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl dark:text-white">
          {loading ? <Skeleton className="h-9 w-48" /> : greeting}
        </h1>
        <p className="mt-1 text-cc-gray-500 text-sm">
          Resumen de tu actividad en CivilCode Studio.
        </p>
      </div>

      {/* KPI stats */}
      <div className="mb-8 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<SheetIcon size={20} className="text-cc-blue-600" />}
          label="Proyectos"
          value={overview?.n_projects ?? 0}
          loading={loading}
          href="/projects"
        />
        <StatCard
          icon={<CubeIcon size={20} className="text-cc-cyan-600" />}
          label="Edificios"
          value={overview?.n_buildings ?? 0}
          loading={loading}
          sublabel={
            overview
              ? `${overview.n_revisions_imported} / ${overview.n_revisions_total} revisiones imported`
              : undefined
          }
        />
        <StatCard
          icon={<MomentIcon size={20} className="text-cc-blue-600" />}
          label="Análisis"
          value={overview?.n_analyses_completed ?? 0}
          loading={loading}
          sublabel={overview ? `${overview.n_analyses_total} totales` : undefined}
        />
        <StatCard
          icon={<BeamIcon size={20} className="text-cc-cyan-600" />}
          label="Diseños"
          value={overview?.n_designs_completed ?? 0}
          loading={loading}
          sublabel={overview ? `${overview.n_designs_total} totales` : undefined}
        />
      </div>

      {/* Dos columnas: Recent activity + Recent projects */}
      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {/* Actividad reciente */}
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle className="text-base">Actividad reciente</CardTitle>
              {overview && overview.recent_activity.length > 0 && (
                <span className="text-cc-gray-400 text-xs">
                  {overview.recent_activity.length} eventos
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !overview || overview.recent_activity.length === 0 ? (
              <EmptyMiniState text="Sin actividad reciente. Crea un proyecto para empezar." />
            ) : (
              <ul className="divide-y divide-cc-gray-100 dark:divide-cc-navy-800">
                {overview.recent_activity.map((a, i) => (
                  <ActivityRow
                    key={`${a.kind}-${a.revision_id}-${a.created_at}-${i}`}
                    item={a}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Proyectos recientes */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <CardTitle className="text-base">Proyectos recientes</CardTitle>
              {!loading && projects.length > 0 && (
                <Link
                  href="/projects"
                  className="text-cc-blue-600 text-xs hover:underline"
                >
                  Ver todos →
                </Link>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <EmptyMiniState
                text="Aún no tienes proyectos."
                cta={{ href: '/projects', label: 'Crear proyecto' }}
              />
            ) : (
              <ul className="space-y-2">
                {projects.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="group flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-cc-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 dark:hover:bg-cc-navy-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-cc-gray-900 dark:text-white">
                          {p.name}
                        </p>
                        <p className="truncate text-cc-gray-500 text-xs">
                          {p.client ?? 'Sin cliente'}
                        </p>
                      </div>
                      <Badge variant="info">{p.code}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-8 sm:mt-10">
        <h2 className="mb-3 font-semibold text-cc-gray-900 text-lg dark:text-white">
          Acciones rápidas
        </h2>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <QuickAction
            href="/projects"
            icon={<SheetIcon size={24} className="text-cc-blue-600" />}
            title="Nuevo proyecto"
            desc="Empieza un proyecto estructural"
          />
          <QuickAction
            href="/design/beams"
            icon={<BeamIcon size={24} className="text-cc-cyan-600" />}
            title="Diseñar vigas"
            desc="Flexión + cortante NSR-10"
          />
          <QuickAction
            href="/settings/organization"
            icon={<DxfIcon size={24} className="text-cc-blue-600" />}
            title="Miembros"
            desc="Gestiona tu organización"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  loading,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sublabel?: string
  loading: boolean
  href?: string
}) {
  const body = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <p className="text-cc-gray-500 text-xs uppercase tracking-wide">{label}</p>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="font-bold text-cc-gray-900 text-2xl dark:text-white">{value}</p>
        )}
        {sublabel && !loading && (
          <p className="mt-1 text-cc-gray-400 text-xs">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link
      href={href}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-lg"
    >
      {body}
    </Link>
  ) : (
    body
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
  const kindLabel = {
    import: 'Importación',
    analysis: 'Análisis',
    design: 'Diseño',
  }[item.kind]

  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    item.status === 'imported' || item.status === 'completed'
      ? 'success'
      : item.status === 'completed_with_warnings'
        ? 'warning'
        : item.status === 'invalid' || item.status === 'failed'
          ? 'danger'
          : 'info'

  const projectHref = item.project_id ? `/projects/${item.project_id}` : null

  const inner = (
    <div className="flex items-center justify-between gap-2 px-1 py-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-cc-gray-900 dark:text-white">
            <span className="text-cc-gray-500">{kindLabel}: </span>
            <span className="font-medium">{item.label}</span>
          </p>
          <p className="truncate text-cc-gray-400 text-xs">
            {item.project_name ? `${item.project_name} · ` : ''}
            {when}
          </p>
        </div>
      </div>
      {item.status && <Badge variant={statusVariant}>{item.status}</Badge>}
    </div>
  )
  return (
    <li>
      {projectHref ? (
        <Link
          href={projectHref}
          className="block rounded-md hover:bg-cc-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 dark:hover:bg-cc-navy-800"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-lg"
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="pt-5">
          <div className="mb-3">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="mt-1">{desc}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  )
}

function EmptyMiniState({
  text,
  cta,
}: {
  text: string
  cta?: { href: string; label: string }
}) {
  return (
    <div className="py-6 text-center">
      <p className="text-cc-gray-500 text-sm">{text}</p>
      {cta && (
        <Link href={cta.href}>
          <Button variant="primary" size="sm" className="mt-3">
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  )
}
