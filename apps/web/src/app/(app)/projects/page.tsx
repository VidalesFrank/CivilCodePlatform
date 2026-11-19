'use client'

import {
  ApiError,
  type OrganizationWithRole,
  type Project,
  organizations as orgsApi,
  projects as projectsApi,
} from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
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
  Label,
  Select,
  Skeleton,
} from '@civilcode/ui'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type ModalState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; project: Project }
  | { kind: 'delete'; project: Project }

export default function ProjectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' })

  async function reload() {
    try {
      const [orgList, projectList] = await Promise.all([orgsApi.list(), projectsApi.list()])
      setOrgs(orgList)
      setProjects(projectList)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  // Auto-abre el dialog si viene con ?new=1
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setModal({ kind: 'create' })
      // Limpiar el query param del URL para que no reabra al refrescar
      router.replace('/projects')
    }
  }, [searchParams, router])

  const close = () => setModal({ kind: 'closed' })
  const afterChange = async () => {
    close()
    await reload()
  }

  return (
    <div>
      <section className="border-cc-gray-200 border-b bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <nav aria-label="Breadcrumb" className="cc-breadcrumb mb-3">
            <a href="/dashboard" className="hover:text-cc-gray-900 dark:hover:text-white">
              Dashboard
            </a>
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
            <Button
              variant="primary"
              size="lg"
              onClick={() => setModal({ kind: 'create' })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                  d="M12 5v14m-7-7h14"
                />
              </svg>
              Nuevo proyecto
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

      {error && (
        <div className="mb-4 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <button
          type="button"
          onClick={() => setModal({ kind: 'create' })}
          className="group w-full rounded-xl border-2 border-cc-gray-200 border-dashed bg-cc-gray-50 px-6 py-16 text-center transition-colors hover:border-cc-cyan-500/60 hover:bg-cc-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 dark:border-cc-navy-700 dark:bg-cc-navy-800/40 dark:hover:border-cc-cyan-500/60 dark:hover:bg-cc-cyan-500/10"
        >
          <span
            aria-hidden
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
              boxShadow: '0 10px 24px -10px rgba(34,211,238,0.6)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
                d="M12 5v14m-7-7h14"
              />
            </svg>
          </span>
          <h3 className="mt-4 font-bold text-cc-gray-900 text-xl tracking-tight dark:text-white">
            Crea tu primer proyecto
          </h3>
          <p className="mx-auto mt-2 max-w-md text-cc-gray-500 text-sm">
            Un proyecto agrupa edificios, revisiones ETABS, análisis y diseños. Toma menos de un
            minuto.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 font-medium text-cc-cyan-600 text-sm dark:text-cc-cyan-400">
            Crear ahora
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                d="M5 12h14M13 6l6 6-6 6"
              />
            </svg>
          </span>
        </button>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              orgName={orgs.find((o) => o.id === p.organization_id)?.name}
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

function ProjectCard({
  project,
  orgName,
  onEdit,
  onDelete,
}: {
  project: Project
  orgName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card interactive className="cc-fade-up group">
      <CardContent className="pt-6">
        <div className="mb-2 flex items-start justify-between">
          <Badge variant="info">{project.code}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                className="rounded p-1 text-cc-gray-400 opacity-0 transition-opacity hover:bg-cc-gray-100 hover:text-cc-gray-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-cc-navy-800"
                aria-label="Acciones"
              >
                ⋯
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
        <Link href={`/projects/${project.id}`} className="block">
          <CardTitle className="text-base">{project.name}</CardTitle>
          <CardDescription className="mt-2 line-clamp-2">
            {project.client ? `Cliente: ${project.client}` : 'Sin cliente'} ·{' '}
            {project.location ?? 'Sin ubicación'}
          </CardDescription>
          <p className="mt-3 text-cc-gray-400 text-xs">{orgName ?? '—'}</p>
        </Link>
      </CardContent>
    </Card>
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
  const [orgId, setOrgId] = useState(project?.organization_id ?? organizations[0]?.id ?? '')
  const [code, setCode] = useState(project?.code ?? '')
  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [location, setLocation] = useState(project?.location ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'create') {
        await projectsApi.create({
          organization_id: orgId,
          code,
          name,
          client: client || null,
          location: location || null,
          description: description || null,
        })
      } else if (project) {
        await projectsApi.update(project.id, {
          code,
          name,
          client: client || null,
          location: location || null,
          description: description || null,
        })
      }
      await onSubmitDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-[90vw] max-w-[28rem]">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nuevo proyecto' : 'Editar proyecto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="org">Organización</Label>
              <Select id="org" value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VT-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vita Torre"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Cliente</Label>
            <Input id="client" value={client ?? ''} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={location ?? ''}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              rows={3}
              value={description ?? ''}
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
            {mode === 'create' ? 'Crear' : 'Guardar'}
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
