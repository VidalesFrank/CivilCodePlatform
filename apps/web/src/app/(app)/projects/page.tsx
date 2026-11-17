'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from '@civilcode/ui'
import { SheetIcon } from '@civilcode/icons'
import {
  ApiError,
  organizations as orgsApi,
  projects as projectsApi,
  type OrganizationWithRole,
  type Project,
} from '@/lib/api'

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

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

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-bold text-3xl text-cc-gray-900 dark:text-white">Proyectos</h1>
          <p className="mt-1 text-cc-gray-500 text-sm">
            Crea, lista y abre los proyectos estructurales de tu organización.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={orgs.length === 0}
          onClick={() => setShowModal(true)}
        >
          Nuevo proyecto
        </Button>
      </div>

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
        <Card>
          <CardContent className="py-12 text-center">
            <SheetIcon size={48} className="mx-auto mb-4 text-cc-gray-400" />
            <p className="text-cc-gray-600 dark:text-cc-gray-300">
              Aún no tienes proyectos. Crea el primero con el botón de arriba.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="info">{p.code}</Badge>
                    <span className="text-cc-gray-400 text-xs">
                      {orgs.find((o) => o.id === p.organization_id)?.name ?? '—'}
                    </span>
                  </div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-2">
                    {p.client ? `Cliente: ${p.client}` : 'Sin cliente'} ·{' '}
                    {p.location ?? 'Sin ubicación'}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          organizations={orgs}
          onClose={() => setShowModal(false)}
          onCreated={async () => {
            setShowModal(false)
            await reload()
          }}
        />
      )}
    </div>
  )
}

function CreateProjectModal({
  organizations,
  onClose,
  onCreated,
}: {
  organizations: OrganizationWithRole[]
  onClose: () => void
  onCreated: () => void | Promise<void>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await projectsApi.create({
        organization_id: orgId,
        code,
        name,
        client: client || null,
        location: location || null,
      })
      await onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/40 dark:bg-cc-navy-900"
    >
      <form onSubmit={onSubmit} className="w-96 space-y-4 p-6">
        <h2 className="font-semibold text-cc-gray-900 text-lg dark:text-white">
          Nuevo proyecto
        </h2>

        <div className="space-y-2">
          <Label htmlFor="org">Organización</Label>
          <select
            id="org"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border border-cc-gray-200 bg-white px-3 text-cc-gray-900 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:text-white"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

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
          <Input
            id="client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Constructora XYZ"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Bogotá, Colombia"
          />
        </div>

        {error && (
          <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Crear
          </Button>
        </div>
      </form>
    </dialog>
  )
}
