'use client'

import {
  type BeamLayout,
  BeamElevationView,
  CrossSection,
} from '@/components/building/BeamElevationView'
import { BeamPlanView } from '@/components/building/BeamPlanView'
import {
  ApiError,
  type BeamDesign,
  type BeamDesignConfig,
  type BeamGroupPublic,
  type ForcesSummary,
  type GeomLevel,
  buildings as buildingsApi,
  designs as designsApi,
} from '@/lib/api'
import { Badge, Button, Card, CardContent, Input, Label, Select } from '@civilcode/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

type ShearStirrup = {
  bar: string
  av_cm2: number
  s_gen_cm: number
  s_conf_cm: number
  l_conf_cm: number
  phi_vn_kN: number
  ok: boolean
}

type ShearResult = {
  vu_support_kN: number
  vu_at_d_kN: number
  vc_kN: number
  phi_vc_kN: number
  needs_stirrups: boolean
  vs_req_kN: number
  stirrup: ShearStirrup
  mpr_kNm?: number
  v_cap_mpr_kN?: number
}

type EnvelopeSeries = {
  stations_m: number[]
  m_pos_kNm: number[]
  m_neg_kNm: number[]
  v_abs_kN: number[]
}

type DesignElementResult = {
  element_id: string
  tag: string
  ok: boolean
  source?: 'envelope' | 'estimated_wl2_10'
  geom: { b_cm: number; h_cm: number; d_cm: number; length_m: number }
  section_name: string
  loads?: { wu_kN_m: number; live_kN_m: number; dead_total_kN_m: number; self_weight_kN_m: number }
  demands: {
    mu_apoyo_kNm?: number
    mu_centro_kNm?: number
    mu_neg_left_kNm?: number
    mu_neg_right_kNm?: number
    mu_pos_center_kNm?: number
    vu_vc_kN?: number | null
    vu_vcap_kN?: number | null
    vu_mpr_kN?: number | null
  }
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
  shear?:
    | ShearResult
    | {
        governing: 'vc' | 'vcap' | 'mpr'
        vc: ShearResult
        vcap: ShearResult | null
        mpr: ShearResult | null
      }
  diagrams?: {
    flex: EnvelopeSeries
    shear_vc: EnvelopeSeries
    shear_vcap: EnvelopeSeries | null
  }
  combos?: {
    flex: string[]
    shear_vc: string[]
    shear_vcap: string[] | null
  }
  warnings: string[]
  error?: string
}

type SpanResult = {
  span_index: number
  element_id: string
  tag: string
  offset_m: number
  length_m: number
  flipped: boolean
  mu_neg_left_kNm: number
  mu_neg_right_kNm: number
  mu_pos_center_kNm: number
  mu_apoyo_kNm: number
  as_req_apoyo_cm2: number | null
  as_req_centro_cm2: number | null
  bar_apoyo: { bar: string; n: number; as_prov_cm2: number }
  bar_centro: { bar: string; n: number; as_prov_cm2: number }
  phi_mn_apoyo_kNm: number
  phi_mn_centro_kNm: number
  shear: {
    governing: 'vc' | 'vcap' | 'mpr'
    vc: ShearResult
    vcap: ShearResult | null
    mpr: ShearResult | null
  }
  warnings: string[]
}

type GroupResult = {
  group_id: string
  ok: boolean
  error?: string
  level_id: string | null
  origin?: [number, number, number]
  direction?: [number, number, number]
  total_length_m: number
  n_spans: number
  supports_m?: number[]
  section?: { b_cm: number; h_cm: number; d_cm: number }
  capacity_envelope?: {
    as_top_max_cm2: number
    as_bot_max_cm2: number
    continuous_top_proposal: { bar: string; n: number; as_prov_cm2: number }
    continuous_bot_proposal: { bar: string; n: number; as_prov_cm2: number }
    as_min_cm2: number
    as_max_cm2: number
  }
  spans: SpanResult[]
  diagrams?: {
    stations_m: number[]
    m_pos_kNm: number[]
    m_neg_kNm: number[]
    v_abs_kN_vc: number[]
    stations_m_vc: number[]
    v_abs_kN_vcap: number[] | null
    stations_m_vcap: number[] | null
    supports_m: number[]
  }
  layout?: BeamLayout
  warnings: string[]
}

type DesignSummary = {
  ok: boolean
  source_mode?: 'envelope' | 'estimated_wl2_10' | 'mixed'
  n_elements: number
  n_elements_ok: number
  n_groups?: number
  n_groups_ok?: number
  n_spans?: number
  total_warnings: number
  total_length_m: number
  total_as_top_cm2_avg: number
  total_as_bot_cm2_avg: number
  elements?: DesignElementResult[]
  groups?: GroupResult[]
}

function isEnvelopeShear(
  s: DesignElementResult['shear'],
): s is {
  governing: 'vc' | 'vcap' | 'mpr'
  vc: ShearResult
  vcap: ShearResult | null
  mpr: ShearResult | null
} {
  return !!s && 'governing' in s
}

