'use client'

import {
  ApiError,
  type OrganizationWithRole,
  type OverviewStats,
  type Project,
  organizations as orgsApi,
  projects as projectsApi,
  stats as statsApi,
} from '@/lib/api'
import {
  BuildingIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/shell/nav-icons'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  Skeleton,
  cn,
} from '@civilcode/ui'
import {
  PROJECT_PALETTES,
  hashPaletteIndex,
  paletteByIndex,
  projectPalette as hashColor,
  setPaletteOverride,
} from '@/lib/project-colors'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; project: Project }
  | { kind: 'delete'; project: Project }

type SortKey = 'name-asc' | 'name-desc' | 'code-asc' | 'activity-desc'
type ViewMode = 'grid' | 'list'

export default function ProjectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, OverviewStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name-asc')
  const [view, setView] = useState<ViewMode>('grid')
  const [orgFilter, setOrgFilter] = useState<string>('all')

  async function reload() {
    try {
      const [orgList, projectList] = await Promise.all([orgsApi.list(), projectsApi.list()])
      setOrgs(orgList)
      setProjects(projectList)
      setLoading(false)
      const results = await Promise.all(
        projectList.map((p) => statsApi.overview(p.id).catch(() => null)),
      )
      const map: Record<string, OverviewStats> = {}
      projectList.forEach((p, i) => {
        const s = results[i]
        if (s) map[p.id] = s
      })
      setStatsMap(map)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setModal({ kind: 'create' })
      router.replace('/projects')
    }
  }, [searchParams, router])

  const close = () => setModal({ kind: 'closed' })
  const afterChange = async () => {
    close()
    await reload()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let items = [...projects]
    if (orgFilter !== 'all') items = items.filter((p) => p.organization_id === orgFilter)
    if (q) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.client ?? '').toLowerCase().includes(q) ||
          (p.location ?? '').toLowerCase().includes(q),
      )
    }
    items.sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'code-asc':
          return a.code.localeCompare(b.code)
        case 'activity-desc': {
          const sa = statsMap[a.id]?.recent_activity[0]?.created_at ?? ''
          const sb = statsMap[b.id]?.recent_activity[0]?.created_at ?? ''
          return sb.localeCompare(sa)
        }
      }
    })
    return items
  }, [projects, query, sort, orgFilter, statsMap])

  return (
    <div>
      <section className="border-cc-gray-200 border-b bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <nav aria-label="Breadcrumb" className="cc-breadcrumb mb-3">
            <Link href="/dashboard" className="hover:text-cc-gray-900 dark:hover:text-white">
              Dashboard
            </Link>
            <span className="cc-breadcrumb-sep">/</span>
            <span className="text-cc-gray-900 dark:text-white">Proyectos</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl tracking-tight dark:text-white">
                Proyectos
              </h1>
              <p className="mt-1 text-cc-gray-500 text-sm">
                Crea, lista y abre los proyectos estructurales de tu organización.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModal({ kind: 'create' })}
              className="cc-cta-primary"
            >
              <PlusIcon size={16} />
              Nuevo proyecto
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
            {error}
          </div>
        )}

        {!loading && projects.length > 0 && (
          <Toolbar
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            view={view}
            onView={setView}
            orgs={orgs}
            orgFilter={orgFilter}
            onOrgFilter={setOrgFilter}
            total={projects.length}
            filteredCount={filtered.length}
            onCreate={() => setModal({ kind: 'create' })}
          />
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onCreate={() => setModal({ kind: 'create' })} />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-cc-gray-200 bg-white p-10 text-center dark:border-cc-navy-700 dark:bg-cc-navy-900">
            <p className="text-cc-gray-500 text-sm">
              Sin resultados para esa búsqueda. Prueba otro término o limpia los filtros.
            </p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                orgName={orgs.find((o) => o.id === p.organization_id)?.name}
                stat={statsMap[p.id]}
                index={i}
                onEdit={() => setModal({ kind: 'edit', project: p })}
                onDelete={() => setModal({ kind: 'delete', project: p })}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
            {filtered.map((p, i) => (
              <ProjectRow
                key={p.id}
                project={p}
                orgName={orgs.find((o) => o.id === p.organization_id)?.name}
                stat={statsMap[p.id]}
                isLast={i === filtered.length - 1}
                onEdit={() => setModal({ kind: 'edit', project: p })}
                onDelete={() => setModal({ kind: 'delete', project: p })}
              />
            ))}
          </div>
        )}

        <Dialog
          open={modal.kind === 'create' || modal.kind === 'edit'}
          onOpenChange={(open) => !open && close()}
        >
          {modal.kind === 'create' && (
            <ProjectForm
              mode="create"
              organizations={orgs}
              onClose={close}
              onSubmitDone={afterChange}
            />
          )}
          {modal.kind === 'edit' && (
            <ProjectForm
              mode="edit"
              organizations={orgs}
              project={modal.project}
              onClose={close}
              onSubmitDone={afterChange}
            />
          )}
        </Dialog>

        <Dialog open={modal.kind === 'delete'} onOpenChange={(open) => !open && close()}>
          {modal.kind === 'delete' && (
            <DeleteConfirm project={modal.project} onClose={close} onDeleted={afterChange} />
          )}
        </Dialog>
      </div>
    </div>
  )
}

