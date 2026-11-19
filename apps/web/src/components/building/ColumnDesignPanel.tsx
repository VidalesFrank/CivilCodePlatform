'use client'

import {
  ApiError,
  type ColumnDesign,
  type ColumnDesignConfig,
  buildings as buildingsApi,
  columnDesigns as columnDesignsApi,
  type GeomLevel,
} from '@/lib/api'
import { Badge, Button, Card, CardContent, Input, Label, Select } from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_CONFIG: ColumnDesignConfig = {
  fc_mpa: 28,
  fy_mpa: 420,
  fys_mpa: 420,
  cover_mm: 40,
  ductility: 'DMO',
  rho_long_target: 0.015,
  tributary_area_m2: 20,
  levels_above: 1,
  dead_slab_kN_m2: 5,
  live_kN_m2: 2,
}

type ColumnElementResult = {
  element_id: string
  tag: string
  ok: boolean
  geom: { b_cm: number; h_cm: number; d_cm: number; length_m: number; ag_cm2: number }
  section_name?: string
  demands: {
    Pu_kN: number
    Mux_kNm: number
    Muy_kNm: number
    Vu_kN: number
    Pu_estimated_kN: number
  }
  longitudinal: {
    bar: string
    n: number
    as_prov_cm2: number
    rho_prov: number
    rho_min: number
    rho_max: number
  }
  capacity: {
    phi_Pn_max_kN: number
    phi_Mnx_kNm: number
    phi_Mny_kNm: number
    axial_utilization: number
    bresler: number | null
  }
  shear: {
    phi_Vc_kN: number
    phi_Vn_kN: number
    stirrup: { bar: string; av_cm2: number; s_conf_cm: number; s_gen_cm: number; lo_cm: number }
  }
  warnings: string[]
  error?: string
}

type ColumnDesignSummary = {
  ok: boolean
  n_elements: number
  n_elements_ok: number
  total_warnings: number
  avg_rho_long: number
  elements: ColumnElementResult[]
}

