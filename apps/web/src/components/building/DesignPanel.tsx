'use client'

import {
  ApiError,
  type BeamDesign,
  type BeamDesignConfig,
  type GeomLevel,
  buildings as buildingsApi,
  designs as designsApi,
} from '@/lib/api'
import { Badge, Button, Card, CardContent, Input, Label } from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_CONFIG: BeamDesignConfig = {
  fc_mpa: 21,
  fy_mpa: 420,
  fys_mpa: 420,
  cover_mm: 40,
  ductility: 'DMO',
  live_load_kN_m2: 2.0,
  dead_extra_kN_m2: 1.5,
  tributary_width_m: 1.0,
}

type DesignElementResult = {
  element_id: string
  tag: string
  ok: boolean
  geom: { b_cm: number; h_cm: number; d_cm: number; length_m: number }
  section_name: string
  loads: { wu_kN_m: number; live_kN_m: number; dead_total_kN_m: number; self_weight_kN_m: number }
  demands: { mu_apoyo_kNm: number; mu_centro_kNm: number }
  capacity: {
    as_min_cm2: number
    as_max_cm2: number
    as_req_apoyo_cm2: number | null
    as_req_centro_cm2: number | null
    bar_apoyo: { bar: string; n: number; as_prov_cm2: number }
    bar_centro: { bar: string; n: number; as_prov_cm2: number }
    phi_mn_apoyo_kNm: number
    phi_mn_centro_kNm: number
  }
  shear?: {
    vu_support_kN: number
    vu_at_d_kN: number
    vc_kN: number
    phi_vc_kN: number
    needs_stirrups: boolean
    vs_req_kN: number
    stirrup: {
      bar: string
      av_cm2: number
      s_gen_cm: number
      s_conf_cm: number
      l_conf_cm: number
      phi_vn_kN: number
      ok: boolean
    }
  }
  warnings: string[]
  error?: string
}

type DesignSummary = {
  ok: boolean
  n_elements: number
  n_elements_ok: number
  total_warnings: number
  total_length_m: number
  total_as_top_cm2_avg: number
  total_as_bot_cm2_avg: number
  elements: DesignElementResult[]
}

