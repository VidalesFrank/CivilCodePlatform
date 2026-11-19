'use client'

import { AnalysisPanel } from '@/components/building/AnalysisPanel'
import { ColumnDesignPanel } from '@/components/building/ColumnDesignPanel'
import { DesignPanel } from '@/components/building/DesignPanel'
import { ModelViewer3D } from '@/components/building/ModelViewer3D'
import { SimpleDesignPanel } from '@/components/building/SimpleDesignPanel'
import {
  ApiError,
  type Building,
  type BuildingDetail,
  type BuildingRevision,
  type RevisionGeometry,
  buildings as buildingsApi,
  footingDesigns as footingDesignsApi,
  wallDesigns as wallDesignsApi,
} from '@/lib/api'
import { CubeIcon, DxfIcon } from '@civilcode/icons'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
} from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

export function BuildingsPanel({ projectId }: { projectId: string }) {
  const [list, setList] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const reload = useCallback(async () => {
    try {
      const data = await buildingsApi.listByProject(projectId)
      setList(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return <p className="text-cc-danger-600 text-sm">{error}</p>
  }

  return (
    <div className="space-y-4">
      {/* Header con CTA primario upload */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-cc-gray-900 text-base dark:text-white">
            Edificios y revisiones
          </h3>
          <p className="text-cc-gray-500 text-sm">
            Cada edificio puede tener varias revisiones (importaciones de modelo ETABS o ediciones
            manuales).
          </p>
        </div>
        {list.length > 0 && (
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                d="M12 15V3m0 0l-4 4m4-4l4 4M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"
              />
            </svg>
            Subir modelo ETABS
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyDropZone onClick={() => setUploadOpen(true)} />
      ) : (
        <div className="space-y-3">
          {list.map((b, i) => (
            <BuildingCard key={b.id} building={b} delay={i * 60} />
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <UploadWizard
          projectId={projectId}
          existingBuildings={list}
          onClose={() => setUploadOpen(false)}
          onDone={async () => {
            setUploadOpen(false)
            await reload()
          }}
        />
      </Dialog>
    </div>
  )
}

function EmptyDropZone({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-xl border-2 border-cc-gray-200 border-dashed bg-cc-gray-50 px-6 py-12 text-center transition-colors hover:border-cc-cyan-500/60 hover:bg-cc-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 dark:border-cc-navy-700 dark:bg-cc-navy-800/40 dark:hover:border-cc-cyan-500/60 dark:hover:bg-cc-cyan-500/10"
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
            strokeWidth="2.2"
            d="M12 15V3m0 0l-4 4m4-4l4 4M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"
          />
        </svg>
      </span>
      <h4 className="mt-4 font-semibold text-cc-gray-900 text-lg dark:text-white">
        Sube tu primer modelo ETABS
      </h4>
      <p className="mx-auto mt-1 max-w-md text-cc-gray-500 text-sm">
        Archivo <code className="font-mono">.e2k</code> o <code className="font-mono">.xlsx</code>.
        Crearemos el edificio automáticamente y dispararemos el import.
      </p>
      <span className="mt-6 inline-flex items-center gap-2 font-medium text-cc-cyan-600 text-sm dark:text-cc-cyan-400">
        Seleccionar archivo
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
  )
}

/** Wizard unificado: file + nombre edificio opcional → crea building + upload + dispatch. */
function UploadWizard({
  projectId,
  existingBuildings,
  onClose,
  onDone,
}: {
  projectId: string
  existingBuildings: Building[]
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'new' | 'existing'>(
    existingBuildings.length === 0 ? 'new' : 'new',
  )
  const [buildingName, setBuildingName] = useState('')
  const [existingBuildingId, setExistingBuildingId] = useState(existingBuildings[0]?.id ?? '')
  const [autoImport, setAutoImport] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Selecciona un archivo .e2k o .xlsx')
      return
    }
    const effectiveName =
      mode === 'new' ? buildingName.trim() || file.name.replace(/\.[^.]+$/, '') : ''

    setLoading(true)
    setError(null)
    try {
      let buildingId = existingBuildingId
      if (mode === 'new') {
        const b = await buildingsApi.create({ project_id: projectId, name: effectiveName })
        buildingId = b.id
      }
      const rev = await buildingsApi.uploadRevision(buildingId, file)
      if (autoImport) {
        await buildingsApi.dispatchImport(buildingId, rev.id)
      }
      await onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-[90vw] max-w-[32rem]">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir modelo ETABS</DialogTitle>
          <DialogDescription>
            Archivo <strong>.e2k</strong> o <strong>.xlsx</strong>. Puedes crear un edificio nuevo
            o agregar la revisión a uno existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label className="cc-label-mono">Archivo</Label>
            <div
              className={`flex items-center justify-between rounded-md border border-dashed px-3 py-3 transition-colors ${
                file
                  ? 'border-cc-cyan-500/60 bg-cc-cyan-500/5 dark:border-cc-cyan-500/50'
                  : 'border-cc-gray-300 bg-cc-gray-50 dark:border-cc-navy-700 dark:bg-cc-navy-800/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <p className="truncate font-medium text-cc-gray-900 text-sm dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-cc-gray-500 text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <p className="text-cc-gray-500 text-sm">Ningún archivo seleccionado.</p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".e2k,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                {file ? 'Cambiar' : 'Seleccionar'}
              </Button>
            </div>
          </div>

          {/* Toggle new vs existing building */}
          {existingBuildings.length > 0 && (
            <div className="rounded-md border border-cc-gray-200 p-3 dark:border-cc-navy-700">
              <div className="flex gap-1">
                <button
                  type="button"
                  className="cc-group-tab flex-1 justify-center"
                  data-active={mode === 'new'}
                  onClick={() => setMode('new')}
                >
                  Nuevo edificio
                </button>
                <button
                  type="button"
                  className="cc-group-tab flex-1 justify-center"
                  data-active={mode === 'existing'}
                  onClick={() => setMode('existing')}
                >
                  Agregar a existente
                </button>
              </div>
              {mode === 'new' ? (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="bname" className="cc-label-mono">
                    Nombre del edificio
                  </Label>
                  <Input
                    id="bname"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder={file?.name.replace(/\.[^.]+$/, '') ?? 'Torre A'}
                  />
                  <p className="text-cc-gray-500 text-xs">
                    Si lo dejas vacío, usaremos el nombre del archivo.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="bid" className="cc-label-mono">
                    Edificio existente
                  </Label>
                  <select
                    id="bid"
                    value={existingBuildingId}
                    onChange={(e) => setExistingBuildingId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-cc-gray-200 bg-white px-3 text-sm text-cc-gray-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:text-white"
                    required
                  >
                    {existingBuildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {existingBuildings.length === 0 && (
            <div className="space-y-2">
              <Label htmlFor="bname" className="cc-label-mono">
                Nombre del edificio (opcional)
              </Label>
              <Input
                id="bname"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder={file?.name.replace(/\.[^.]+$/, '') ?? 'Torre A'}
              />
              <p className="text-cc-gray-500 text-xs">
                Si lo dejas vacío, usaremos el nombre del archivo.
              </p>
            </div>
          )}

          {/* Auto-import toggle */}
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-cc-gray-200 p-3 dark:border-cc-navy-700">
            <input
              type="checkbox"
              checked={autoImport}
              onChange={(e) => setAutoImport(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cc-cyan-600"
            />
            <div className="text-sm">
              <p className="font-medium text-cc-gray-900 dark:text-white">
                Importar automáticamente al subir
              </p>
              <p className="text-cc-gray-500 text-xs">
                Dispara el pipeline Celery de parser E2K → canonical → SQL. Puedes ver el progreso
                en la fila de la revisión.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm dark:bg-cc-danger-500/20 dark:text-cc-danger-500">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={!file}>
            Subir{autoImport ? ' + importar' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </form>
  )
}

function BuildingCard({ building, delay }: { building: Building; delay: number }) {
  const [detail, setDetail] = useState<BuildingDetail | null>(null)
  const [expanded, setExpanded] = useState(true) // expandido por default
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    try {
      const d = await buildingsApi.get(building.id)
      setDetail(d)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    }
  }, [building.id])

  useEffect(() => {
    if (expanded && !detail) void loadDetail()
  }, [expanded, detail, loadDetail])

  const latestRevision = detail?.revisions[0]

  return (
    <Card
      interactive={false}
      className="cc-fade-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-cc-gray-100 border-b px-5 py-4 dark:border-cc-navy-800">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background: 'color-mix(in srgb, #3b82f6 12%, transparent)',
              color: '#3b82f6',
              border: '1px solid color-mix(in srgb, #3b82f6 25%, transparent)',
            }}
          >
            <CubeIcon size={20} />
          </span>
          <div>
            <p className="font-semibold text-cc-gray-900 dark:text-white">{building.name}</p>
            <p className="text-cc-gray-500 text-xs">
              {detail
                ? `${detail.revisions.length} ${detail.revisions.length === 1 ? 'revisión' : 'revisiones'}`
                : 'cargando…'}
              {latestRevision && (
                <>
                  {' · '}última: <span className="font-mono">#{latestRevision.revision_number}</span>
                  <Badge
                    variant={
                      latestRevision.status === 'imported'
                        ? 'success'
                        : latestRevision.status === 'invalid'
                          ? 'danger'
                          : latestRevision.status === 'queued' || latestRevision.status === 'importing'
                            ? 'info'
                            : 'warning'
                    }
                    className="ml-2"
                  >
                    {latestRevision.status}
                  </Badge>
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ocultar revisiones' : 'Ver revisiones'}
        </Button>
      </div>

      {error && (
        <p className="mx-5 my-2 rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-xs dark:bg-cc-danger-500/20">
          {error}
        </p>
      )}

      {expanded && detail && (
        <div className="px-5 py-4">
          {detail.revisions.length === 0 ? (
            <p className="py-4 text-center text-cc-gray-500 text-sm">
              Este edificio aún no tiene revisiones. Sube un modelo ETABS desde el botón de arriba.
            </p>
          ) : (
            <ul className="space-y-3">
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
  type PanelKey = null | 'viewer' | 'analysis' | 'beams' | 'columns' | 'walls' | 'footings'
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<PanelKey>(null)
  const [geometry, setGeometry] = useState<RevisionGeometry | null>(null)
  const [loadingGeom, setLoadingGeom] = useState(false)

  const canImport = revision.status === 'draft' || revision.status === 'invalid'
  const canView = revision.status === 'imported'

  async function openPanel(key: PanelKey) {
    if (activePanel === key) {
      setActivePanel(null)
      return
    }
    if (key === 'viewer' && !geometry) {
      setLoadingGeom(true)
      setError(null)
      try {
        const g = await buildingsApi.getGeometry(buildingId, revision.id)
        setGeometry(g)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error cargando geometría')
        return
      } finally {
        setLoadingGeom(false)
      }
    }
    setActivePanel(key)
  }

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

  const statusVariant =
    revision.status === 'imported'
      ? 'success'
      : revision.status === 'invalid'
        ? 'danger'
        : revision.status === 'queued' || revision.status === 'importing'
          ? 'info'
          : 'warning'

  const panelTabs: { key: Exclude<PanelKey, null>; label: string }[] = [
    { key: 'viewer', label: 'Ver 3D' },
    { key: 'analysis', label: 'Análisis' },
    { key: 'beams', label: 'Vigas' },
    { key: 'columns', label: 'Columnas' },
    { key: 'walls', label: 'Muros' },
    { key: 'footings', label: 'Zapatas' },
  ]

  return (
    <li className="rounded-lg border border-cc-gray-200 bg-cc-gray-50 dark:border-cc-navy-700 dark:bg-cc-navy-800/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <DxfIcon size={20} className="text-cc-cyan-600 dark:text-cc-cyan-400" />
          <div>
            <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
              Revisión #{revision.revision_number}{' '}
              <span className="font-mono text-xs text-cc-gray-400">· {revision.source}</span>
            </p>
            <p className="text-cc-gray-500 text-xs">{revision.notes ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant}>{revision.status}</Badge>
          {isActive && <Badge variant="info">activa</Badge>}
          {canImport && (
            <Button size="sm" variant="primary" onClick={onImport} loading={working}>
              Importar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs dark:bg-cc-danger-500/20">
          {error}
        </p>
      )}

      {canView && (
        <>
          <div className="flex flex-wrap items-center gap-1 overflow-x-auto border-cc-gray-200 border-t px-3 py-2 dark:border-cc-navy-700">
            {panelTabs.map((t) => {
              const active = activePanel === t.key
              const loading = t.key === 'viewer' && loadingGeom
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => void openPanel(t.key)}
                  data-active={active}
                  className="cc-group-tab"
                  disabled={loading}
                >
                  {loading && (
                    <svg
                      aria-hidden
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        fill="currentColor"
                        className="opacity-75"
                      />
                    </svg>
                  )}
                  {t.label}
                </button>
              )
            })}
          </div>

          {activePanel === 'viewer' && geometry && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <ModelViewer3D geometry={geometry} />
            </div>
          )}
          {activePanel === 'analysis' && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <AnalysisPanel buildingId={buildingId} revisionId={revision.id} />
            </div>
          )}
          {activePanel === 'beams' && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <DesignPanel buildingId={buildingId} revisionId={revision.id} />
            </div>
          )}
          {activePanel === 'columns' && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <ColumnDesignPanel buildingId={buildingId} revisionId={revision.id} />
            </div>
          )}
          {activePanel === 'walls' && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <SimpleDesignPanel
                buildingId={buildingId}
                revisionId={revision.id}
                title="Diseño de muros · NSR-10 (cortante en plano simplificado)"
                description="Cuantías mínimas ρh/ρv, Vn con factor αc por relación hw/Lw, flag de elementos de borde confinados."
                elementKinds={['wall']}
                listDesigns={wallDesignsApi.list}
                dispatchByLevel={(bId, rId, lId) =>
                  wallDesignsApi.createByLevel(bId, rId, lId, {})
                }
                emptyLevelMessage="Si no hay muros en la revisión importada, el endpoint devolverá 400."
              />
            </div>
          )}
          {activePanel === 'footings' && (
            <div className="border-cc-gray-200 border-t bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <SimpleDesignPanel
                buildingId={buildingId}
                revisionId={revision.id}
                title="Diseño de zapatas · NSR-10 (aisladas, cuadradas)"
                description="Dimensionamiento L×B por q_adm, peralte iterativo por punzonamiento, flexión en cara de columna."
                elementKinds={['footing', 'column']}
                listDesigns={footingDesignsApi.list}
                dispatchByLevel={(bId, rId, lId) =>
                  footingDesignsApi.createByLevel(bId, rId, lId, {})
                }
                emptyLevelMessage="Toma columnas del nivel seleccionado como arranques; en nivel base típicamente."
              />
            </div>
          )}
        </>
      )}
    </li>
  )
}