function flatShear(s: DesignElementResult['shear']): ShearResult | null {
  if (!s) return null
  if (isEnvelopeShear(s)) {
    if (s.governing === 'vcap' && s.vcap) return s.vcap
    if (s.governing === 'mpr' && s.mpr) return s.mpr
    return s.vc
  }
  return s
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
  const [forces, setForces] = useState<ForcesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string>('')
  const [config, setConfig] = useState<BeamDesignConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)
  const [useForces, setUseForces] = useState(true)
  const [comboFlex, setComboFlex] = useState<string[]>([])
  const [comboShearVc, setComboShearVc] = useState<string[]>([])
  const [comboShearVcap, setComboShearVcap] = useState<string[]>([])
  const [beamGroups, setBeamGroups] = useState<BeamGroupPublic[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const [geom, ds, fs] = await Promise.all([
        buildingsApi.getGeometry(buildingId, revisionId),
        designsApi.list(buildingId, revisionId),
        buildingsApi.getForcesSummary(buildingId, revisionId).catch(() => null),
      ])
      setLevels(geom.levels)
      setDesigns(ds)
      setForces(fs)
      if (!selectedLevelId && geom.levels.length > 0) {
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

  // Pre-selecciona combos cuando se cargan: busca por palabras clave en español/inglés.
  useEffect(() => {
    if (!forces || forces.status !== 'loaded' || forces.load_cases.length === 0) return
    if (comboFlex.length === 0 && comboShearVc.length === 0 && comboShearVcap.length === 0) {
      const cases = forces.load_cases
      // Flexión: nombres con "flex" o "envolventeflex" o "max"/"min"
      const flexHits = cases.filter((c) => /flex|flexi|envolventeflex/i.test(c))
      // Cortante amplificado: nombres con "cort", "shear", "cap", "omega", "Ω"
      const shearCapHits = cases.filter((c) =>
        /cort|shear|cap|omega|Ω|sismo.*amp|amp.*sismo/i.test(c),
      )
      // Gravitacional: contiene "cv"/"d"/"l"/"cm" y NO contiene "env" ni "sismo"
      const gravHits = cases.filter(
        (c) =>
          /(\b|_)(cm|cv|dl|ll|d\+l|cv\+cm|cm\+cv|service|gravit)/i.test(c) &&
          !/env|sismo|seism|cort|shear/i.test(c),
      )
      // Fallbacks
      setComboFlex(flexHits.length ? flexHits : cases.filter((c) => /env|max|min/i.test(c)))
      setComboShearVcap(shearCapHits.filter((c) => !flexHits.includes(c)))
      setComboShearVc(
        gravHits.length
          ? gravHits
          : cases.filter((c) => !flexHits.includes(c) && !shearCapHits.includes(c)),
      )
    }
  }, [forces, comboFlex.length, comboShearVc.length, comboShearVcap.length])

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

  const forcesReady = forces?.status === 'loaded' && forces.load_cases.length > 0
  const useForcesEffective = useForces && forcesReady

  // Detecta vigas continuas cuando cambia el nivel
  const loadGroups = useCallback(async () => {
    if (!selectedLevelId) {
      setBeamGroups([])
      setSelectedGroupIds(new Set())
      return
    }
    setLoadingGroups(true)
    try {
      const resp = await buildingsApi.getBeamGroups(buildingId, revisionId, selectedLevelId)
      setBeamGroups(resp.groups)
      // Default: todas las vigas seleccionadas
      setSelectedGroupIds(new Set(resp.groups.map((g) => g.id)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoadingGroups(false)
    }
  }, [buildingId, revisionId, selectedLevelId])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const toggleGroup = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const selectAll = () => setSelectedGroupIds(new Set(beamGroups.map((g) => g.id)))
  const selectNone = () => setSelectedGroupIds(new Set())

  // IDs de elementos de las vigas seleccionadas (expande cada grupo a sus spans)
  const selectedElementIds = useMemo(() => {
    const ids: string[] = []
    for (const g of beamGroups) {
      if (!selectedGroupIds.has(g.id)) continue
      for (const sp of g.spans) ids.push(sp.element_id)
    }
    return ids
  }, [beamGroups, selectedGroupIds])

  async function onRunByLevel() {
    if (!selectedLevelId) {
      setError('Selecciona un nivel')
      return
    }
    if (selectedElementIds.length === 0) {
      setError('Selecciona al menos una viga en la vista en planta')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const cfg: BeamDesignConfig & {
        use_forces?: boolean
        combo_flex?: string[]
        combo_shear_vc?: string[]
        combo_shear_vcap?: string[]
      } = { ...config }
      if (useForcesEffective) {
        cfg.use_forces = true
        cfg.combo_flex = comboFlex
        cfg.combo_shear_vc = comboShearVc.length ? comboShearVc : comboFlex
        cfg.combo_shear_vcap = comboShearVcap
      }
      // Diseño sobre los elementos seleccionados (subconjunto del nivel)
      const levelName = levels.find((l) => l.id === selectedLevelId)?.name ?? 'nivel'
      const designName = `${levelName} · ${selectedGroupIds.size} viga${
        selectedGroupIds.size !== 1 ? 's' : ''
      }`
      await designsApi.create(buildingId, revisionId, designName, selectedElementIds, cfg)
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
            Diseño de vigas · NSR-10
          </p>
          <p className="text-cc-gray-500 text-xs">
            {forcesReady
              ? 'Usando envolvente ETABS para flexión y cortante (Vc gravitacional + Vcap con Ω·E o Mpr).'
              : 'Modo simplificado: wu·L²/10 (apoyo), wu·L²/14 (centro). Carga el XLSX de demandas para diseñar con envolvente real.'}
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
              <div className="min-w-[14rem]">
                <Label htmlFor="level-sel">Nivel a diseñar</Label>
                <Select
                  id="level-sel"
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
                {useForcesEffective ? 'Diseñar con demandas reales' : 'Diseñar vigas del nivel'}
              </Button>
            </div>

            {/* Toggle demandas reales + selección de combinaciones */}
            {forcesReady && (
              <div className="mt-3 rounded-md border border-cc-cyan-500/30 bg-cc-cyan-500/5 p-3 dark:border-cc-cyan-500/40 dark:bg-cc-cyan-500/10">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-cc-gray-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={useForces}
                      onChange={(e) => setUseForces(e.target.checked)}
                      className="h-4 w-4 accent-cc-cyan-500"
                    />
                    Usar demandas reales de ETABS
                  </label>
                  <span className="cc-label-mono text-[10px]">
                    {forces?.n_records} registros · {forces?.load_cases.length} combos
                  </span>
                </div>
                {useForces && (
                  <>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <ComboMultiSelect
                        label="Flexión · envolvente"
                        hint="Max/Min de combinaciones de diseño"
                        options={forces!.load_cases}
                        selected={comboFlex}
                        onChange={setComboFlex}
                      />
                      <ComboMultiSelect
                        label="Cortante Vu (gravitacional)"
                        hint="1.2D+1.6L, etc."
                        options={forces!.load_cases}
                        selected={comboShearVc}
                        onChange={setComboShearVc}
                      />
                      <ComboMultiSelect
                        label="Cortante Vu (Ω × sismo)"
                        hint="1.2D+1.0L±2.0E (amplificado)"
                        options={forces!.load_cases}
                        selected={comboShearVcap}
                        onChange={setComboShearVcap}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5 dark:bg-cc-navy-900">
                      <div className="text-xs">
                        <p className="font-medium text-cc-gray-900 dark:text-white">
                          Nivel:{' '}
                          <span className="font-mono">
                            {levels.find((l) => l.id === selectedLevelId)?.name ?? '—'}
                          </span>
                          {' · '}
                          Flex:{' '}
                          <span className="font-mono text-cc-cyan-600 dark:text-cc-cyan-400">
                            {comboFlex.length} combo{comboFlex.length !== 1 ? 's' : ''}
                          </span>
                          {' · '}
                          Vc:{' '}
                          <span className="font-mono">{comboShearVc.length}</span>
                          {' · '}
                          Vcap:{' '}
                          <span className="font-mono">{comboShearVcap.length}</span>
                        </p>
                        {!selectedLevelId && (
                          <p className="mt-0.5 text-cc-warn-600">
                            ⚠ Selecciona un nivel arriba para habilitar el diseño
                          </p>
                        )}
                        {selectedLevelId && comboFlex.length === 0 && (
                          <p className="mt-0.5 text-cc-warn-600">
                            ⚠ Selecciona al menos un combo de flexión
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={onRunByLevel}
                        disabled={working || !selectedLevelId || comboFlex.length === 0}
                        className="cc-cta-blue !py-2.5 !px-5"
                      >
                        {working ? (
                          <>
                            <svg
                              className="h-4 w-4 animate-spin"
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
                            Diseñando…
                          </>
                        ) : (
                          <>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                              aria-hidden
                            >
                              <path
                                d="M3 8l3 3 7-7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Diseñar vigas del nivel
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!forcesReady && (
              <p className="mt-2 text-cc-gray-500 text-xs">
                💡 Carga un XLSX de demandas (botón arriba) para diseñar con envolvente real. Sin
                demandas se usa la estimación simplificada wu·L²/10.
              </p>
            )}
          </div>

          {/* Vista en planta: detección automática + selección interactiva */}
          {selectedLevelId && (
            <div className="rounded-md border border-cc-gray-200 bg-white p-3 dark:border-cc-navy-700 dark:bg-cc-navy-900">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
                    Vista en planta ·{' '}
                    {levels.find((l) => l.id === selectedLevelId)?.name ?? ''}
                  </p>
                  <p className="text-cc-gray-500 text-xs">
                    {loadingGroups
                      ? 'Detectando vigas continuas…'
                      : beamGroups.length === 0
                        ? 'Sin vigas en este nivel'
                        : `${beamGroups.length} vigas continuas detectadas · click en una viga para seleccionar/deseleccionar · ${selectedGroupIds.size} seleccionadas`}
                  </p>
                </div>
                {beamGroups.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded border border-cc-gray-200 px-2 py-1 font-medium text-cc-gray-700 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={selectNone}
                      className="rounded border border-cc-gray-200 px-2 py-1 font-medium text-cc-gray-700 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
                    >
                      Ninguna
                    </button>
                  </div>
                )}
              </div>
              {loadingGroups ? (
                <div className="flex h-48 items-center justify-center text-cc-gray-500 text-sm">
                  Agrupando…
                </div>
              ) : beamGroups.length > 0 ? (
                <BeamPlanView
                  groups={beamGroups}
                  selectedIds={selectedGroupIds}
                  onToggle={toggleGroup}
                />
              ) : null}
              {beamGroups.length > 0 && (
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-cc-gray-500">
                    <span
                      className="inline-block h-0.5 w-5"
                      style={{ background: '#0ea5e9' }}
                    />
                    Seleccionada
                  </span>
                  <span className="inline-flex items-center gap-1 text-cc-gray-500">
                    <span
                      className="inline-block h-0.5 w-5"
                      style={{ background: '#94a3b8' }}
                    />
                    No seleccionada
                  </span>
                  <span className="inline-flex items-center gap-1 text-cc-gray-500">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 bg-cc-warn-500"
                      style={{ background: '#f59e0b' }}
                    />
                    Apoyo entre tramos
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Parámetros de diseño (card independiente cuando se expande) */}
          {showConfig && (
            <div className="rounded-md border border-cc-gray-200 bg-cc-gray-50 p-3 dark:border-cc-navy-700 dark:bg-cc-navy-800/50">
              <p className="mb-2 cc-label-mono text-[10px]">Parámetros de diseño</p>
              <div className="grid gap-3 md:grid-cols-4">
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
                  <Select
                    id="duct-sel"
                    value={config.ductility}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        ductility: e.target.value as BeamDesignConfig['ductility'],
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
            </div>
          )}

          {/* Lista de diseños */}
          {designs.length === 0 ? (
            <div className="rounded-md border border-cc-gray-200 border-dashed bg-cc-gray-50 p-6 text-center dark:border-cc-navy-700 dark:bg-cc-navy-800/40">
              <p className="text-cc-gray-500 text-sm">
                Aún no has corrido un diseño para esta revisión.
              </p>
              <p className="mt-1 text-cc-gray-400 text-xs">
                Selecciona nivel + combos y presiona <strong>Diseñar vigas del nivel</strong>.
                Los resultados aparecerán aquí.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-2 cc-label-mono text-[10px]">
                Diseños ({designs.length}) · click para expandir
              </p>
              <ul className="space-y-2">
                {designs.map((d) => (
                  <DesignItem key={d.id} design={d} />
                ))}
              </ul>
            </div>
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
      <Label className="cc-label-mono">{label}</Label>
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
          <div className="flex gap-2">
            {canExpand && (
              <a
                href={designsApi.dxfUrl(design.id)}
                className="inline-flex h-7 items-center rounded-md border border-cc-gray-200 px-3 text-xs font-medium text-cc-gray-700 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-cc-gray-200 dark:hover:bg-cc-navy-800"
              >
                DXF
              </a>
            )}
            {canExpand && (
              <a
                href={designsApi.pdfUrl(design.id)}
                className="inline-flex h-7 items-center rounded-md border border-cc-gray-200 px-3 text-xs font-medium text-cc-gray-700 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-cc-gray-200 dark:hover:bg-cc-navy-800"
              >
                PDF
              </a>
            )}
            {canExpand && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Ocultar' : 'Ver resultados'}
              </Button>
            )}
          </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const envelopeMode = summary.source_mode === 'envelope' || summary.source_mode === 'mixed'
  const hasGroups = (summary.groups?.length ?? 0) > 0

  return (
    <div className="mt-4 space-y-3 border-cc-gray-200 border-t pt-4 dark:border-cc-navy-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={envelopeMode ? 'success' : 'neutral'}>
            {hasGroups
              ? 'Envolvente ETABS · vigas continuas'
              : summary.source_mode === 'envelope'
                ? 'Envolvente ETABS'
                : summary.source_mode === 'mixed'
                  ? 'Mixto (envolvente + estimación)'
                  : 'Estimación wu·L²/10'}
          </Badge>
        </div>
      </div>

      {hasGroups ? (
        <div className="grid gap-2 md:grid-cols-4">
          <Metric label="Vigas continuas" value={summary.n_groups ?? 0} />
          <Metric
            label="Sin warnings"
            value={`${summary.n_groups_ok ?? 0}/${summary.n_groups ?? 0}`}
          />
          <Metric label="Tramos totales" value={summary.n_spans ?? 0} />
          <Metric label="Longitud total" value={`${summary.total_length_m.toFixed(1)} m`} />
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-4">
          <Metric label="Vigas" value={summary.n_elements} />
          <Metric
            label="Sin warnings"
            value={`${summary.n_elements_ok}/${summary.n_elements}`}
          />
          <Metric label="Longitud total" value={`${summary.total_length_m.toFixed(1)} m`} />
          <Metric label="Warnings total" value={summary.total_warnings} />
        </div>
      )}

      {hasGroups ? (
        <div className="space-y-2">
          <p className="cc-label-mono text-[10px]">
            Vigas continuas · click para ver diagramas y despiece
          </p>
          {summary.groups!.map((g) => (
            <BeamGroupCard
              key={g.group_id}
              group={g}
              expanded={expandedId === g.group_id}
              onToggle={() => setExpandedId(expandedId === g.group_id ? null : g.group_id)}
            />
          ))}
        </div>
      ) : envelopeMode && summary.elements ? (
        <div className="space-y-2">
          <p className="cc-label-mono text-[10px]">Vigas · click para ver diagramas</p>
          {summary.elements.map((e) => (
            <BeamResultCard
              key={e.element_id}
              result={e}
              expanded={expandedId === e.element_id}
              onToggle={() =>
                setExpandedId(expandedId === e.element_id ? null : e.element_id)
              }
            />
          ))}
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-md border border-cc-gray-200 dark:border-cc-navy-700">
          <SimpleBeamTable elements={summary.elements ?? []} />
        </div>
      )}
    </div>
  )
}

function BeamGroupCard({
  group,
  expanded,
  onToggle,
}: {
  group: GroupResult
  expanded: boolean
  onToggle: () => void
}) {
  const sec = group.section
  const env = group.capacity_envelope
  const topBar = env?.continuous_top_proposal
  const botBar = env?.continuous_bot_proposal
  // Resumen de la worst zone a cortante
  const worstShear = group.spans.reduce<SpanResult | null>((acc, s) => {
    if (!s.shear) return acc
    if (!acc) return s
    const sv = flatShear(s.shear)?.vu_support_kN ?? 0
    const av = flatShear(acc.shear)?.vu_support_kN ?? 0
    return sv > av ? s : acc
  }, null)
  const worstSh = worstShear ? flatShear(worstShear.shear) : null
  const gov = worstShear?.shear?.governing ?? null

  return (
    <div className="rounded-md border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cc-gray-50 dark:hover:bg-cc-navy-800/50"
      >
        <span className="font-mono font-semibold text-cc-cyan-700 text-sm dark:text-cc-cyan-400">
          {group.group_id}
        </span>
        <span className="text-cc-gray-900 text-sm dark:text-white">
          {group.n_spans} tramo{group.n_spans !== 1 ? 's' : ''} · {group.total_length_m.toFixed(2)} m
        </span>
        {sec && (
          <span className="rounded border border-cc-gray-200 bg-cc-gray-50 px-1.5 py-0.5 font-mono text-cc-gray-700 text-xs dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
            {sec.b_cm.toFixed(0)}×{sec.h_cm.toFixed(0)} cm
          </span>
        )}
        {topBar && (
          <span className="rounded border border-cc-blue-500/40 bg-cc-blue-500/10 px-1.5 py-0.5 font-mono text-cc-blue-700 text-xs dark:text-cc-blue-400">
            top {topBar.n}{topBar.bar}
          </span>
        )}
        {botBar && (
          <span className="rounded border border-cc-cyan-500/40 bg-cc-cyan-500/10 px-1.5 py-0.5 font-mono text-cc-cyan-700 text-xs dark:text-cc-cyan-400">
            bot {botBar.n}{botBar.bar}
          </span>
        )}
        {worstSh && (
          <span className="rounded border border-cc-gray-200 bg-cc-gray-50 px-1.5 py-0.5 font-mono text-cc-gray-700 text-xs dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
            E{worstSh.stirrup.bar} @ {worstSh.stirrup.s_gen_cm}cm
            {gov && <span className="ml-1 text-cc-warn-600">({gov})</span>}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs">
          {group.ok ? (
            <Badge variant="success">OK</Badge>
          ) : (
            <Badge variant="warning">{group.warnings.length}</Badge>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="border-cc-gray-200 border-t px-3 py-3 dark:border-cc-navy-700">
          {group.error ? (
            <p className="rounded-md bg-cc-warn-100/50 px-3 py-2 text-cc-warn-600 text-xs">
              {group.error}
            </p>
          ) : (
            <>
              {group.diagrams && (
                <GroupEnvelopeChart diagrams={group.diagrams} length_m={group.total_length_m} />
              )}
              {env && (
                <div className="mt-3 rounded-md border border-cc-cyan-500/30 bg-cc-cyan-500/5 p-3 dark:border-cc-cyan-500/40 dark:bg-cc-cyan-500/10">
                  <p className="cc-label-mono text-[10px]">Refuerzo corrido propuesto</p>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-xs">
                    <span>
                      Superior (top){' '}
                      <span className="font-mono font-bold text-cc-blue-700 dark:text-cc-blue-400">
                        {env.continuous_top_proposal.n}
                        {env.continuous_top_proposal.bar}
                      </span>{' '}
                      ({env.continuous_top_proposal.as_prov_cm2.toFixed(2)} cm²)
                    </span>
                    <span>
                      Inferior (bot){' '}
                      <span className="font-mono font-bold text-cc-cyan-700 dark:text-cc-cyan-400">
                        {env.continuous_bot_proposal.n}
                        {env.continuous_bot_proposal.bar}
                      </span>{' '}
                      ({env.continuous_bot_proposal.as_prov_cm2.toFixed(2)} cm²)
                    </span>
                    <span className="text-cc-gray-500">
                      As mín: {env.as_min_cm2.toFixed(2)} cm²
                    </span>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <p className="mb-2 cc-label-mono text-[10px]">
                  Despiece por tramo ({group.spans.length})
                </p>
                <div className="overflow-x-auto rounded-md border border-cc-gray-200 dark:border-cc-navy-700">
                  <table className="w-full text-xs">
                    <thead className="bg-cc-gray-50 text-cc-gray-500 dark:bg-cc-navy-800">
                      <tr>
                        <th className="px-2 py-2 text-left font-normal">T</th>
                        <th className="px-2 py-2 text-left font-normal">Tag</th>
                        <th className="px-2 py-2 text-right font-normal">x₀ (m)</th>
                        <th className="px-2 py-2 text-right font-normal">L (m)</th>
                        <th className="px-2 py-2 text-right font-normal">Mu⁻ (kNm)</th>
                        <th className="px-2 py-2 text-right font-normal">Mu⁺ (kNm)</th>
                        <th className="px-2 py-2 text-left font-normal">Top</th>
                        <th className="px-2 py-2 text-left font-normal">Bot</th>
                        <th className="px-2 py-2 text-right font-normal">Vu (kN)</th>
                        <th className="px-2 py-2 text-left font-normal">Estribos</th>
                        <th className="px-2 py-2 text-center font-normal">✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.spans.map((s) => {
                        const sh = flatShear(s.shear)
                        return (
                          <tr
                            key={s.span_index}
                            className="border-cc-gray-100 border-t dark:border-cc-navy-800"
                          >
                            <td className="px-2 py-1 font-mono">{s.span_index + 1}</td>
                            <td className="px-2 py-1 font-mono text-cc-gray-500">{s.tag}</td>
                            <td className="px-2 py-1 text-right">{s.offset_m.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">{s.length_m.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right">
                              {s.mu_apoyo_kNm.toFixed(1)}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {s.mu_pos_center_kNm.toFixed(1)}
                            </td>
                            <td className="px-2 py-1 font-mono">
                              {s.bar_apoyo.n}
                              {s.bar_apoyo.bar}
                            </td>
                            <td className="px-2 py-1 font-mono">
                              {s.bar_centro.n}
                              {s.bar_centro.bar}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {sh?.vu_support_kN?.toFixed(1) ?? '—'}
                              {s.shear?.governing && s.shear.governing !== 'vc' && (
                                <span className="ml-1 text-[10px] text-cc-warn-600">
                                  ({s.shear.governing})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 font-mono">
                              {sh
                                ? `${sh.stirrup.bar} @ ${sh.stirrup.s_gen_cm}cm / conf ${sh.stirrup.s_conf_cm}cm`
                                : '—'}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {s.warnings.length === 0 ? (
                                <span className="text-cc-success-600">✓</span>
                              ) : (
                                <span className="text-cc-warn-600" title={s.warnings.join(' / ')}>
                                  !
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Despiece longitudinal: alzado + secciones + resumen */}
              {group.layout && group.supports_m && (
                <BeamLayoutPanel
                  layout={group.layout}
                  supports_m={group.supports_m}
                  section={group.section}
                />
              )}

              {group.warnings.length > 0 && (
                <div className="mt-3 rounded-md border border-cc-warn-500/40 bg-cc-warn-100/50 p-2 text-cc-warn-600 text-xs dark:bg-cc-warn-500/10">
                  <p className="mb-1 font-semibold">Warnings del grupo</p>
                  <ul className="list-disc pl-4">
                    {group.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BeamLayoutPanel({
  layout,
  supports_m,
  section,
}: {
  layout: BeamLayout
  supports_m: number[]
  section?: { b_cm: number; h_cm: number; d_cm: number }
}) {
  // Secciones representativas: zona de apoyo intermedio y centro de vano más largo
  const b_cm = section?.b_cm ?? layout.section.b_cm
  const h_cm = section?.h_cm ?? layout.section.h_cm

  // Detectar as necesario en apoyo y centro mirando los runs
  const topContinuous = layout.continuous_top
  const botContinuous = layout.continuous_bot
  const topBastones = layout.runs.filter((r) => r.kind === 'baston_apoyo')
  const botBastones = layout.runs.filter((r) => r.kind === 'baston_vano')

  // Sección apoyo = continuo top + bastón
  const anyApoyoBaston = topBastones[0]
  const topApoyoCount = topContinuous.n_bars + (anyApoyoBaston?.n_bars ?? 0)
  const topApoyoBar = anyApoyoBaston?.bar ?? topContinuous.bar
  const botApoyoCount = botContinuous.n_bars // bot corrida en apoyo

  // Sección centro = continuo top + continuo bot + bastón vano
  const anyVanoBaston = botBastones[0]
  const botCentroCount = botContinuous.n_bars + (anyVanoBaston?.n_bars ?? 0)
  const botCentroBar = anyVanoBaston?.bar ?? botContinuous.bar

  return (
    <div className="mt-4 space-y-3 rounded-md border border-cc-cyan-500/30 bg-cc-cyan-500/5 p-3 dark:border-cc-cyan-500/40 dark:bg-cc-cyan-500/10">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-cc-cyan-700 text-sm dark:text-cc-cyan-400">
          Despiece longitudinal · NSR-10
        </p>
        <span className="rounded border border-cc-cyan-500/40 bg-white px-2 py-0.5 font-mono text-cc-cyan-700 text-xs dark:bg-cc-navy-900 dark:text-cc-cyan-400">
          {layout.total_steel_kg.toFixed(1)} kg acero
        </span>
      </div>

      {/* Alzado */}
      <BeamElevationView layout={layout} supports_m={supports_m} />

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-5 bg-cc-danger-500" />
          <span className="text-cc-gray-600 dark:text-cc-gray-300">Top</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-5" style={{ background: '#0ea5e9' }} />
          <span className="text-cc-gray-600 dark:text-cc-gray-300">Bot</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-cc-warn-500" />
          <span className="text-cc-gray-600 dark:text-cc-gray-300">Estribos confinados</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-3"
            style={{ background: 'rgba(100,116,139,0.6)' }}
          />
          <span className="text-cc-gray-600 dark:text-cc-gray-300">Estribos general</span>
        </span>
      </div>

      {/* Secciones transversales */}
      <div className="flex flex-wrap items-start justify-around gap-3 rounded border border-cc-gray-200 bg-white p-2 dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <CrossSection
          b_cm={b_cm}
          h_cm={h_cm}
          top_bar={topApoyoBar}
          top_count={topApoyoCount}
          bot_bar={botContinuous.bar}
          bot_count={botApoyoCount}
          label="Sección en apoyo"
        />
        <CrossSection
          b_cm={b_cm}
          h_cm={h_cm}
          top_bar={topContinuous.bar}
          top_count={topContinuous.n_bars}
          bot_bar={botCentroBar}
          bot_count={botCentroCount}
          label="Sección en centro"
        />
      </div>

      {/* Resumen de acero */}
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded border border-cc-gray-200 bg-white px-2 py-1.5 dark:border-cc-navy-700 dark:bg-cc-navy-900">
          <p className="cc-label-mono text-[10px]">Corrida top</p>
          <p className="font-mono text-cc-danger-600 dark:text-cc-danger-500">
            {layout.continuous_top.n_bars}
            {layout.continuous_top.bar} corrida
          </p>
        </div>
        <div className="rounded border border-cc-gray-200 bg-white px-2 py-1.5 dark:border-cc-navy-700 dark:bg-cc-navy-900">
          <p className="cc-label-mono text-[10px]">Corrida bot</p>
          <p className="font-mono text-cc-blue-600 dark:text-cc-blue-400">
            {layout.continuous_bot.n_bars}
            {layout.continuous_bot.bar} corrida
          </p>
        </div>
        <div className="rounded border border-cc-gray-200 bg-white px-2 py-1.5 dark:border-cc-navy-700 dark:bg-cc-navy-900">
          <p className="cc-label-mono text-[10px]">Ductilidad</p>
          <p className="font-mono text-cc-gray-900 dark:text-white">{layout.ductility}</p>
        </div>
      </div>

      {/* Tabla de piezas */}
      <details>
        <summary className="cursor-pointer text-cc-gray-600 text-xs hover:text-cc-gray-900 dark:text-cc-gray-400 dark:hover:text-white">
          Ver despiece detallado ({layout.runs.length} corridas + bastones, {layout.commercial_pieces.length} piezas)
        </summary>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 cc-label-mono text-[10px]">Barras</p>
            <div className="overflow-x-auto rounded border border-cc-gray-200 dark:border-cc-navy-700">
              <table className="w-full text-[11px]">
                <thead className="bg-cc-gray-50 text-cc-gray-500 dark:bg-cc-navy-800">
                  <tr>
                    <th className="px-2 py-1 text-left font-normal">Capa</th>
                    <th className="px-2 py-1 text-left font-normal">Tipo</th>
                    <th className="px-2 py-1 text-left font-normal">Barra</th>
                    <th className="px-2 py-1 text-right font-normal">x₀ (m)</th>
                    <th className="px-2 py-1 text-right font-normal">L (m)</th>
                    <th className="px-2 py-1 text-right font-normal">Gancho</th>
                  </tr>
                </thead>
                <tbody>
                  {layout.runs.map((r, i) => (
                    <tr key={i} className="border-cc-gray-100 border-t dark:border-cc-navy-800">
                      <td className="px-2 py-1 font-mono">{r.layer}</td>
                      <td className="px-2 py-1 text-cc-gray-500">
                        {r.kind === 'continuous'
                          ? 'corrida'
                          : r.kind === 'baston_apoyo'
                            ? 'bastón apoyo'
                            : 'bastón vano'}
                      </td>
                      <td className="px-2 py-1 font-mono">
                        {r.n_bars}
                        {r.bar}
                      </td>
                      <td className="px-2 py-1 text-right">{r.start_m.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{r.length_m.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right font-mono text-[10px]">
                        {r.hook_left_mm > 0 ? '└' : ' '}
                        {r.hook_right_mm > 0 ? '┘' : ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-1 cc-label-mono text-[10px]">Piezas comerciales (9m)</p>
            <div className="overflow-x-auto rounded border border-cc-gray-200 dark:border-cc-navy-700">
              <table className="w-full text-[11px]">
                <thead className="bg-cc-gray-50 text-cc-gray-500 dark:bg-cc-navy-800">
                  <tr>
                    <th className="px-2 py-1 text-left font-normal">Capa</th>
                    <th className="px-2 py-1 text-left font-normal">Barra</th>
                    <th className="px-2 py-1 text-right font-normal">x₀ (m)</th>
                    <th className="px-2 py-1 text-right font-normal">L (m)</th>
                    <th className="px-2 py-1 text-center font-normal">Empalme</th>
                  </tr>
                </thead>
                <tbody>
                  {layout.commercial_pieces.map((p, i) => (
                    <tr key={i} className="border-cc-gray-100 border-t dark:border-cc-navy-800">
                      <td className="px-2 py-1 font-mono">{p.layer}</td>
                      <td className="px-2 py-1 font-mono">{p.bar}</td>
                      <td className="px-2 py-1 text-right">{p.start_m.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right font-mono">
                        {p.piece_length_m.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {p.splice_right ? (
                          <span className="text-cc-warn-600">⟷</span>
                        ) : (
                          <span className="text-cc-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-cc-gray-100 border-t px-2 py-1 text-[10px] text-cc-gray-500 dark:border-cc-navy-800">
                ld top {(layout.ld_top_mm / 10).toFixed(0)} cm · traslapo B {(layout.lap_class_B_top_mm / 10).toFixed(0)} cm · gancho{' '}
                {(layout.hook_length_top_mm / 10).toFixed(0)} cm
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}

function GroupEnvelopeChart({
  diagrams,
  length_m,
}: {
  diagrams: NonNullable<GroupResult['diagrams']>
  length_m: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // @ts-expect-error
    if (window.Plotly) {
      setPlotlyReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
    script.onload = () => setPlotlyReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!plotlyReady || !ref.current) return
    // @ts-expect-error
    const Plotly = window.Plotly

    const traces: Record<string, unknown>[] = []
    traces.push({
      x: diagrams.stations_m,
      y: diagrams.m_pos_kNm,
      name: 'M⁺ máx',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#0ea5e9', width: 2 },
      marker: { size: 3 },
      fill: 'tozeroy',
      fillcolor: 'rgba(14,165,233,0.14)',
      xaxis: 'x1',
      yaxis: 'y1',
    })
    traces.push({
      x: diagrams.stations_m,
      y: diagrams.m_neg_kNm,
      name: 'M⁻ mín',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#ef4444', width: 2 },
      marker: { size: 3 },
      fill: 'tozeroy',
      fillcolor: 'rgba(239,68,68,0.14)',
      xaxis: 'x1',
      yaxis: 'y1',
    })
    traces.push({
      x: diagrams.stations_m_vc,
      y: diagrams.v_abs_kN_vc,
      name: 'Vu grav.',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#64748b', width: 2 },
      marker: { size: 3 },
      xaxis: 'x2',
      yaxis: 'y2',
    })
    if (diagrams.v_abs_kN_vcap && diagrams.stations_m_vcap) {
      traces.push({
        x: diagrams.stations_m_vcap,
        y: diagrams.v_abs_kN_vcap,
        name: 'Vu Ω·E',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#f59e0b', width: 2, dash: 'dot' },
        marker: { size: 3 },
        xaxis: 'x2',
        yaxis: 'y2',
      })
    }

    // Líneas verticales en apoyos (uniones entre tramos)
    const shapes = diagrams.supports_m.flatMap((s) => [
      {
        type: 'line',
        xref: 'x1',
        yref: 'paper',
        x0: s,
        x1: s,
        y0: 0.55,
        y1: 1,
        line: { color: 'rgba(100,116,139,0.35)', width: 1, dash: 'dash' },
      },
      {
        type: 'line',
        xref: 'x2',
        yref: 'paper',
        x0: s,
        x1: s,
        y0: 0,
        y1: 0.45,
        line: { color: 'rgba(100,116,139,0.35)', width: 1, dash: 'dash' },
      },
    ])

    Plotly.react(
      ref.current,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 48, r: 10, t: 28, b: 38 },
        grid: { rows: 2, columns: 1, pattern: 'independent' },
        shapes,
        xaxis: {
          title: '',
          range: [0, length_m],
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.35)',
        },
        yaxis: {
          title: { text: 'M (kN·m)', font: { size: 10 } },
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.4)',
        },
        xaxis2: {
          title: { text: 'x (m)', font: { size: 10 } },
          range: [0, length_m],
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.35)',
        },
        yaxis2: {
          title: { text: 'V (kN)', font: { size: 10 } },
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.4)',
        },
        legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 10 } },
        font: { size: 10 },
      },
      { responsive: true, displayModeBar: false },
    )
  }, [plotlyReady, diagrams, length_m])

  return (
    <div className="relative" style={{ height: 340 }}>
      {!plotlyReady && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-cc-gray-400">
          Cargando diagramas…
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function BeamResultCard({
  result,
  expanded,
  onToggle,
}: {
  result: DesignElementResult
  expanded: boolean
  onToggle: () => void
}) {
  const shear = flatShear(result.shear)
  const isEnv = isEnvelopeShear(result.shear)
  const gov = isEnv ? result.shear!.governing : null
  const barApoyo = result.capacity?.bar_apoyo
  const barCentro = result.capacity?.bar_centro
  return (
    <div className="rounded-md border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-cc-gray-50 dark:hover:bg-cc-navy-800/50"
      >
        <span className="font-mono font-semibold text-cc-gray-900 text-sm dark:text-white">
          {result.tag}
        </span>
        <span className="text-cc-gray-500 text-xs">{result.section_name}</span>
        <span className="text-cc-gray-400 text-xs">· L={result.geom.length_m.toFixed(2)}m</span>

        <span className="ml-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-cc-gray-200 bg-cc-gray-50 px-1.5 py-0.5 text-cc-gray-700 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
            M⁻ <strong>{result.demands.mu_apoyo_kNm?.toFixed(1) ?? '—'}</strong>
          </span>
          <span className="rounded border border-cc-gray-200 bg-cc-gray-50 px-1.5 py-0.5 text-cc-gray-700 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
            M⁺ <strong>{result.demands.mu_pos_center_kNm?.toFixed(1) ?? '—'}</strong>
          </span>
          {barApoyo && (
            <span className="rounded border border-cc-blue-500/40 bg-cc-blue-500/10 px-1.5 py-0.5 font-mono text-cc-blue-700 dark:text-cc-blue-400">
              apoyo {barApoyo.n}{barApoyo.bar}
            </span>
          )}
          {barCentro && (
            <span className="rounded border border-cc-cyan-500/40 bg-cc-cyan-500/10 px-1.5 py-0.5 font-mono text-cc-cyan-700 dark:text-cc-cyan-400">
              centro {barCentro.n}{barCentro.bar}
            </span>
          )}
          {shear?.stirrup && (
            <span className="rounded border border-cc-gray-200 bg-cc-gray-50 px-1.5 py-0.5 font-mono text-cc-gray-700 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
              E{shear.stirrup.bar} @ {shear.stirrup.s_gen_cm}cm
              {gov && <span className="ml-1 text-cc-warn-600">({gov})</span>}
            </span>
          )}
        </span>

        <span className="ml-auto flex items-center gap-2 text-xs">
          {result.ok ? (
            <Badge variant="success">OK</Badge>
          ) : (
            <Badge variant="warning">!</Badge>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="border-cc-gray-200 border-t px-3 py-3 dark:border-cc-navy-700">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {result.diagrams ? (
              <EnvelopeChart diagrams={result.diagrams} length_m={result.geom.length_m} />
            ) : (
              <p className="text-cc-gray-500 text-xs">Sin diagramas (modo estimación).</p>
            )}
            <BeamDetailTable result={result} />
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-3 rounded-md border border-cc-warn-500/40 bg-cc-warn-100/50 p-2 text-cc-warn-600 text-xs dark:bg-cc-warn-500/10">
              <p className="mb-1 font-semibold">Warnings</p>
              <ul className="list-disc pl-4">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BeamDetailTable({ result }: { result: DesignElementResult }) {
  const shear = result.shear
  const isEnv = isEnvelopeShear(shear)
  const cap = result.capacity
  return (
    <div className="space-y-2 text-xs">
      <div>
        <p className="cc-label-mono text-[10px]">Geometría</p>
        <div className="font-mono text-cc-gray-900 dark:text-white">
          {result.geom.b_cm.toFixed(0)}×{result.geom.h_cm.toFixed(0)} cm · d={result.geom.d_cm.toFixed(1)} cm
        </div>
      </div>
      <div>
        <p className="cc-label-mono text-[10px]">Flexión</p>
        <table className="w-full">
          <tbody>
            <RowKV k="As mín" v={`${cap?.as_min_cm2?.toFixed(2) ?? '—'} cm²`} />
            <RowKV
              k="As apoyo"
              v={
                cap?.bar_apoyo
                  ? `${cap.bar_apoyo.n}${cap.bar_apoyo.bar} = ${cap.bar_apoyo.as_prov_cm2.toFixed(2)} cm²`
                  : '—'
              }
            />
            <RowKV k="φMn⁻" v={`${cap?.phi_mn_apoyo_kNm?.toFixed(2) ?? '—'} kN·m`} />
            <RowKV
              k="As centro"
              v={
                cap?.bar_centro
                  ? `${cap.bar_centro.n}${cap.bar_centro.bar} = ${cap.bar_centro.as_prov_cm2.toFixed(2)} cm²`
                  : '—'
              }
            />
            <RowKV k="φMn⁺" v={`${cap?.phi_mn_centro_kNm?.toFixed(2) ?? '—'} kN·m`} />
          </tbody>
        </table>
      </div>
      {isEnv && shear && (
        <div>
          <p className="cc-label-mono text-[10px]">
            Cortante · gobierna <strong className="text-cc-warn-600">{shear.governing}</strong>
          </p>
          <table className="w-full">
            <tbody>
              <RowKV k="Vu Vc" v={`${shear.vc.vu_support_kN.toFixed(1)} kN`} />
              {shear.vcap && (
                <RowKV k="Vu Ω·E" v={`${shear.vcap.vu_support_kN.toFixed(1)} kN`} />
              )}
              {shear.mpr && (
                <RowKV
                  k="Vu Mpr"
                  v={`${shear.mpr.v_cap_mpr_kN?.toFixed(1) ?? '—'} kN`}
                />
              )}
              <RowKV
                k="Estribo"
                v={
                  flatShear(shear)?.stirrup
                    ? `E${flatShear(shear)!.stirrup.bar} @ ${flatShear(shear)!.stirrup.s_gen_cm} cm`
                    : '—'
                }
              />
              <RowKV
                k="Conf."
                v={
                  flatShear(shear)?.stirrup
                    ? `@ ${flatShear(shear)!.stirrup.s_conf_cm} cm × ${flatShear(shear)!.stirrup.l_conf_cm} cm`
                    : '—'
                }
              />
              <RowKV
                k="φVn"
                v={`${flatShear(shear)?.stirrup.phi_vn_kN?.toFixed(1) ?? '—'} kN`}
              />
            </tbody>
          </table>
        </div>
      )}
      {!isEnv && shear && 'stirrup' in shear && shear.stirrup && (
        <div>
          <p className="cc-label-mono text-[10px]">Cortante</p>
          <table className="w-full">
            <tbody>
              <RowKV k="Vu" v={`${shear.vu_at_d_kN.toFixed(1)} kN`} />
              <RowKV
                k="Estribo"
                v={`E${shear.stirrup.bar} @ ${shear.stirrup.s_gen_cm} cm`}
              />
              <RowKV k="φVn" v={`${shear.stirrup.phi_vn_kN.toFixed(1)} kN`} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-cc-gray-100 border-t dark:border-cc-navy-800">
      <td className="py-1 text-cc-gray-500">{k}</td>
      <td className="py-1 text-right font-mono text-cc-gray-900 dark:text-white">{v}</td>
    </tr>
  )
}

function SimpleBeamTable({ elements }: { elements: DesignElementResult[] }) {
  return (
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
        {elements.map((e) => {
          const sh = flatShear(e.shear)
          return (
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
                {sh?.vu_at_d_kN?.toFixed(2) ?? '—'}
              </td>
              <td className="px-2 py-1 font-mono">
                {sh
                  ? sh.needs_stirrups
                    ? `E${sh.stirrup.bar} @ ${sh.stirrup.s_gen_cm}cm (conf ${sh.stirrup.s_conf_cm}cm × ${sh.stirrup.l_conf_cm}cm)`
                    : `E${sh.stirrup.bar} min`
                  : '—'}
              </td>
              <td className="px-2 py-1 text-right">
                {sh?.stirrup?.phi_vn_kN?.toFixed(2) ?? '—'}
              </td>
              <td className="px-2 py-1 text-center">
                {e.ok ? (
                  <span className="text-cc-success-600">OK</span>
                ) : (
                  <span className="text-cc-warn-600">!</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
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

function ComboMultiSelect({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label: string
  hint: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])
  }
  return (
    <div className="rounded-md border border-cc-gray-200 bg-white p-2 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <div className="mb-1 flex items-center justify-between">
        <p className="cc-label-mono text-[10px]">{label}</p>
        <span className="text-cc-gray-400 text-[10px]">{selected.length}/{options.length}</span>
      </div>
      <p className="mb-2 text-cc-gray-400 text-[10.5px]">{hint}</p>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
        {options.map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={
                on
                  ? 'rounded border border-cc-cyan-500 bg-cc-cyan-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-cc-cyan-700 dark:text-cc-cyan-400'
                  : 'rounded border border-cc-gray-200 bg-white px-1.5 py-0.5 text-[10.5px] text-cc-gray-500 hover:border-cc-gray-300 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-400'
              }
              title={opt}
            >
              {opt}
            </button>
          )
        })}
        {options.length === 0 && (
          <span className="text-cc-gray-400 text-[10.5px]">Sin combos disponibles</span>
        )}
      </div>
    </div>
  )
}

function EnvelopeChart({
  diagrams,
  length_m,
}: {
  diagrams: NonNullable<DesignElementResult['diagrams']>
  length_m: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // @ts-expect-error — Plotly is loaded as global
    if (window.Plotly) {
      setPlotlyReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
    script.onload = () => setPlotlyReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!plotlyReady || !ref.current) return
    // @ts-expect-error
    const Plotly = window.Plotly
    const flex = diagrams.flex
    const vc = diagrams.shear_vc
    const vcap = diagrams.shear_vcap

    const traces: Record<string, unknown>[] = []
    // Momentos — positivo (abajo-arriba) y negativo (envolvente)
    traces.push({
      x: flex.stations_m,
      y: flex.m_pos_kNm,
      name: 'M⁺ máx',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#0ea5e9', width: 2 },
      marker: { size: 4 },
      xaxis: 'x1',
      yaxis: 'y1',
      fill: 'tozeroy',
      fillcolor: 'rgba(14,165,233,0.14)',
    })
    traces.push({
      x: flex.stations_m,
      y: flex.m_neg_kNm,
      name: 'M⁻ mín',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#ef4444', width: 2 },
      marker: { size: 4 },
      xaxis: 'x1',
      yaxis: 'y1',
      fill: 'tozeroy',
      fillcolor: 'rgba(239,68,68,0.14)',
    })
    // Cortante Vc
    traces.push({
      x: vc.stations_m,
      y: vc.v_abs_kN,
      name: 'Vu (gravit.)',
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#64748b', width: 2 },
      marker: { size: 4 },
      xaxis: 'x2',
      yaxis: 'y2',
    })
    if (vcap) {
      traces.push({
        x: vcap.stations_m,
        y: vcap.v_abs_kN,
        name: 'Vu (Ω·sismo)',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#f59e0b', width: 2, dash: 'dot' },
        marker: { size: 4 },
        xaxis: 'x2',
        yaxis: 'y2',
      })
    }

    Plotly.react(
      ref.current,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 44, r: 10, t: 24, b: 34 },
        grid: { rows: 2, columns: 1, pattern: 'independent' },
        xaxis: {
          title: '',
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.35)',
          range: [0, length_m],
        },
        yaxis: {
          title: { text: 'M (kN·m)', font: { size: 10 } },
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.4)',
        },
        xaxis2: {
          title: { text: 'x (m)', font: { size: 10 } },
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.35)',
          range: [0, length_m],
        },
        yaxis2: {
          title: { text: 'V (kN)', font: { size: 10 } },
          gridcolor: 'rgba(100,116,139,0.15)',
          zerolinecolor: 'rgba(100,116,139,0.4)',
        },
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.12,
          font: { size: 10 },
        },
        font: { size: 10 },
      },
      { responsive: true, displayModeBar: false },
    )
  }, [plotlyReady, diagrams, length_m])

  return (
    <div className="relative" style={{ height: 300 }}>
      {!plotlyReady && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-cc-gray-400">
          Cargando diagramas…
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
