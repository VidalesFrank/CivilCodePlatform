'use client'

import { ApiError, buildings as buildingsApi, type GeomLevel } from '@/lib/api'
import { Badge, Button, Card, CardContent, Label, Select } from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

type AnyDesign = {
  id: string
  name: string
  element_ids: string[]
  status: string
  config: unknown
  result_summary: Record<string, unknown> | null
  log: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface SimpleDesignPanelProps {
  buildingId: string
  revisionId: string
  title: string
  description: string
  elementKinds: string[]
  listDesigns: (buildingId: string, revisionId: string) => Promise<AnyDesign[]>
  dispatchByLevel: (
    buildingId: string,
    revisionId: string,
    levelId: string,
  ) => Promise<AnyDesign>
  emptyLevelMessage?: string
}

export function SimpleDesignPanel({
  buildingId,
  revisionId,
  title,
  description,
  elementKinds,
  listDesigns,
  dispatchByLevel,
  emptyLevelMessage,
}: SimpleDesignPanelProps) {
  const [levels, setLevels] = useState<GeomLevel[]>([])
  const [designs, setDesigns] = useState<AnyDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState('')

  const load = useCallback(async () => {
    try {
      const [geom, list] = await Promise.all([
        buildingsApi.getGeometry(buildingId, revisionId),
        listDesigns(buildingId, revisionId),
      ])
      setLevels(geom.levels)
      setDesigns(list)
      if (!selectedLevelId && geom.levels.length > 0) {
        const kinds = new Set(elementKinds)
        const firstWith = geom.levels.find((l) =>
          geom.elements.some((e) => kinds.has(e.kind) && e.level_id === l.id),
        )
        if (firstWith) setSelectedLevelId(firstWith.id)
        else setSelectedLevelId(geom.levels[0].id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [buildingId, revisionId, selectedLevelId, listDesigns, elementKinds])

  useEffect(() => {
    void load()
  }, [load])

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const active = designs.some((d) => d.status === 'pending' || d.status === 'running')
    if (active && !pollingRef.current) {
      pollingRef.current = setInterval(() => void load(), 1500)
    } else if (!active && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [designs, load])

  async function onRun() {
    if (!selectedLevelId) {
      setError('Selecciona un nivel')
      return
    }
    setWorking(true)
    setError(null)
    try {
      await dispatchByLevel(buildingId, revisionId, selectedLevelId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium text-cc-gray-900 text-sm dark:text-white">{title}</p>
        <p className="text-cc-gray-500 text-xs">{description}</p>
      </div>

      {error && (
        <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-cc-gray-500 text-sm">Cargando niveles…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-cc-gray-200 bg-cc-gray-50 p-3 dark:border-cc-navy-700 dark:bg-cc-navy-800/50">
            <div className="min-w-[14rem]">
              <Label htmlFor={`${title}-level`}>Nivel a diseñar</Label>
              <Select
                id={`${title}-level`}
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="mt-1"
              >
                <option value="">—</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (elev {l.elevation.toFixed(2)} m)
                  </option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="primary" onClick={onRun} loading={working}>
              Dispatcher con parámetros por defecto
            </Button>
          </div>

          {emptyLevelMessage && designs.length === 0 && (
            <p className="text-cc-gray-500 text-xs italic">
              {emptyLevelMessage}
            </p>
          )}

          {designs.length === 0 ? null : (
            <ul className="space-y-2">
              {designs.map((d) => (
                <DesignRow key={d.id} design={d} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function DesignRow({ design }: { design: AnyDesign }) {
  const [expanded, setExpanded] = useState(false)
  const dt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-CO', { hour12: false }) : '—'
  const summary = design.result_summary as {
    n_elements?: number
    n_elements_ok?: number
    total_warnings?: number
    elements?: Array<{ ok: boolean; tag: string; warnings?: string[] }>
  } | null
  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    design.status === 'completed'
      ? 'success'
      : design.status === 'failed'
        ? 'danger'
        : design.status === 'running' || design.status === 'pending'
          ? 'info'
          : 'warning'
  const canExpand = design.status.startsWith('completed') && summary !== null

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
              {design.name} · <Badge variant={statusVariant}>{design.status}</Badge>
            </p>
            <p className="text-cc-gray-500 text-xs">
              {dt(design.created_at)}
              {' · '}
              {design.element_ids.length} elementos
              {summary?.total_warnings != null && ` · ${summary.total_warnings} warnings`}
            </p>
          </div>
          {canExpand && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Detalles'}
            </Button>
          )}
        </div>

        {design.status === 'failed' && design.log && (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs">
            {design.log}
          </pre>
        )}

        {expanded && summary && (
          <div className="mt-4 space-y-3 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
            <div className="grid gap-2 md:grid-cols-3">
              <Metric label="Elementos" value={summary.n_elements ?? 0} />
              <Metric
                label="Sin warnings"
                value={`${summary.n_elements_ok ?? 0}/${summary.n_elements ?? 0}`}
              />
              <Metric label="Warnings total" value={summary.total_warnings ?? 0} />
            </div>
            <details className="rounded-md border border-cc-gray-200 p-3 text-xs dark:border-cc-navy-700">
              <summary className="cursor-pointer font-medium text-cc-gray-700 dark:text-cc-gray-200">
                Ver resultado crudo (JSON)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto text-[11px] text-cc-gray-600 dark:text-cc-gray-300">
                {JSON.stringify(summary, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-cc-gray-200 bg-white px-3 py-2 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <p className="text-cc-gray-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">{value}</p>
    </div>
  )
}
