'use client'

import {
  type OverviewStats,
  type Project,
  type RecentActivityItem,
  type UserPublic,
  auth,
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
import { Badge, Card, CardContent, Skeleton } from '@civilcode/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'Ingeniero'

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════════
          HERO: dark navy + cyan glow + gradient title
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="cc-hero-dark border-cc-navy-900 border-b">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="cc-fade-up" style={{ animationDelay: '60ms' }}>
            <span className="cc-hero-pill">
              <span className="cc-hero-pill-dot" />
              CivilCode Studio · Fase 3
            </span>
          </div>
          <h1
            className="cc-hero-headline mt-5 text-4xl sm:text-5xl lg:text-[52px] cc-fade-up"
            style={{ animationDelay: '120ms' }}
          >
            Diseña, analiza y despieza{' '}
            <span className="cc-hero-gradient-text">estructuras completas</span>
            <br />
            sin salir de la plataforma.
          </h1>
          <p
            className="mt-5 max-w-2xl text-base text-[color:var(--hero-text-muted)] sm:text-lg cc-fade-up"
            style={{ animationDelay: '180ms' }}
          >
            {loading ? (
              'Cargando tu espacio…'
            ) : (
              <>
                Hola <span className="text-white">{firstName}</span>. Importa tu modelo ETABS,
                corre análisis preliminar, y diseña vigas, columnas, muros y zapatas con NSR-10 en
                minutos.
              </>
            )}
          </p>

          <div
            className="mt-7 flex flex-wrap items-center gap-3 cc-fade-up"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/projects" className="cc-cta-primary">
              Ir a proyectos
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M5 12h14M13 6l6 6-6 6"
                />
              </svg>
            </Link>
            <Link href="/design/beams" className="cc-cta-ghost">
              Diseñar vigas
            </Link>
            <div className="ml-2 flex items-center gap-4">
              <span className="cc-hero-chip">
                <span className="cc-hero-chip-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      d="M12 6v6l4 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                    />
                  </svg>
                </span>
                Access 24h · auto-refresh
              </span>
              <span className="cc-hero-chip">
                <span className="cc-hero-chip-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.83zM7 7h.01"
                    />
                  </svg>
                </span>
                NSR-10 · Colombia
              </span>
            </div>
          </div>

          {/* Shortcut cards (3 tarjetas premium) */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                {
                  href: '/projects',
                  label: 'Proyectos',
                  desc: 'Crea y organiza tus modelos estructurales.',
                  grad: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
                  Icon: SheetIcon,
                  delay: 320,
                },
                {
                  href: '/design/beams',
                  label: 'Diseño de vigas',
                  desc: 'Flexión + cortante NSR-10 con DXF y PDF.',
                  grad: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  Icon: BeamIcon,
                  delay: 400,
                },
                {
                  href: '/settings/organization',
                  label: 'Organización',
                  desc: 'Invita a tu equipo y gestiona permisos.',
                  grad: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  Icon: DxfIcon,
                  delay: 480,
                },
              ] as const
            ).map(({ href, label, desc, grad, Icon, delay }) => (
              <Link
                key={href}
                href={href}
                className="cc-shortcut-card cc-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b18]"
                style={{
                  ['--_accent-grad' as string]: grad,
                  animationDelay: `${delay}ms`,
                }}
              >
                <span className="cc-shortcut-icon" style={{ ['--_accent-grad' as string]: grad }}>
                  <Icon size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-[12.5px] text-[color:var(--hero-text-muted)]">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Stat chips */}
          <div
            className="mt-8 flex flex-wrap gap-3 cc-fade-up"
            style={{ animationDelay: '560ms' }}
          >
            <StatChip
              label="Proyectos"
              value={overview?.n_projects ?? 0}
              loading={loading}
              accent="#22d3ee"
            />
            <StatChip
              label="Edificios"
              value={overview?.n_buildings ?? 0}
              loading={loading}
              accent="#06b6d4"
            />
            <StatChip
              label="Revisiones imported"
              value={overview?.n_revisions_imported ?? 0}
              loading={loading}
              accent="#3b82f6"
              sub={overview ? `/ ${overview.n_revisions_total}` : undefined}
            />
            <StatChip
              label="Análisis"
              value={overview?.n_analyses_completed ?? 0}
              loading={loading}
              accent="#6366f1"
              sub={overview ? `/ ${overview.n_analyses_total}` : undefined}
            />
            <StatChip
              label="Diseños"
              value={overview?.n_designs_completed ?? 0}
              loading={loading}
              accent="#8b5cf6"
              sub={overview ? `/ ${overview.n_designs_total}` : undefined}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENIDO: Actividad reciente + Proyectos recientes + Módulos
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Actividad reciente */}
          <div className="lg:col-span-3 cc-fade-up" style={{ animationDelay: '60ms' }}>
            <SectionTitle>Actividad reciente</SectionTitle>
            <Card>
              <CardContent className="pt-5">
                {loading ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !overview || overview.recent_activity.length === 0 ? (
                  <EmptyMini text="Sin actividad reciente. Crea un proyecto para empezar." />
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
          </div>

          {/* Proyectos recientes */}
          <div className="lg:col-span-2 cc-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">Proyectos recientes</SectionTitle>
              {!loading && projects.length > 0 && (
                <Link href="/projects" className="text-cc-cyan-600 text-xs hover:underline">
                  Ver todos →
                </Link>
              )}
            </div>
            <Card>
              <CardContent className="pt-5">
                {loading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <EmptyMini
                    text="Aún no tienes proyectos."
                    cta={{ href: '/projects', label: 'Crear proyecto' }}
                  />
                ) : (
                  <ul className="space-y-1">
                    {projects.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/projects/${p.id}`}
                          className="group flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-cc-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1 dark:hover:bg-cc-navy-800"
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
        </div>

        {/* Módulos de diseño (tool cards) */}
        <div className="mt-10 cc-fade-up" style={{ animationDelay: '180ms' }}>
          <SectionTitle>Módulos de diseño</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <ToolCard key={m.href} module={m} delay={60 * i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`mb-3 font-semibold text-base tracking-tight text-cc-gray-900 dark:text-white ${className ?? ''}`}
    >
      {children}
    </h2>
  )
}

function StatChip({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string
  value: number
  sub?: string
  accent: string
  loading: boolean
}) {
  return (
    <div className="cc-stat-chip" style={{ ['--_stat-accent' as string]: accent }}>
      {loading ? (
        <span className="cc-stat-chip-num">—</span>
      ) : (
        <span className="cc-stat-chip-num">
          {value}
          {sub && <span className="ml-1 text-xs opacity-60">{sub}</span>}
        </span>
      )}
      <span className="text-[11.5px] uppercase tracking-wider text-[color:var(--hero-text-muted)]">
        {label}
      </span>
    </div>
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
          className="block rounded-md hover:bg-cc-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1 dark:hover:bg-cc-navy-800"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}

function EmptyMini({
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
        <Link href={cta.href} className="cc-cta-primary mt-3 inline-flex">
          {cta.label}
        </Link>
      )}
    </div>
  )
}

interface ModuleDef {
  href: string
  label: string
  desc: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  active: boolean
  accent: string
  badgeLabel: string
}

const MODULES: ModuleDef[] = [
  {
    href: '/design/beams',
    label: 'Vigas',
    desc: 'Flexión wu·L²/10 + cortante + estribos NSR-10. Export DXF y PDF.',
    Icon: BeamIcon,
    active: true,
    accent: '#22d3ee',
    badgeLabel: 'Listo',
  },
  {
    href: '/design/columns',
    label: 'Columnas',
    desc: 'Flexo-compresión biaxial Bresler, confinamiento DMO/DES.',
    Icon: ColumnIcon,
    active: true,
    accent: '#3b82f6',
    badgeLabel: 'Listo',
  },
  {
    href: '/design/walls',
    label: 'Muros',
    desc: 'Cortante en plano, cuantías ρh/ρv, elementos de borde.',
    Icon: WallIcon,
    active: true,
    accent: '#6366f1',
    badgeLabel: 'Listo',
  },
  {
    href: '/design/footings',
    label: 'Zapatas',
    desc: 'Dimensionamiento iterativo + punzonamiento + flexión.',
    Icon: WallIcon,
    active: true,
    accent: '#8b5cf6',
    badgeLabel: 'Listo',
  },
  {
    href: '/design/joists',
    label: 'Nervios',
    desc: 'Vigas T (comparte pipeline de vigas).',
    Icon: BeamIcon,
    active: false,
    accent: '#10b981',
    badgeLabel: 'Pronto',
  },
  {
    href: '/analysis',
    label: 'Análisis OpenSees',
    desc: 'Linear-estático real (hoy solo quick_check).',
    Icon: MomentIcon,
    active: false,
    accent: '#f59e0b',
    badgeLabel: 'Fase 2b',
  },
]

function ToolCard({ module, delay }: { module: ModuleDef; delay: number }) {
  return (
    <Link
      href={module.active ? module.href : '#'}
      className="cc-tool-card cc-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-2"
      data-active={module.active}
      style={{
        ['--_card-accent' as string]: module.accent,
        animationDelay: `${delay}ms`,
      }}
      aria-disabled={!module.active}
      onClick={(e) => {
        if (!module.active) e.preventDefault()
      }}
    >
      <div className="flex items-start justify-between">
        <span className="cc-tool-card-icon" style={{ ['--_card-accent' as string]: module.accent }}>
          <module.Icon size={20} />
        </span>
        <Badge variant={module.active ? 'success' : 'neutral'}>{module.badgeLabel}</Badge>
      </div>
      <div>
        <p className="font-semibold text-sm text-cc-gray-900 dark:text-white">{module.label}</p>
        <p className="mt-1 line-clamp-2 text-xs text-cc-gray-500 dark:text-cc-gray-400">
          {module.desc}
        </p>
      </div>
    </Link>
  )
}
