'use client'

import { BuildingsPanel } from '@/components/project/BuildingsPanel'
import { ProjectAnalysisTab } from '@/components/project/ProjectAnalysisTab'
import { Breadcrumb } from '@/components/shell/Breadcrumb'
import { BuildingIcon, SparkleIcon } from '@/components/shell/nav-icons'
import { projectPalette } from '@/lib/project-colors'
import {
  ApiError,
  type OverviewStats,
  type Project,
  type RecentActivityItem,
  projects as projectsApi,
  stats as statsApi,
} from '@/lib/api'
import { BeamIcon, ColumnIcon, CubeIcon, DxfIcon, MomentIcon, WallIcon } from '@civilcode/icons'
import { Badge, Button, Skeleton } from '@civilcode/ui'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { use, useEffect, useState } from 'react'

type Tab = 'overview' | 'model' | 'analysis' | 'design' | 'documents'

interface TabDef {
  id: Tab
  label: string
  count?: (s: OverviewStats | null) => number | undefined
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'model', label: 'Modelo 3D', count: (s) => s?.n_buildings },
  { id: 'analysis', label: 'Análisis', count: (s) => s?.n_analyses_completed },
  { id: 'design', label: 'Diseño', count: (s) => s?.n_designs_completed },
  { id: 'documents', label: 'Documentos' },
]

