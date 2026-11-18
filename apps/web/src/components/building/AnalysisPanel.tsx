'use client'

import { type AnalysisRun, ApiError, analyses as analysesApi } from '@/lib/api'
import { Badge, Button, Card, CardContent } from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

type MassByLevel = {
  level_id: string
  level_name: string
  elevation_m: number
  mass_tons: number
  volume_m3: number
}

type LevelCounts = {
  level_id: string
  level_name: string
  elevation_m: number
  counts: Record<string, number>
}

type QuickCheckSummary = {
  n_levels?: number
  n_nodes?: number
  n_elements?: number
  n_sections?: number
  height_m?: number
  n_stories?: number
  total_mass_tons?: number
  total_concrete_volume_m3?: number
  length_by_kind_m?: Record<string, number>
  element_counts?: Record<string, number>
  mass_by_level?: MassByLevel[]
  element_counts_by_level?: LevelCounts[]
  warnings?: string[]
}

export function AnalysisPanel({
  buildingId,
  revisionId,
}: {
  buildingId: string
  revisionId: string
}) {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await analysesApi.list(buildingId, revisionId)
      setRuns(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [buildingId, revisionId])

  useEffect(() => {
    void load()
  }, [load])

  // Polling automático mientras haya algún run en pending/running.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const active = runs.some((r) => r.status === 'pending' || r.status === 'running')
    if (active && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void load()
      }, 1500)
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
  }, [runs, load])

  async function onRun() {
    setWorking(true)
    setError(null)
    try {
      await analysesApi.create(buildingId, revisionId, 'quick_check')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
            Análisis preliminar (quick check)
          </p>
          <p className="text-cc-gray-500 text-xs">
            Métricas geométricas, de masa y chequeos de consistencia del modelo. Sin OpenSees.
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={onRun} loading={working}>
          Nuevo análisis
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-cc-gray-500 text-sm">Cargando análisis previos…</p>
      ) : runs.length === 0 ? (
        <p className="text-cc-gray-500 text-sm">
          Sin análisis previos. Dispara el primero con el botón de arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <AnalysisRunItem key={r.id} run={r} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AnalysisRunItem({ run }: { run: AnalysisRun }) {
  const [expanded, setExpanded] = useState(false)
  const summary = (run.result_summary ?? null) as QuickCheckSummary | null
  const canExpand = run.status === 'completed' && summary !== null

  const dt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-CO', { hour12: false }) : '—'
  const durationMs =
    run.started_at && run.completed_at
      ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
      : null

  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    run.status === 'completed'
      ? 'success'
      : run.status === 'failed'
        ? 'danger'
        : run.status === 'running'
          ? 'info'
          : 'warning'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
              {run.kind} · <Badge variant={statusVariant}>{run.status}</Badge>
            </p>
            <p className="text-cc-gray-500 text-xs">
              {dt(run.created_at)}
              {durationMs !== null && ` · ${(durationMs / 1000).toFixed(2)}s`}
            </p>
          </div>
          {canExpand && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Ver resultados'}
            </Button>
          )}
        </div>

        {run.status === 'failed' && run.log && (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs">
            {run.log}
          </pre>
        )}

        {expanded && summary && <SummaryView summary={summary} />}
      </CardContent>
    </Card>
  )
}

function SummaryView({ summary }: { summary: QuickCheckSummary }) {
  return (
    <div className="mt-4 space-y-4 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Niveles" value={summary.n_levels ?? 0} />
        <Metric label="Nodos" value={summary.n_nodes ?? 0} />
        <Metric label="Elementos" value={summary.n_elements ?? 0} />
        <Metric label="Secciones" value={summary.n_sections ?? 0} />
        <Metric label="Altura total" value={`${(summary.height_m ?? 0).toFixed(2)} m`} />
        <Metric label="Pisos" value={summary.n_stories ?? 0} />
        <Metric label="Masa total" value={`${(summary.total_mass_tons ?? 0).toFixed(2)} t`} />
        <Metric
          label="Volumen hormigón"
          value={`${(summary.total_concrete_volume_m3 ?? 0).toFixed(2)} m³`}
        />
      </div>

      {summary.element_counts && Object.keys(summary.element_counts).length > 0 && (
        <div>
          <p className="mb-2 font-medium text-cc-gray-900 text-xs dark:text-white">
            Elementos por tipo
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(summary.element_counts).map(([k, n]) => (
              <span
                key={k}
                className="rounded border border-cc-gray-200 bg-cc-gray-50 px-2 py-1 dark:border-cc-navy-700 dark:bg-cc-navy-800"
              >
                {k}: <strong>{n}</strong>
                {summary.length_by_kind_m?.[k] !== undefined &&
                  ` · ${summary.length_by_kind_m[k].toFixed(1)}m`}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.mass_by_level && summary.mass_by_level.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-cc-gray-900 text-xs dark:text-white">
            Masa por nivel
          </p>
          <table className="w-full text-xs">
            <thead className="text-cc-gray-500">
              <tr>
                <th className="py-1 text-left font-normal">Nivel</th>
                <th className="py-1 text-right font-normal">Elev. (m)</th>
                <th className="py-1 text-right font-normal">Vol. (m³)</th>
                <th className="py-1 text-right font-normal">Masa (t)</th>
              </tr>
            </thead>
            <tbody>
              {summary.mass_by_level.map((lev) => (
                <tr
                  key={lev.level_id}
                  className="border-cc-gray-100 border-t dark:border-cc-navy-800"
                >
                  <td className="py-1">{lev.level_name}</td>
                  <td className="py-1 text-right">{lev.elevation_m.toFixed(2)}</td>
                  <td className="py-1 text-right">{lev.volume_m3.toFixed(2)}</td>
                  <td className="py-1 text-right">{lev.mass_tons.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary.warnings && summary.warnings.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-cc-warn-600 text-xs dark:text-cc-warn-500">
            Advertencias
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-cc-gray-700 dark:text-cc-gray-300">
            {summary.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