export function ColumnDesignPanel({
  buildingId,
  revisionId,
}: {
  buildingId: string
  revisionId: string
}) {
  const [levels, setLevels] = useState<GeomLevel[]>([])
  const [designs, setDesigns] = useState<ColumnDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [config, setConfig] = useState<ColumnDesignConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)

  const load = useCallback(async () => {
    try {
      const [geom, ds] = await Promise.all([
        buildingsApi.getGeometry(buildingId, revisionId),
        columnDesignsApi.list(buildingId, revisionId),
      ])
      setLevels(geom.levels)
      setDesigns(ds)
      if (!selectedLevelId && geom.levels.length > 0) {
        const firstWithCols = geom.levels.find((l) =>
          geom.elements.some((e) => e.kind === 'column' && e.level_id === l.id),
        )
        if (firstWithCols) setSelectedLevelId(firstWithCols.id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [buildingId, revisionId, selectedLevelId])

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

  async function onRunByLevel() {
    if (!selectedLevelId) {
      setError('Selecciona un nivel')
      return
    }
    setWorking(true)
    setError(null)
    try {
      await columnDesignsApi.createByLevel(buildingId, revisionId, selectedLevelId, config)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
          Diseño de columnas · NSR-10 (flexo-compresión biaxial simplificada)
        </p>
        <p className="text-cc-gray-500 text-xs">
          Pu estimado por carga tributaria × nº de niveles (o pasar directo en config). Bresler
          α=1, φPn_max con factor 0.80 (C.22.4.2.2). Confinamiento según ductilidad.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-cc-gray-500 text-sm">Cargando niveles y diseños previos…</p>
      ) : (
        <>
          <div className="rounded-md border border-cc-gray-200 bg-cc-gray-50 p-3 dark:border-cc-navy-700 dark:bg-cc-navy-800/50">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem]">
                <Label htmlFor="col-level-sel">Nivel a diseñar</Label>
                <Select
                  id="col-level-sel"
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
              <Button
                size="sm"
                variant={showConfig ? 'ghost' : 'secondary'}
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? 'Ocultar parámetros' : 'Parámetros de diseño'}
              </Button>
              <Button size="sm" variant="primary" onClick={onRunByLevel} loading={working}>
                Diseñar columnas del nivel
              </Button>
            </div>
            {showConfig && (
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <ConfigField
                  label="f'c (MPa)"
                  value={config.fc_mpa}
                  onChange={(v) => setConfig({ ...config, fc_mpa: v })}
                />
                <ConfigField
                  label="fy (MPa)"
                  value={config.fy_mpa}
                  onChange={(v) => setConfig({ ...config, fy_mpa: v })}
                />
                <ConfigField
                  label="Recubrimiento (mm)"
                  value={config.cover_mm}
                  onChange={(v) => setConfig({ ...config, cover_mm: v })}
                />
                <ConfigField
                  label="ρ long objetivo"
                  value={config.rho_long_target}
                  step={0.005}
                  onChange={(v) => setConfig({ ...config, rho_long_target: v })}
                />
                <ConfigField
                  label="Área aferente (m²)"
                  value={config.tributary_area_m2}
                  onChange={(v) => setConfig({ ...config, tributary_area_m2: v })}
                />
                <ConfigField
                  label="Niveles encima"
                  value={config.levels_above}
                  step={1}
                  onChange={(v) => setConfig({ ...config, levels_above: v })}
                />
                <ConfigField
                  label="CM losa (kN/m²)"
                  value={config.dead_slab_kN_m2}
                  onChange={(v) => setConfig({ ...config, dead_slab_kN_m2: v })}
                />
                <ConfigField
                  label="CV (kN/m²)"
                  value={config.live_kN_m2}
                  onChange={(v) => setConfig({ ...config, live_kN_m2: v })}
                />
                <div>
                  <Label htmlFor="col-duct-sel">Ductilidad</Label>
                  <Select
                    id="col-duct-sel"
                    value={config.ductility}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        ductility: e.target.value as ColumnDesignConfig['ductility'],
                      })
                    }
                    className="mt-1"
                  >
                    <option value="DMO">DMO</option>
                    <option value="DES">DES</option>
                    <option value="Ninguna">Ninguna</option>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {designs.length === 0 ? (
            <p className="text-cc-gray-500 text-sm">Sin diseños previos.</p>
          ) : (
            <ul className="space-y-2">
              {designs.map((d) => (
                <ColumnDesignItem key={d.id} design={d} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ConfigField({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div>
      <Label className="cc-label-mono">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="mt-1"
      />
    </div>
  )
}

function ColumnDesignItem({ design }: { design: ColumnDesign }) {
  const [expanded, setExpanded] = useState(false)
  const summary = (design.result_summary ?? null) as ColumnDesignSummary | null
  const canExpand = design.status.startsWith('completed') && summary !== null
  const dt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-CO', { hour12: false }) : '—'
  const durationMs =
    design.started_at && design.completed_at
      ? new Date(design.completed_at).getTime() - new Date(design.started_at).getTime()
      : null

  const statusVariant: 'success' | 'danger' | 'info' | 'warning' =
    design.status === 'completed'
      ? 'success'
      : design.status === 'failed'
        ? 'danger'
        : design.status === 'running' || design.status === 'pending'
          ? 'info'
          : 'warning'

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
              {durationMs !== null && ` · ${(durationMs / 1000).toFixed(2)}s`}
              {' · '}
              {design.element_ids.length} columnas · f'c {design.config.fc_mpa} MPa · ρ
              objetivo {design.config.rho_long_target}
            </p>
          </div>
          {canExpand && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar' : 'Ver resultados'}
            </Button>
          )}
        </div>

        {design.status === 'failed' && design.log && (
          <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs">
            {design.log}
          </pre>
        )}

        {expanded && summary && <ColumnSummaryView summary={summary} />}
      </CardContent>
    </Card>
  )
}

function ColumnSummaryView({ summary }: { summary: ColumnDesignSummary }) {
  return (
    <div className="mt-4 space-y-3 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
      <div className="grid gap-2 md:grid-cols-4">
        <Metric label="Columnas" value={summary.n_elements} />
        <Metric label="Sin warnings" value={`${summary.n_elements_ok}/${summary.n_elements}`} />
        <Metric label="ρ long promedio" value={summary.avg_rho_long.toFixed(3)} />
        <Metric label="Warnings total" value={summary.total_warnings} />
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border border-cc-gray-200 dark:border-cc-navy-700">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-cc-gray-50 text-cc-gray-500 dark:bg-cc-navy-800">
            <tr>
              <th className="px-2 py-2 text-left font-normal">Tag</th>
              <th className="px-2 py-2 text-left font-normal">Sección</th>
              <th className="px-2 py-2 text-right font-normal">H (m)</th>
              <th className="px-2 py-2 text-right font-normal">Pu (kN)</th>
              <th className="px-2 py-2 text-right font-normal">φPn_max</th>
              <th className="px-2 py-2 text-left font-normal">As long</th>
              <th className="px-2 py-2 text-right font-normal">ρ</th>
              <th className="px-2 py-2 text-left font-normal">Estribos</th>
              <th className="px-2 py-2 text-right font-normal">Bresler</th>
              <th className="px-2 py-2 text-center font-normal">Chk</th>
            </tr>
          </thead>
          <tbody>
            {summary.elements.map((e) => (
              <tr
                key={e.element_id}
                className="border-cc-gray-100 border-t dark:border-cc-navy-800"
              >
                <td className="px-2 py-1 font-mono">{e.tag}</td>
                <td className="px-2 py-1 text-cc-gray-500">{e.section_name ?? '—'}</td>
                <td className="px-2 py-1 text-right">{e.geom?.length_m?.toFixed(2) ?? '—'}</td>
                <td className="px-2 py-1 text-right">{e.demands?.Pu_kN?.toFixed(1) ?? '—'}</td>
                <td className="px-2 py-1 text-right">{e.capacity?.phi_Pn_max_kN?.toFixed(1) ?? '—'}</td>
                <td className="px-2 py-1 font-mono">
                  {e.longitudinal ? `${e.longitudinal.n}${e.longitudinal.bar}` : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.longitudinal?.rho_prov?.toFixed(3) ?? '—'}
                </td>
                <td className="px-2 py-1 font-mono">
                  {e.shear
                    ? `E${e.shear.stirrup.bar} @${e.shear.stirrup.s_gen_cm}cm (conf ${e.shear.stirrup.s_conf_cm}cm × ${e.shear.stirrup.lo_cm}cm)`
                    : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.capacity?.bresler != null ? e.capacity.bresler.toFixed(2) : '—'}
                </td>
                <td className="px-2 py-1 text-center">
                  {e.ok ? (
                    <span className="text-cc-success-600">OK</span>
                  ) : (
                    <span className="text-cc-warn-600">!</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
