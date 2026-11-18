'use client'

import { AnalysisPanel } from '@/components/building/AnalysisPanel'
import { ModelViewer3D } from '@/components/building/ModelViewer3D'
import {
  ApiError,
  type Building,
  type BuildingDetail,
  type BuildingRevision,
  type RevisionGeometry,
  buildings as buildingsApi,
} from '@/lib/api'
import { CubeIcon, DxfIcon } from '@civilcode/icons'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '@civilcode/ui'
import { useEffect, useRef, useState } from 'react'

export function BuildingsPanel({ projectId }: { projectId: string }) {
  const [list, setList] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  async function reload() {
    try {
      const data = await buildingsApi.listByProject(projectId)
      setList(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [projectId])

  if (loading) {
    return <Skeleton className="h-32 w-full" />
  }

  if (error) {
    return <p className="text-cc-danger-600 text-sm">{error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-cc-gray-900 dark:text-white">Edificios</h3>
          <p className="text-cc-gray-500 text-sm">
            Un proyecto puede contener uno o varios edificios. Cada edificio tiene revisiones
            (imports ETABS o ediciones manuales).
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          Nuevo edificio
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CubeIcon size={48} className="mx-auto mb-3 text-cc-gray-400" />
            <CardTitle className="text-base">Sin edificios</CardTitle>
            <CardDescription className="mt-1">
              Crea el primer edificio para empezar a subir modelos ETABS.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <BuildingRow key={b.id} building={b} />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateBuildingForm
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false)
            await reload()
          }}
        />
      </Dialog>
    </div>
  )
}

function CreateBuildingForm({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string
  onClose: () => void
  onCreated: () => void | Promise<void>
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await buildingsApi.create({ project_id: projectId, name })
      await onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-96">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo edificio</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bname">Nombre del edificio</Label>
          <Input
            id="bname"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Torre A"
          />
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
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </form>
  )
}

function BuildingRow({ building }: { building: Building }) {
  const [detail, setDetail] = useState<BuildingDetail | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadDetail() {
    try {
      const d = await buildingsApi.get(building.id)
      setDetail(d)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    }
  }

  useEffect(() => {
    if (expanded && !detail) void loadDetail()
  }, [expanded])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await buildingsApi.uploadRevision(building.id, file)
      await loadDetail()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de subida')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CubeIcon size={24} className="text-cc-blue-600" />
            <div>
              <p className="font-medium text-cc-gray-900 dark:text-white">{building.name}</p>
              <p className="text-cc-gray-500 text-xs">
                {building.active_revision_id ? 'Con revisión activa' : 'Sin revisiones'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".e2k,.xlsx"
              onChange={onFile}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
            >
              Subir E2K / XLSX
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Revisiones'}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
            {error}
          </p>
        )}

        {expanded && detail && (
          <div className="mt-4 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
            {detail.revisions.length === 0 ? (
              <p className="text-cc-gray-500 text-sm">Sin revisiones aún.</p>
            ) : (
              <ul className="space-y-2">
                {detail.revisions.map((r) => (
                  <RevisionRow
                    key={r.id}
                    buildingId={building.id}
                    revision={r}
                    isActive={r.id === detail.active_revision_id}
                    onChanged={loadDetail}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RevisionRow({
  buildingId,
  revision,
  isActive,
  onChanged,
}: {
  buildingId: string
  revision: BuildingRevision
  isActive: boolean
  onChanged: () => void | Promise<void>
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [geometry, setGeometry] = useState<RevisionGeometry | null>(null)
  const [loadingGeom, setLoadingGeom] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)

  const canImport = revision.status === 'draft' || revision.status === 'invalid'
  const canView = revision.status === 'imported'

  async function onImport() {
    setWorking(true)
    setError(null)
    try {
      await buildingsApi.dispatchImport(buildingId, revision.id)
      await onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setWorking(false)
    }
  }

  async function toggleViewer() {
    if (viewerOpen) {
      setViewerOpen(false)
      return
    }
    setViewerOpen(true)
    if (!geometry) {
      setLoadingGeom(true)
      setError(null)
      try {
        const g = await buildingsApi.getGeometry(buildingId, revision.id)
        setGeometry(g)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error cargando geometría')
        setViewerOpen(false)
      } finally {
        setLoadingGeom(false)
      }
    }
  }

  return (
    <li className="rounded-md bg-cc-gray-50 px-3 py-2 dark:bg-cc-navy-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DxfIcon size={20} className="text-cc-gray-500" />
          <div>
            <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
              Revisión #{revision.revision_number} · {revision.source}
            </p>
            <p className="text-cc-gray-500 text-xs">{revision.notes ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              revision.status === 'imported'
                ? 'success'
                : revision.status === 'invalid'
                  ? 'danger'
                  : revision.status === 'queued' || revision.status === 'importing'
                    ? 'info'
                    : 'warning'
            }
          >
            {revision.status}
          </Badge>
          {isActive && <Badge variant="info">activa</Badge>}
          {canImport && (
            <Button size="sm" variant="primary" onClick={onImport} loading={working}>
              Importar
            </Button>
          )}
          {canView && (
            <Button
              size="sm"
              variant={viewerOpen ? 'ghost' : 'secondary'}
              onClick={toggleViewer}
              loading={loadingGeom}
            >
              {viewerOpen ? 'Ocultar 3D' : 'Ver 3D'}
            </Button>
          )}
          {canView && (
            <Button
              size="sm"
              variant={analysisOpen ? 'ghost' : 'secondary'}
              onClick={() => setAnalysisOpen(!analysisOpen)}
            >
              {analysisOpen ? 'Ocultar análisis' : 'Análisis'}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs">
          {error}
        </p>
      )}
      {viewerOpen && geometry && (
        <div className="mt-3">
          <ModelViewer3D geometry={geometry} />
        </div>
      )}
      {analysisOpen && (
        <div className="mt-3">
          <AnalysisPanel buildingId={buildingId} revisionId={revision.id} />
        </div>
      )}
    </li>
  )
}