function isTab(v: string | null): v is Tab {
  return v === 'overview' || v === 'model' || v === 'analysis' || v === 'design' || v === 'documents'
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const initialTab: Tab = (() => {
    const q = searchParams?.get('tab') ?? null
    return isTab(q) ? q : 'overview'
  })()
  const [project, setProject] = useState<Project | null>(null)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(initialTab)

  useEffect(() => {
    Promise.all([projectsApi.get(id), statsApi.overview(id)])
      .then(([p, s]) => {
        setProject(p)
        setOverview(s)
        // Solo forzar 'model' si el usuario NO explicitó un tab por query
        if (s.n_buildings === 0 && initialTab === 'overview') setTab('model')
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
    // initialTab es snapshot al mount, no queremos reaccionar a cambios posteriores del query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-3 h-5 w-48" />
        <Skeleton className="mb-6 h-40 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
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

  const palette = projectPalette(project.code || project.id, project.id)

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-6 sm:px-6 sm:pt-6 lg:px-8">
      <Breadcrumb
        items={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/projects', label: 'Proyectos' },
          { label: project.code },
        ]}
      />

      <ProjectHero
        project={project}
        overview={overview}
        palette={palette}
        onGoToModel={() => setTab('model')}
      />

      <div className="cc-tabs-sticky mt-6">
        <nav
          role="tablist"
          aria-label="Secciones del proyecto"
          className="flex gap-1 overflow-x-auto"
        >
          {TABS.map((t) => {
            const count = t.count?.(overview)
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                data-active={tab === t.id}
                onClick={() => setTab(t.id)}
                className="cc-tab-pill"
                type="button"
              >
                <span>{t.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="cc-tab-count">{count}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mt-5">
        {tab === 'overview' && (
          <OverviewTab project={project} overview={overview} onGoToModel={() => setTab('model')} />
        )}
        {tab === 'model' && <BuildingsPanel projectId={project.id} />}
        {tab === 'analysis' && <ProjectAnalysisTab projectId={project.id} />}
        {tab === 'design' && <DesignGallery />}
        {tab === 'documents' && (
          <PlaceholderTab
            title="Documentos"
            phase="Descarga DXF / PDF desde cada diseño completado"
          />
        )}
      </div>
    </div>
  )
}

function ProjectHero({
  project,
  overview,
  palette,
  onGoToModel,
}: {
  project: Project
  overview: OverviewStats | null
  palette: ReturnType<typeof projectPalette>
  onGoToModel: () => void
}) {
  const style: React.CSSProperties & Record<string, string> = {
    '--_cover-1': palette.c1,
    '--_cover-2': palette.c2,
    '--_accent': palette.accent,
  }
  const n = overview?.n_buildings ?? 0

  return (
    <div className="cc-detail-hero cc-fade-up mt-4" style={style}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold tracking-widest"
              style={{
                borderColor: 'rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              {project.code}
            </span>
            <span className="cc-hero-chip" style={{ color: 'rgba(255,255,255,0.75)' }}>
              <BuildingIcon size={13} />
              {n === 0 ? 'Sin edificios' : n === 1 ? '1 edificio' : `${n} edificios`}
            </span>
          </div>

          <h1 className="cc-detail-title mt-3">{project.name}</h1>

          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {project.client ?? 'Sin cliente'}
            {project.location && ` · ${project.location}`}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {overview?.n_buildings === 0 ? (
              <>
                <button type="button" onClick={onGoToModel} className="cc-cta-primary">
                  <SparkleIcon size={16} />
                  Subir primer modelo
                </button>
                <span className="cc-hero-chip" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  <span className="cc-hero-chip-icon">
                    <CubeIcon size={14} />
                  </span>
                  Soporta .e2k y .xlsx
                </span>
              </>
            ) : (
              <>
                <button type="button" onClick={onGoToModel} className="cc-cta-primary">
                  <CubeIcon size={16} />
                  Ver Modelo 3D
                </button>
                <Link href={`/projects/${project.id}?edit=1`} className="cc-cta-ghost">
                  Editar proyecto
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 lg:gap-3">
          <HeroStat label="Edificios" value={overview?.n_buildings ?? 0} />
          <HeroStat label="Revisiones" value={overview?.n_revisions_imported ?? 0} />
          <HeroStat label="Análisis" value={overview?.n_analyses_completed ?? 0} />
          <HeroStat label="Diseños" value={overview?.n_designs_completed ?? 0} />
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cc-detail-stat min-w-[96px]">
      <span className="cc-detail-stat-num">{value}</span>
      <span className="cc-detail-stat-label">{label}</span>
    </div>
  )
}

function OverviewTab({
  project,
  overview,
  onGoToModel,
}: {
  project: Project
  overview: OverviewStats | null
  onGoToModel: () => void
}) {
  const hasActivity = overview && overview.recent_activity.length > 0
  const hasBuildings = (overview?.n_buildings ?? 0) > 0

  return (
    <div className="space-y-5">
      {/* bento row 1: quick module shortcuts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="cc-panel lg:col-span-2">
          <div className="cc-panel-title">
            <h3>Próximos pasos</h3>
          </div>
          {!hasBuildings ? (
            <NextStepsEmpty onGoToModel={onGoToModel} />
          ) : (
            <NextStepsList overview={overview} onGoToModel={onGoToModel} />
          )}
        </div>

        <div className="cc-panel">
          <div className="cc-panel-title">
            <h3>Información</h3>
            <span className="cc-label-mono text-[10px]">Datos</span>
          </div>
          <dl className="space-y-2.5">
            <Row label="Código" value={project.code} mono />
            <Row label="Cliente" value={project.client ?? '—'} />
            <Row label="Ubicación" value={project.location ?? '—'} />
          </dl>
        </div>
      </div>

      {/* bento row 2: description + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="cc-panel lg:col-span-2">
          <div className="cc-panel-title">
            <h3>Descripción</h3>
          </div>
          <p className="whitespace-pre-wrap text-cc-gray-700 text-sm leading-6 dark:text-cc-gray-300">
            {project.description ??
              'Sin descripción. Agrega una desde la edición del proyecto para que el equipo y tus clientes entiendan el contexto.'}
          </p>
        </div>

        <div className="cc-panel">
          <div className="cc-panel-title">
            <h3>Actividad reciente</h3>
            <span className="cc-label-mono text-[10px]">
              {overview?.recent_activity.length ?? 0}
            </span>
          </div>
          {!hasActivity ? (
            <p className="py-4 text-cc-gray-500 text-sm">
              Sin actividad aún. Sube un modelo ETABS para comenzar.
            </p>
          ) : (
            <ul className="divide-y divide-cc-gray-100 dark:divide-cc-navy-800">
              {overview.recent_activity.slice(0, 5).map((a, i) => (
                <ActivityRow key={`${a.kind}-${a.created_at}-${i}`} item={a} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function NextStepsEmpty({ onGoToModel }: { onGoToModel: () => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NextStep
        step="1"
        title="Sube un modelo"
        detail=".e2k o .xlsx"
        accent="#22d3ee"
        onClick={onGoToModel}
        cta="Subir ahora"
        active
      />
      <NextStep step="2" title="Importar y revisar" detail="Validación auto." accent="#3b82f6" />
      <NextStep step="3" title="Analizar y diseñar" detail="NSR-10" accent="#8b5cf6" />
    </div>
  )
}

function NextStepsList({
  overview,
  onGoToModel,
}: {
  overview: OverviewStats | null
  onGoToModel: () => void
}) {
  const nR = overview?.n_revisions_imported ?? 0
  const nA = overview?.n_analyses_completed ?? 0
  const nD = overview?.n_designs_completed ?? 0
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NextStep
        step="→"
        title="Revisar modelo 3D"
        detail={`${nR} revisión${nR === 1 ? '' : 'es'} lista${nR === 1 ? '' : 's'}`}
        accent="#22d3ee"
        active
        onClick={onGoToModel}
        cta="Abrir"
      />
      <NextStep
        step="→"
        title="Correr análisis"
        detail={nA > 0 ? `${nA} completado${nA === 1 ? '' : 's'}` : 'Pendiente'}
        accent="#3b82f6"
        active={nR > 0}
      />
      <NextStep
        step="→"
        title="Diseñar elementos"
        detail={nD > 0 ? `${nD} completado${nD === 1 ? '' : 's'}` : 'Vigas, columnas, muros'}
        accent="#8b5cf6"
        active={nR > 0}
      />
    </div>
  )
}

function NextStep({
  step,
  title,
  detail,
  accent,
  active,
  onClick,
  cta,
}: {
  step: string
  title: string
  detail: string
  accent: string
  active?: boolean
  onClick?: () => void
  cta?: string
}) {
  const style: React.CSSProperties & Record<string, string> = {
    '--_card-accent': accent,
    opacity: active ? 1 : 0.6,
  }
  return (
    <button
      type="button"
      className="cc-tool-card text-left"
      data-active={active ? 'true' : 'false'}
      style={style}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="flex items-center justify-between">
        <span
          className="cc-tool-card-icon"
          style={{ ['--_card-accent' as string]: accent, fontSize: 15, fontWeight: 700 }}
        >
          {step}
        </span>
        {cta && active && (
          <span className="font-medium text-cc-cyan-600 text-xs dark:text-cc-cyan-400">
            {cta} →
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">{title}</p>
        <p className="mt-1 text-cc-gray-500 text-xs">{detail}</p>
      </div>
    </button>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="cc-label-mono text-[10px]">{label}</dt>
      <dd
        className={`max-w-[60%] truncate text-right text-cc-gray-900 text-sm dark:text-white ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
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
  const Icon =
    item.kind === 'import' ? CubeIcon : item.kind === 'analysis' ? MomentIcon : BeamIcon
  const color =
    item.kind === 'import' ? '#22d3ee' : item.kind === 'analysis' ? '#3b82f6' : '#8b5cf6'
  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    item.status === 'imported' || item.status === 'completed'
      ? 'success'
      : item.status === 'completed_with_warnings'
        ? 'warning'
        : item.status === 'invalid' || item.status === 'failed'
          ? 'danger'
          : 'info'
  return (
    <li className="flex items-center justify-between gap-2 py-2.5 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            color,
          }}
        >
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-cc-gray-900 text-[13px] dark:text-white">{item.label}</p>
          <p className="truncate text-cc-gray-400 text-xs">{when}</p>
        </div>
      </div>
      {item.status && <Badge variant={statusVariant}>{item.status}</Badge>}
    </li>
  )
}

function PlaceholderTab({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="cc-empty">
      <span className="cc-empty-icon">
        <SparkleIcon size={24} />
      </span>
      <h3 className="font-bold text-cc-gray-900 text-xl tracking-tight dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-cc-gray-500 text-sm">{phase}</p>
    </div>
  )
}

function DesignGallery() {
  const MODULES = [
    {
      label: 'Vigas',
      Icon: BeamIcon,
      accent: '#22d3ee',
      active: true,
      phase: 'Fase 3a-b · listo',
      description: 'Flexión, cortante, estribos y despiece DXF/PDF.',
    },
    {
      label: 'Columnas',
      Icon: ColumnIcon,
      accent: '#3b82f6',
      active: true,
      phase: 'Fase 3c · listo',
      description: 'P-M Bresler, confinamiento DMO/DES, cuantías NSR-10.',
    },
    {
      label: 'Muros',
      Icon: WallIcon,
      accent: '#6366f1',
      active: true,
      phase: 'Fase 3d · listo',
      description: 'Pier/spandrel, malla H/V, elementos de borde.',
    },
    {
      label: 'Zapatas',
      Icon: DxfIcon,
      accent: '#8b5cf6',
      active: true,
      phase: 'Fase 3e · listo',
      description: 'Dimensionado por q_adm, punzonamiento, flexión.',
    },
    {
      label: 'Nervios',
      Icon: BeamIcon,
      accent: '#10b981',
      active: false,
      phase: 'Pronto',
      description: 'Comparte pipeline de vigas por ahora.',
    },
  ]
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-cc-gray-900 text-base dark:text-white">
          Módulos de diseño NSR-10
        </h2>
        <p className="text-cc-gray-500 text-xs">
          Abre cada módulo desde una revisión importada en «Modelo 3D»
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ label, Icon, accent, active, phase, description }, i) => (
          <div
            key={label}
            className="cc-tool-card cc-fade-up"
            data-active={active ? 'true' : 'false'}
            style={{
              ['--_card-accent' as string]: accent,
              animationDelay: `${i * 50}ms`,
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
              <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">{label}</p>
              <p className="mt-1 text-cc-gray-500 text-xs">{description}</p>
              <p className="mt-2 cc-label-mono text-[10px]">{phase}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