function Toolbar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  orgs,
  orgFilter,
  onOrgFilter,
  total,
  filteredCount,
  onCreate,
}: {
  query: string
  onQuery: (q: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  view: ViewMode
  onView: (v: ViewMode) => void
  orgs: OrganizationWithRole[]
  orgFilter: string
  onOrgFilter: (v: string) => void
  total: number
  filteredCount: number
  onCreate: () => void
}) {
  return (
    <div className="cc-toolbar">
      <label className="cc-toolbar-search">
        <SearchIcon size={15} />
        <input
          type="text"
          placeholder="Buscar por nombre, código, cliente…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Buscar proyectos"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Limpiar búsqueda"
            className="text-cc-gray-400 hover:text-cc-gray-700"
          >
            ×
          </button>
        )}
      </label>

      {orgs.length > 1 && (
        <select
          className="cc-toolbar-select"
          value={orgFilter}
          onChange={(e) => onOrgFilter(e.target.value)}
          aria-label="Filtrar por organización"
        >
          <option value="all">Todas las orgs</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}

      <select
        className="cc-toolbar-select"
        value={sort}
        onChange={(e) => onSort(e.target.value as SortKey)}
        aria-label="Ordenar"
      >
        <option value="name-asc">Nombre A-Z</option>
        <option value="name-desc">Nombre Z-A</option>
        <option value="code-asc">Código</option>
        <option value="activity-desc">Última actividad</option>
      </select>

      <div className="cc-toolbar-group" role="group" aria-label="Vista">
        <button
          type="button"
          className="cc-toolbar-group-btn"
          data-active={view === 'grid'}
          onClick={() => onView('grid')}
          aria-pressed={view === 'grid'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          type="button"
          className="cc-toolbar-group-btn"
          data-active={view === 'list'}
          onClick={() => onView('list')}
          aria-pressed={view === 'list'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>
      </div>

      <span className="cc-toolbar-count">
        {filteredCount === total ? `${total} proyectos` : `${filteredCount} de ${total}`}
      </span>

      <button
        type="button"
        onClick={onCreate}
        className="cc-cta-primary !px-4 !py-2 !text-[13px]"
      >
        <PlusIcon size={14} />
        Nuevo proyecto
      </button>
    </div>
  )
}

function ProjectCard({
  project,
  orgName,
  stat,
  index,
  onEdit,
  onDelete,
}: {
  project: Project
  orgName?: string
  stat?: OverviewStats
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const palette = hashColor(project.code || project.id, project.id)
  const style: React.CSSProperties & Record<string, string> = {
    '--_cover-1': palette.c1,
    '--_cover-2': palette.c2,
    '--_accent': palette.accent,
    animationDelay: `${index * 40}ms`,
  }

  return (
    <div className="cc-project-card cc-fade-up" style={style}>
      <Link href={`/projects/${project.id}`} className="block focus-visible:outline-none">
        <div className="cc-project-card-cover">
          <div className="flex items-start justify-between">
            <span className="cc-project-badge">{orgName ?? 'Proyecto'}</span>
            <BuildingIcon size={18} style={{ opacity: 0.7 }} />
          </div>
          <div className="mt-6 cc-project-code">{project.code}</div>
        </div>
      </Link>

      <div className="cc-project-card-body">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="min-w-0 flex-1 focus-visible:outline-none"
          >
            <h3 className="truncate font-semibold text-cc-gray-900 text-[15px] tracking-tight dark:text-white">
              {project.name}
            </h3>
            <p className="mt-0.5 truncate text-cc-gray-500 text-xs">
              {project.client || 'Sin cliente'} · {project.location || 'Sin ubicación'}
            </p>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-cc-gray-400 hover:bg-cc-gray-100 hover:text-cc-gray-700 dark:hover:bg-cc-navy-800"
                aria-label="Acciones"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-cc-danger-600 hover:bg-cc-danger-100 dark:hover:bg-cc-danger-600/10"
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="cc-project-chips">
          <StatChip label="Edificios" value={stat?.n_buildings} dot="#22d3ee" />
          <StatChip label="Revisiones" value={stat?.n_revisions_imported} dot="#3b82f6" />
          <StatChip label="Análisis" value={stat?.n_analyses_completed} dot="#10b981" />
          <StatChip label="Diseños" value={stat?.n_designs_completed} dot="#8b5cf6" />
        </div>
      </div>
    </div>
  )
}

function StatChip({ label, value, dot }: { label: string; value?: number; dot: string }) {
  return (
    <div className="cc-project-chip">
      <span className="cc-project-chip-dot" style={{ ['--_dot' as string]: dot }} />
      <span className="cc-project-chip-num">{value ?? '—'}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}

function ProjectRow({
  project,
  orgName,
  stat,
  isLast,
  onEdit,
  onDelete,
}: {
  project: Project
  orgName?: string
  stat?: OverviewStats
  isLast: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const palette = hashColor(project.code || project.id, project.id)
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-cc-gray-50 dark:hover:bg-cc-navy-800/40',
        !isLast && 'border-b border-cc-gray-100 dark:border-cc-navy-700',
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 focus-visible:outline-none"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${palette.c1} 0%, ${palette.c2} 100%)`,
          }}
        >
          {project.code.slice(0, 3)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-cc-gray-900 text-sm dark:text-white">
              {project.name}
            </h3>
            <Badge variant="info" className="text-[10px]">
              {project.code}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-cc-gray-500 text-xs">
            {project.client || 'Sin cliente'} · {project.location || 'Sin ubicación'} · {orgName}
          </p>
        </div>
      </Link>

      <div className="hidden items-center gap-4 text-xs sm:flex">
        <RowStat label="Edif" value={stat?.n_buildings} />
        <RowStat label="Rev" value={stat?.n_revisions_imported} />
        <RowStat label="Dis" value={stat?.n_designs_completed} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            className="rounded p-1 text-cc-gray-400 hover:bg-cc-gray-100 hover:text-cc-gray-700 dark:hover:bg-cc-navy-800"
            aria-label="Acciones"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-cc-danger-600 hover:bg-cc-danger-100 dark:hover:bg-cc-danger-600/10"
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function RowStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono font-bold text-cc-gray-900 dark:text-white">{value ?? '—'}</span>
      <span className="text-cc-gray-400">{label}</span>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="cc-empty block w-full cursor-pointer transition-all hover:border-cc-cyan-500/60 hover:bg-cc-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500"
    >
      <span className="cc-empty-icon">
        <PlusIcon size={26} />
      </span>
      <h3 className="font-bold text-cc-gray-900 text-xl tracking-tight dark:text-white">
        Crea tu primer proyecto
      </h3>
      <p className="mx-auto mt-2 max-w-md text-cc-gray-500 text-sm">
        Un proyecto agrupa edificios, revisiones ETABS, análisis y diseños. Toma menos de un minuto.
      </p>
      <span className="mt-6 inline-flex items-center gap-2 font-medium text-cc-cyan-600 text-sm dark:text-cc-cyan-400">
        <SparkleIcon size={14} />
        Comenzar ahora
      </span>
    </button>
  )
}

function ProjectForm({
  mode,
  organizations,
  project,
  onClose,
  onSubmitDone,
}: {
  mode: 'create' | 'edit'
  organizations: OrganizationWithRole[]
  project?: Project
  onClose: () => void
  onSubmitDone: () => void | Promise<void>
}) {
  if (mode === 'edit' && project) {
    return (
      <ProjectEditForm
        organizations={organizations}
        project={project}
        onClose={onClose}
        onSubmitDone={onSubmitDone}
      />
    )
  }
  return (
    <ProjectCreateWizard
      organizations={organizations}
      onClose={onClose}
      onSubmitDone={onSubmitDone}
    />
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Wizard de creación de proyecto — 3 pasos con preview en vivo
// ──────────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

const STEPS: { n: WizardStep; label: string; title: string; subtitle: string }[] = [
  {
    n: 1,
    label: 'Identifica',
    title: 'Identifica el proyecto',
    subtitle: 'Un código y un nombre memorables para encontrarlo rápido.',
  },
  {
    n: 2,
    label: 'Contexto',
    title: 'Agrega contexto',
    subtitle: 'Cliente, ubicación y una descripción corta ayudan a tu equipo.',
  },
  {
    n: 3,
    label: 'Toque final',
    title: 'Elige su identidad visual',
    subtitle: 'Un color de portada único y confirmas para crear.',
  },
]

function ProjectCreateWizard({
  organizations,
  onClose,
  onSubmitDone,
}: {
  organizations: OrganizationWithRole[]
  onClose: () => void
  onSubmitDone: () => void | Promise<void>
}) {
  const [step, setStep] = useState<WizardStep>(1)
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [paletteIdx, setPaletteIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const autoIdx = useMemo(() => hashPaletteIndex(code || 'CC'), [code])
  const activeIdx = paletteIdx ?? autoIdx
  const palette = paletteByIndex(activeIdx)
  const org = organizations.find((o) => o.id === orgId)

  const canContinue =
    step === 1
      ? code.trim().length > 0 && name.trim().length > 0 && orgId.length > 0
      : true

  function goNext() {
    setError(null)
    if (step < 3) setStep((s) => ((s + 1) as WizardStep))
  }
  function goBack() {
    setError(null)
    if (step > 1) setStep((s) => ((s - 1) as WizardStep))
  }
  async function create() {
    setLoading(true)
    setError(null)
    try {
      const created = await projectsApi.create({
        organization_id: orgId,
        code,
        name,
        client: client || null,
        location: location || null,
        description: description || null,
      })
      if (paletteIdx !== null && paletteIdx !== autoIdx) {
        setPaletteOverride(created.id, paletteIdx)
      }
      await onSubmitDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step < 3) {
      if (canContinue) goNext()
    } else {
      void create()
    }
  }

  const stepDef = STEPS.find((s) => s.n === step)!

  return (
    <form onSubmit={handleSubmit} className="w-[94vw] max-w-[42rem]">
      <DialogContent className="!p-0">
        <div className="px-6 pt-6 pb-4">
          <div className="mb-4">
            <p className="cc-label-mono text-[10px]">Nuevo proyecto</p>
            <h2 className="mt-1 font-bold text-cc-gray-900 text-xl tracking-tight dark:text-white">
              {stepDef.title}
            </h2>
            <p className="mt-1 text-cc-gray-500 text-sm">{stepDef.subtitle}</p>
          </div>

          <WizardProgress step={step} onJump={(s) => s < step && setStep(s)} />
        </div>

        <div
          className="px-6 pb-5"
          style={{
            ['--_cover-1' as string]: palette.c1,
            ['--_cover-2' as string]: palette.c2,
          }}
        >
          <PreviewCard
            code={code}
            name={name}
            client={client}
            location={location}
            orgName={org?.name}
            accent={palette.accent}
          />
        </div>

        <div className="px-6 pb-4">
          {step === 1 && (
            <Step1Essentials
              orgId={orgId}
              setOrgId={setOrgId}
              organizations={organizations}
              code={code}
              setCode={setCode}
              name={name}
              setName={setName}
            />
          )}
          {step === 2 && (
            <Step2Context
              client={client}
              setClient={setClient}
              location={location}
              setLocation={setLocation}
              description={description}
              setDescription={setDescription}
            />
          )}
          {step === 3 && (
            <Step3Identity
              code={code}
              name={name}
              client={client}
              location={location}
              orgName={org?.name}
              activeIdx={activeIdx}
              autoIdx={autoIdx}
              onPickPalette={setPaletteIdx}
            />
          )}

          {error && (
            <p className="mt-4 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-cc-gray-200 border-t bg-cc-gray-50 px-6 py-4 dark:border-cc-navy-700 dark:bg-cc-navy-800/40">
          <div className="flex items-center gap-2 text-cc-gray-500 text-xs">
            <span className="cc-kbd">esc</span>
            <span>cerrar</span>
            {canContinue && step < 3 && (
              <>
                <span className="mx-2 text-cc-gray-300">·</span>
                <span className="cc-kbd">⏎</span>
                <span>continuar</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={goBack} disabled={loading}>
                <ChevronLeftIcon size={14} /> Atrás
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
            )}
            {step < 3 ? (
              <button type="submit" disabled={!canContinue} className="cc-cta-blue">
                Continuar <ChevronRightIcon size={14} />
              </button>
            ) : (
              <Button type="submit" loading={loading}>
                <SparkleIcon size={14} /> Crear proyecto
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </form>
  )
}

function WizardProgress({
  step,
  onJump,
}: {
  step: WizardStep
  onJump: (s: WizardStep) => void
}) {
  return (
    <div className="cc-wizard-progress">
      {STEPS.map((s, i) => {
        const state: 'done' | 'active' | 'todo' =
          s.n < step ? 'done' : s.n === step ? 'active' : 'todo'
        return (
          <div key={s.n} className="cc-wizard-progress-step">
            <button
              type="button"
              onClick={() => onJump(s.n)}
              disabled={state === 'todo'}
              className="flex min-w-0 items-center gap-2 disabled:cursor-not-allowed"
            >
              <span className="cc-wizard-step-num" data-state={state}>
                {state === 'done' ? <CheckIcon size={13} /> : s.n}
              </span>
              <span className="cc-wizard-step-label hidden sm:inline" data-state={state}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="cc-wizard-step-bar" data-filled={s.n < step} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PreviewCard({
  code,
  name,
  client,
  location,
  orgName,
  accent,
}: {
  code: string
  name: string
  client: string
  location: string
  orgName?: string
  accent: string
}) {
  return (
    <div className="cc-wizard-preview">
      <div className="flex items-start justify-between gap-3">
        <span
          className="rounded-md border px-2 py-1 font-mono text-[10px] font-bold tracking-widest uppercase"
          style={{
            borderColor: 'rgba(255,255,255,0.22)',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {orgName ?? 'Organización'}
        </span>
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `color-mix(in srgb, ${accent} 20%, transparent)`,
            color: accent,
          }}
        >
          <BuildingIcon size={14} />
        </div>
      </div>
      <div className="cc-wizard-preview-code mt-4">{code || '—'}</div>
      <div className="cc-wizard-preview-name truncate">
        {name || 'Nombre del proyecto'}
      </div>
      <div className="cc-wizard-preview-meta truncate">
        {client || 'Sin cliente'} · {location || 'Sin ubicación'}
      </div>
    </div>
  )
}

function Step1Essentials({
  orgId,
  setOrgId,
  organizations,
  code,
  setCode,
  name,
  setName,
}: {
  orgId: string
  setOrgId: (v: string) => void
  organizations: OrganizationWithRole[]
  code: string
  setCode: (v: string) => void
  name: string
  setName: (v: string) => void
}) {
  return (
    <div className="space-y-4 cc-fade-up">
      {organizations.length > 1 && (
        <div>
          <label htmlFor="org" className="cc-field-label">
            Organización
          </label>
          <Select
            id="org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div>
          <label htmlFor="code" className="cc-field-label">
            Código
          </label>
          <Input
            id="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VT-01"
            maxLength={12}
            autoFocus
            className="font-mono text-base tracking-wider"
          />
          <p className="cc-field-hint">Corto. Mono. Único.</p>
        </div>
        <div>
          <label htmlFor="name" className="cc-field-label">
            Nombre del proyecto
          </label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Torre Vita"
          />
          <p className="cc-field-hint">Cómo lo conoces y lo buscarás.</p>
        </div>
      </div>

      <div className="cc-wizard-tip">
        <span className="cc-wizard-tip-icon">
          <SparkleIcon size={13} />
        </span>
        <span>
          El código aparece en portadas de memorias y en el buscador <span className="cc-kbd">⌘K</span>.
          Mantenlo corto (3–6 caracteres).
        </span>
      </div>
    </div>
  )
}

function Step2Context({
  client,
  setClient,
  location,
  setLocation,
  description,
  setDescription,
}: {
  client: string
  setClient: (v: string) => void
  location: string
  setLocation: (v: string) => void
  description: string
  setDescription: (v: string) => void
}) {
  return (
    <div className="space-y-4 cc-fade-up">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="client" className="cc-field-label">
            Cliente
          </label>
          <Input
            id="client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Constructora XYZ S.A.S."
          />
        </div>
        <div>
          <label htmlFor="location" className="cc-field-label">
            Ubicación
          </label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Medellín, Antioquia"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="cc-field-label">
          Descripción
        </label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Torre residencial de 12 pisos en zona de amenaza sísmica alta (Aa=0.25g). Sistema DMO en concreto reforzado."
          className="flex w-full rounded-md border border-cc-gray-200 bg-white px-3 py-2 text-cc-gray-900 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:text-white"
        />
        <p className="cc-field-hint">
          Opcional. Aparece en la portada del proyecto y en memorias técnicas.
        </p>
      </div>

      <div className="cc-wizard-tip">
        <span className="cc-wizard-tip-icon">
          <SparkleIcon size={13} />
        </span>
        <span>Todos los campos son opcionales. Puedes dejarlos vacíos y completarlos después.</span>
      </div>
    </div>
  )
}

function Step3Identity({
  code,
  name,
  client,
  location,
  orgName,
  activeIdx,
  autoIdx,
  onPickPalette,
}: {
  code: string
  name: string
  client: string
  location: string
  orgName?: string
  activeIdx: number
  autoIdx: number
  onPickPalette: (i: number | null) => void
}) {
  return (
    <div className="space-y-4 cc-fade-up">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="cc-field-label !mb-0">Color de portada</label>
          {activeIdx !== autoIdx && (
            <button
              type="button"
              onClick={() => onPickPalette(null)}
              className="font-medium text-cc-cyan-600 text-xs hover:underline dark:text-cc-cyan-400"
            >
              Auto por código
            </button>
          )}
        </div>
        <div className="cc-palette-grid">
          {PROJECT_PALETTES.map((p, i) => {
            const selected = i === activeIdx
            return (
              <button
                key={i}
                type="button"
                className="cc-palette-swatch"
                data-selected={selected}
                onClick={() => onPickPalette(i)}
                aria-label={`Paleta ${i + 1}`}
                style={{
                  ['--_sw-c1' as string]: p.c1,
                  ['--_sw-c2' as string]: p.c2,
                  ['--_sw-accent' as string]: p.accent,
                }}
              >
                <span className="cc-palette-swatch-fill" />
                <span className="cc-palette-swatch-dot" />
                {selected && (
                  <span className="cc-palette-swatch-check">
                    <CheckIcon size={11} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="cc-field-hint">
          {activeIdx === autoIdx
            ? 'Elegida automáticamente por el código. Puedes personalizarla.'
            : 'Personalizada. Se guarda en este navegador.'}
        </p>
      </div>

      <div>
        <p className="cc-field-label">Resumen</p>
        <div className="cc-wizard-summary">
          <span className="cc-wizard-summary-label">Código</span>
          <span className="cc-wizard-summary-value font-mono">{code || '—'}</span>
          <span className="cc-wizard-summary-label">Nombre</span>
          <span className="cc-wizard-summary-value">{name || '—'}</span>
          <span className="cc-wizard-summary-label">Cliente</span>
          <span className="cc-wizard-summary-value">{client || '—'}</span>
          <span className="cc-wizard-summary-label">Ubicación</span>
          <span className="cc-wizard-summary-value">{location || '—'}</span>
          <span className="cc-wizard-summary-label">Organización</span>
          <span className="cc-wizard-summary-value">{orgName ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Edit form (sin wizard — form simple)
// ──────────────────────────────────────────────────────────────────────────

function ProjectEditForm({
  organizations,
  project,
  onClose,
  onSubmitDone,
}: {
  organizations: OrganizationWithRole[]
  project: Project
  onClose: () => void
  onSubmitDone: () => void | Promise<void>
}) {
  const [code, setCode] = useState(project.code)
  const [name, setName] = useState(project.name)
  const [client, setClient] = useState(project.client ?? '')
  const [location, setLocation] = useState(project.location ?? '')
  const [description, setDescription] = useState(project.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await projectsApi.update(project.id, {
        code,
        name,
        client: client || null,
        location: location || null,
        description: description || null,
      })
      await onSubmitDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  const orgName = organizations.find((o) => o.id === project.organization_id)?.name

  return (
    <form onSubmit={onSubmit} className="w-[92vw] max-w-[32rem]">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>
            {orgName && `${orgName} · `}
            Los cambios se aplican de inmediato.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label htmlFor="code" className="cc-field-label">
                Código
              </label>
              <Input
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
                maxLength={12}
              />
            </div>
            <div>
              <label htmlFor="name" className="cc-field-label">
                Nombre
              </label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="client" className="cc-field-label">
              Cliente
            </label>
            <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div>
            <label htmlFor="location" className="cc-field-label">
              Ubicación
            </label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label htmlFor="description" className="cc-field-label">
              Descripción
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex w-full rounded-md border border-cc-gray-200 bg-white px-3 py-2 text-cc-gray-900 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:text-white"
            />
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </form>
  )
}

function DeleteConfirm({
  project,
  onClose,
  onDeleted,
}: {
  project: Project
  onClose: () => void
  onDeleted: () => void | Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setLoading(true)
    setError(null)
    try {
      await projectsApi.remove(project.id)
      await onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  return (
    <div className="w-[90vw] max-w-[24rem]">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar proyecto</DialogTitle>
          <DialogDescription>
            Vas a eliminar <strong>{project.name}</strong> ({project.code}) y todos sus edificios,
            revisiones y archivos asociados. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="mt-3 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  )
}