export function DesignPanel({
  buildingId,
  revisionId,
}: {
  buildingId: string
  revisionId: string
}) {
  const [levels, setLevels] = useState<GeomLevel[]>([])
  const [designs, setDesigns] = useState<BeamDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [config, setConfig] = useState<BeamDesignConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)

  const load = useCallback(async () => {
    try {
      const [geom, ds] = await Promise.all([
        buildingsApi.getGeometry(buildingId, revisionId),
        designsApi.list(buildingId, revisionId),
      ])
      setLevels(geom.levels)
      setDesigns(ds)
      if (!selectedLevelId && geom.levels.length > 0) {
        // Preselecciona primer nivel con elementos
        const firstWithBeams = geom.levels.find((l) =>
          geom.elements.some((e) => e.kind === 'beam' && e.level_id === l.id),
        )
        if (firstWithBeams) setSelectedLevelId(firstWithBeams.id)
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

  // Polling automático mientras haya diseños en ejecución
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const active = designs.some((d) => d.status === 'pending' || d.status === 'running')
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
  }, [designs, load])

  async function onRunByLevel() {
    if (!selectedLevelId) {
      setError('Selecciona un nivel')
      return
    }
    setWorking(true)
    setError(null)
    try {
      await designsApi.createByLevel(buildingId, revisionId, selectedLevelId, config)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
            Diseño de vigas · NSR-10 (flexión simplificada)
          </p>
          <p className="text-cc-gray-500 text-xs">
            Asume carga distribuida equivalente (self-weight + extras) y Mu = wL²/10 (apoyo), wL²/14
            (centro). Sin análisis OpenSees por ahora.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-cc-gray-500 text-sm">Cargando niveles y diseños previos…</p>
      ) : (
        <>
          {/* Config + nivel */}
          <div className="rounded-md border border-cc-gray-200 bg-cc-gray-50 p-3 dark:border-cc-navy-700 dark:bg-cc-navy-800/50">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="level-sel">Nivel a diseñar</Label>
                <select
                  id="level-sel"
                  value={selectedLevelId}
                  onChange={(e) => setSelectedLevelId(e.target.value)}
                  className="mt-1 h-9 rounded-md border border-cc-gray-200 bg-white px-2 text-sm dark:border-cc-navy-700 dark:bg-cc-navy-900"
                >
                  <option value="">—</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} (elev {l.elevation.toFixed(2)} m)
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                variant={showConfig ? 'ghost' : 'secondary'}
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? 'Ocultar parámetros' : 'Parámetros de diseño'}
              </Button>
              <Button size="sm" variant="primary" onClick={onRunByLevel} loading={working}>
                Diseñar vigas del nivel
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
                  label="CV (kN/m²)"
                  value={config.live_load_kN_m2}
                  onChange={(v) => setConfig({ ...config, live_load_kN_m2: v })}
                />
                <ConfigField
                  label="CM extra (kN/m²)"
                  value={config.dead_extra_kN_m2}
                  onChange={(v) => setConfig({ ...config, dead_extra_kN_m2: v })}
                />
                <ConfigField
                  label="Ancho aferente (m)"
                  value={config.tributary_width_m}
                  onChange={(v) => setConfig({ ...config, tributary_width_m: v })}
                />
                <div>
                  <Label htmlFor="duct-sel">Ductilidad</Label>
                  <select
                    id="duct-sel"
                    value={config.ductility}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        ductility: e.target.value as BeamDesignConfig['ductility'],
                      })
                    }
                    className="mt-1 h-9 w-full rounded-md border border-cc-gray-200 bg-white px-2 text-sm dark:border-cc-navy-700 dark:bg-cc-navy-900"
                  >
                    <option value="DMO">DMO</option>
                    <option value="DES">DES</option>
                    <option value="Ninguna">Ninguna</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Lista de diseños */}
          {designs.length === 0 ? (
            <p className="text-cc-gray-500 text-sm">Sin diseños previos.</p>
          ) : (
            <ul className="space-y-2">
              {designs.map((d) => (
                <DesignItem key={d.id} design={d} />
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
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
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

function DesignItem({ design }: { design: BeamDesign }) {
  const [expanded, setExpanded] = useState(false)
  const summary = (design.result_summary ?? null) as DesignSummary | null
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
          : 'warning' // completed_with_warnings

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
              {design.element_ids.length} vigas · f'c {design.config.fc_mpa} MPa · fy{' '}
              {design.config.fy_mpa} MPa
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

        {expanded && summary && <DesignSummaryView summary={summary} />}
      </CardContent>
    </Card>
  )
}

function DesignSummaryView({ summary }: { summary: DesignSummary }) {
  return (
    <div className="mt-4 space-y-3 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
      <div className="grid gap-2 md:grid-cols-4">
        <Metric label="Vigas" value={summary.n_elements} />
        <Metric label="Sin warnings" value={`${summary.n_elements_ok}/${summary.n_elements}`} />
        <Metric label="Longitud total" value={`${summary.total_length_m.toFixed(1)} m`} />
        <Metric label="Warnings total" value={summary.total_warnings} />
        <Metric label="As apoyo (prom)" value={`${summary.total_as_top_cm2_avg.toFixed(2)} cm²`} />
        <Metric label="As centro (prom)" value={`${summary.total_as_bot_cm2_avg.toFixed(2)} cm²`} />
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border border-cc-gray-200 dark:border-cc-navy-700">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-cc-gray-50 text-cc-gray-500 dark:bg-cc-navy-800">
            <tr>
              <th className="px-2 py-2 text-left font-normal">Tag</th>
              <th className="px-2 py-2 text-left font-normal">Sección</th>
              <th className="px-2 py-2 text-right font-normal">L (m)</th>
              <th className="px-2 py-2 text-right font-normal">wu (kN/m)</th>
              <th className="px-2 py-2 text-right font-normal">Mu⁻ (kNm)</th>
              <th className="px-2 py-2 text-left font-normal">Barra apoyo</th>
              <th className="px-2 py-2 text-right font-normal">φMn⁻ (kNm)</th>
              <th className="px-2 py-2 text-left font-normal">Barra centro</th>
              <th className="px-2 py-2 text-right font-normal">φMn+ (kNm)</th>
              <th className="px-2 py-2 text-right font-normal">Vu (kN)</th>
              <th className="px-2 py-2 text-left font-normal">Estribos</th>
              <th className="px-2 py-2 text-right font-normal">φVn (kN)</th>
              <th className="px-2 py-2 text-center font-normal">Check</th>
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
                <td className="px-2 py-1 text-right">{e.loads?.wu_kN_m?.toFixed(2) ?? '—'}</td>
                <td className="px-2 py-1 text-right">
                  {e.demands?.mu_apoyo_kNm?.toFixed(2) ?? '—'}
                </td>
                <td className="px-2 py-1 font-mono">
                  {e.capacity ? `${e.capacity.bar_apoyo.n}${e.capacity.bar_apoyo.bar}` : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.capacity?.phi_mn_apoyo_kNm?.toFixed(2) ?? '—'}
                </td>
                <td className="px-2 py-1 font-mono">
                  {e.capacity ? `${e.capacity.bar_centro.n}${e.capacity.bar_centro.bar}` : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.capacity?.phi_mn_centro_kNm?.toFixed(2) ?? '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.shear?.vu_at_d_kN?.toFixed(2) ?? '—'}
                </td>
                <td className="px-2 py-1 font-mono">
                  {e.shear
                    ? e.shear.needs_stirrups
                      ? `E${e.shear.stirrup.bar} @ ${e.shear.stirrup.s_gen_cm}cm (conf ${e.shear.stirrup.s_conf_cm}cm × ${e.shear.stirrup.l_conf_cm}cm)`
                      : `E${e.shear.stirrup.bar} min`
                    : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  {e.shear?.stirrup?.phi_vn_kN?.toFixed(2) ?? '—'}
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
