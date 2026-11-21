'use client'

import type { GeomElement, GeomNode, RevisionGeometry } from '@/lib/api'
import { useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Plotly: any
  }
}

type ViewMode = 'lines' | 'extruded'

// Paleta profesional estilo Revit/Tekla con acentos técnicos
const KIND_COLOR: Record<string, string> = {
  column: '#334155',
  beam: '#0ea5e9',
  wall: '#8b5cf6',
  slab: '#06b6d4',
  joist: '#f59e0b',
}
const SELECTED_COLOR = '#f59e0b'
const SELECTED_EDGE = '#fde68a'

const KIND_LABEL: Record<string, string> = {
  column: 'Columna',
  beam: 'Viga',
  wall: 'Muro',
  slab: 'Losa',
  joist: 'Vigueta',
}

export function ModelViewer3D({ geometry }: { geometry: RevisionGeometry }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('extruded')
  const [showCols, setShowCols] = useState(true)
  const [showBeams, setShowBeams] = useState(true)
  const [showSlabs, setShowSlabs] = useState(true)
  const [showWalls, setShowWalls] = useState(true)
  const [showNodes, setShowNodes] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(true)

  const nodeById = useMemo(() => {
    const m = new Map<string, GeomNode>()
    for (const n of geometry.nodes) m.set(n.id, n)
    return m
  }, [geometry.nodes])

  const elementById = useMemo(() => {
    const m = new Map<string, GeomElement>()
    for (const e of geometry.elements) m.set(e.id, e)
    return m
  }, [geometry.elements])

  const sortedLevels = useMemo(
    () => [...geometry.levels].sort((a, b) => a.elevation - b.elevation),
    [geometry.levels],
  )
  const levelById = useMemo(() => {
    const m = new Map<string, (typeof sortedLevels)[number]>()
    for (const l of sortedLevels) m.set(l.id, l)
    return m
  }, [sortedLevels])

  const [activeLevels, setActiveLevels] = useState<string[]>([])
  useEffect(() => {
    setActiveLevels(sortedLevels.map((l) => l.id))
  }, [sortedLevels])

  const selected = selectedId ? elementById.get(selectedId) ?? null : null

  // Cargar Plotly desde CDN
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Plotly) {
      setPlotlyReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
    script.onload = () => setPlotlyReady(true)
    document.head.appendChild(script)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: render reads all state via closure
  useEffect(() => {
    if (!plotlyReady || !containerRef.current) return
    render()
  }, [
    plotlyReady,
    geometry,
    viewMode,
    showCols,
    showBeams,
    showSlabs,
    showWalls,
    showNodes,
    showGrid,
    activeLevels,
    selectedId,
  ])

  // Click handler → selecciona elemento
  useEffect(() => {
    if (!plotlyReady || !containerRef.current) return
    const el = containerRef.current as unknown as {
      on?: (ev: string, h: (ev: unknown) => void) => void
      removeAllListeners?: (ev: string) => void
    }
    const handler = (evt: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const points = (evt as any)?.points
      if (!points || !points.length) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = points[0]?.data?.meta as string | undefined
      if (meta && meta.startsWith('el:')) {
        setSelectedId(meta.slice(3))
        setShowHint(false)
      }
    }
    el.on?.('plotly_click', handler)
    return () => {
      el.removeAllListeners?.('plotly_click')
    }
  }, [plotlyReady])

  function render() {
    const Plotly = window.Plotly
    if (!Plotly || !containerRef.current) return

    const levelsFilter = new Set(activeLevels)
    const visible = geometry.elements.filter(
      (e) => !e.level_id || levelsFilter.has(e.level_id),
    )

    const kindShown: Record<string, boolean> = {
      column: showCols,
      beam: showBeams,
      wall: showWalls,
      slab: showSlabs,
      joist: showBeams,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = []

    // 1) Plano de suelo (grid blueprint)
    if (showGrid) {
      const minZ = Math.min(0, ...geometry.nodes.map((n) => n.z))
      const xs = geometry.nodes.map((n) => n.x)
      const ys = geometry.nodes.map((n) => n.y)
      const xMin = Math.min(...xs) - 2
      const xMax = Math.max(...xs) + 2
      const yMin = Math.min(...ys) - 2
      const yMax = Math.max(...ys) + 2
      // Rectángulo base como mesh3d con opacidad muy baja
      traces.push({
        type: 'mesh3d',
        x: [xMin, xMax, xMax, xMin],
        y: [yMin, yMin, yMax, yMax],
        z: [minZ, minZ, minZ, minZ],
        i: [0, 0],
        j: [1, 2],
        k: [2, 3],
        color: '#64748b',
        opacity: 0.04,
        flatshading: true,
        hoverinfo: 'skip',
        showlegend: false,
        lighting: { ambient: 1, diffuse: 0 },
      })
      // Líneas de grid cada 2m
      const step = 2
      const gx: (number | null)[] = []
      const gy: (number | null)[] = []
      const gz: (number | null)[] = []
      for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        gx.push(x, x, null)
        gy.push(yMin, yMax, null)
        gz.push(minZ, minZ, null)
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        gx.push(xMin, xMax, null)
        gy.push(y, y, null)
        gz.push(minZ, minZ, null)
      }
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: gx,
        y: gy,
        z: gz,
        line: { color: 'rgba(100, 116, 139, 0.18)', width: 1 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    // 2) Trace por elemento individual (permite click → selección)
    for (const e of visible) {
      const kindShow = kindShown[e.kind] ?? true
      if (!kindShow && e.id !== selectedId) continue

      const ni = e.node_i_id ? nodeById.get(e.node_i_id) : undefined
      const nj = e.node_j_id ? nodeById.get(e.node_j_id) : undefined
      if (!ni || !nj) continue

      const isSelected = e.id === selectedId
      const baseColor = KIND_COLOR[e.kind] ?? '#94a3b8'
      const color = isSelected ? SELECTED_COLOR : baseColor
      const hovertext = buildHoverText(e)

      if (viewMode === 'extruded' && (e.kind === 'column' || e.kind === 'beam' || e.kind === 'joist')) {
        const props = e.properties ?? {}
        const geo = (props.geometry ?? {}) as Record<string, unknown>
        const b = pickNumber(geo.base ?? geo.width, 0.3)
        const h = pickNumber(geo.height ?? geo.depth, 0.3)
        const tv =
          (props.geometry_transformation_vector as [number, number, number] | undefined) ??
          (e.kind === 'column' ? [0, 1, 0] : [0, 0, 1])
        traces.push(
          ...makeBox(
            ni.x,
            ni.y,
            ni.z,
            nj.x,
            nj.y,
            nj.z,
            b,
            h,
            tv,
            color,
            isSelected ? 0.95 : 0.82,
            isSelected,
            `el:${e.id}`,
            hovertext,
          ),
        )
      } else {
        // Modo lines (o walls/slabs que no tienen box extruida aquí)
        const width = e.kind === 'column' ? 5 : e.kind === 'beam' ? 3 : e.kind === 'wall' ? 2 : 1
        traces.push({
          type: 'scatter3d',
          mode: 'lines',
          x: [ni.x, nj.x],
          y: [ni.y, nj.y],
          z: [ni.z, nj.z],
          line: { color, width: isSelected ? width + 3 : width },
          hovertemplate: `${hovertext}<extra></extra>`,
          showlegend: false,
          meta: `el:${e.id}`,
        })
      }
    }

    // 3) Nodos (opcional)
    if (showNodes) {
      const nx: number[] = []
      const ny: number[] = []
      const nz: number[] = []
      const nt: string[] = []
      for (const n of geometry.nodes) {
        if (n.level_id && !levelsFilter.has(n.level_id)) continue
        nx.push(n.x)
        ny.push(n.y)
        nz.push(n.z)
        nt.push(`Nodo ${n.tag}<br>X: ${n.x.toFixed(2)}  Y: ${n.y.toFixed(2)}  Z: ${n.z.toFixed(2)}`)
      }
      if (nx.length) {
        traces.push({
          type: 'scatter3d',
          mode: 'markers',
          x: nx,
          y: ny,
          z: nz,
          text: nt,
          hovertemplate: '%{text}<extra></extra>',
          marker: { size: 3, color: '#06b6d4', line: { color: '#ffffff', width: 1 } },
          showlegend: false,
        })
      }
    }

    // 4) Leyenda sintética
    const legendEntries: [string, string][] = [
      ['Columnas', KIND_COLOR.column],
      ['Vigas', KIND_COLOR.beam],
      ['Muros', KIND_COLOR.wall],
      ['Losas', KIND_COLOR.slab],
    ]
    for (const [name, color] of legendEntries) {
      traces.push({
        type: 'scatter3d',
        mode: 'lines',
        x: [null],
        y: [null],
        z: [null],
        name,
        line: { color, width: 4 },
        showlegend: true,
      })
    }

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark'

    Plotly.react(
      containerRef.current!,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, t: 10, b: 0 },
        scene: {
          xaxis: {
            title: 'X (m)',
            gridcolor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.15)',
            zerolinecolor: isDark ? 'rgba(34, 211, 238, 0.35)' : 'rgba(14, 165, 233, 0.4)',
            color: isDark ? '#94a3b8' : '#475569',
            backgroundcolor: 'rgba(0,0,0,0)',
            showbackground: false,
          },
          yaxis: {
            title: 'Y (m)',
            gridcolor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.15)',
            zerolinecolor: isDark ? 'rgba(34, 211, 238, 0.35)' : 'rgba(14, 165, 233, 0.4)',
            color: isDark ? '#94a3b8' : '#475569',
            backgroundcolor: 'rgba(0,0,0,0)',
            showbackground: false,
          },
          zaxis: {
            title: 'Z (m)',
            gridcolor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.15)',
            zerolinecolor: isDark ? 'rgba(34, 211, 238, 0.35)' : 'rgba(14, 165, 233, 0.4)',
            color: isDark ? '#94a3b8' : '#475569',
            backgroundcolor: 'rgba(0,0,0,0)',
            showbackground: false,
          },
          bgcolor: 'rgba(0,0,0,0)',
          aspectmode: 'data',
          camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
        },
        legend: {
          x: 0.01,
          y: 0.99,
          bgcolor: isDark ? 'rgba(15, 26, 46, 0.75)' : 'rgba(255, 255, 255, 0.85)',
          bordercolor: isDark ? '#233149' : '#e2e8f0',
          borderwidth: 1,
          font: { size: 11, color: isDark ? '#cbd5e1' : '#334155' },
        },
        uirevision: 'model',
      },
      {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['sendDataToCloud', 'select2d', 'lasso2d'],
      },
    )
  }

  const toggleAllLevels = () =>
    setActiveLevels(
      activeLevels.length === sortedLevels.length ? [] : sortedLevels.map((l) => l.id),
    )

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of geometry.elements) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [geometry.elements])

  return (
    <div className="cc-viewer-grid" data-has-selection={selected !== null}>
      <div className="cc-viewer-shell">
        <div className="cc-viewer-toolbar">
          <div className="cc-viewer-seggroup" role="group" aria-label="Modo de vista">
            {(['extruded', 'lines'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className="cc-viewer-seg"
                data-active={viewMode === m}
                aria-pressed={viewMode === m}
              >
                {m === 'extruded' ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M8 1 2 4v8l6 3 6-3V4L8 1Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <path d="M2 4l6 3 6-3M8 7v8" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 13 8 3l5 10M5 9h6"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {m === 'extruded' ? 'Construido' : 'Líneas'}
              </button>
            ))}
          </div>

          {(
            [
              ['Columnas', showCols, setShowCols, KIND_COLOR.column, counts.column ?? 0],
              ['Vigas', showBeams, setShowBeams, KIND_COLOR.beam, counts.beam ?? 0],
              ['Muros', showWalls, setShowWalls, KIND_COLOR.wall, counts.wall ?? 0],
              ['Losas', showSlabs, setShowSlabs, KIND_COLOR.slab, counts.slab ?? 0],
              ['Nodos', showNodes, setShowNodes, '#06b6d4', geometry.nodes.length],
            ] as const
          ).map(([label, active, setter, color, n]) => (
            <button
              key={label}
              type="button"
              onClick={() => (setter as React.Dispatch<React.SetStateAction<boolean>>)(!active)}
              className="cc-viewer-chip"
              data-active={active}
              style={{ ['--_chip-c' as string]: color }}
            >
              <span className="cc-viewer-chip-swatch" style={{ ['--_chip-c' as string]: color }} />
              {label}
              <span className="font-mono opacity-60">{n}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className="cc-viewer-chip"
            data-active={showGrid}
            style={{ ['--_chip-c' as string]: '#64748b' }}
            title="Mostrar grilla base"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 2h12v12H2V2Zm0 4h12M2 10h12M6 2v12M10 2v12"
                stroke="currentColor"
                strokeWidth="1.1"
              />
            </svg>
            Grilla
          </button>

          {sortedLevels.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <span className="cc-label-mono text-[9.5px]">Niveles</span>
              <button
                type="button"
                className="font-semibold text-cc-cyan-600 text-[11px] hover:underline dark:text-cc-cyan-400"
                onClick={toggleAllLevels}
              >
                {activeLevels.length === sortedLevels.length ? 'Ninguno' : 'Todos'}
              </button>
              <div className="flex flex-wrap gap-0.5">
                {sortedLevels.map((l) => {
                  const isOn = activeLevels.includes(l.id)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() =>
                        setActiveLevels((prev) =>
                          prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id],
                        )
                      }
                      className="cc-viewer-level"
                      data-active={isOn}
                      title={`z = ${l.elevation.toFixed(2)} m`}
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="cc-viewer-stage">
          {!plotlyReady && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-cc-gray-500">
              Cargando visor 3D…
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          {plotlyReady && showHint && !selected && (
            <div className="cc-viewer-hint">
              💡 Click en un elemento para ver sus propiedades
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ElementInspector
          element={selected}
          nodeById={nodeById}
          levelName={selected.level_id ? levelById.get(selected.level_id)?.name : undefined}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function buildHoverText(e: GeomElement): string {
  const props = e.properties ?? {}
  const label = String(props.object_label ?? e.tag)
  const sec = String(props.design_section ?? props.section ?? '')
  return sec ? `${label}<br>${sec}` : label
}

function ElementInspector({
  element,
  nodeById,
  levelName,
  onClose,
}: {
  element: GeomElement
  nodeById: Map<string, GeomNode>
  levelName?: string
  onClose: () => void
}) {
  const props = (element.properties ?? {}) as Record<string, unknown>
  const geo = (props.geometry ?? {}) as Record<string, unknown>
  const ni = element.node_i_id ? nodeById.get(element.node_i_id) : undefined
  const nj = element.node_j_id ? nodeById.get(element.node_j_id) : undefined
  const length =
    ni && nj
      ? Math.sqrt((nj.x - ni.x) ** 2 + (nj.y - ni.y) ** 2 + (nj.z - ni.z) ** 2)
      : null
  const b = pickNumber(geo.base ?? geo.width, NaN)
  const h = pickNumber(geo.height ?? geo.depth, NaN)
  const designSection = props.design_section ?? props.section
  const material = props.material
  const kindColor = KIND_COLOR[element.kind] ?? '#94a3b8'
  const kindLabel = KIND_LABEL[element.kind] ?? element.kind

  return (
    <aside className="cc-inspector" style={{ ['--_tag-c' as string]: kindColor }}>
      <header className="cc-inspector-head">
        <div className="cc-inspector-tag">
          <span className="cc-inspector-tag-badge">
            <KindGlyph kind={element.kind} />
          </span>
          <div className="cc-inspector-tag-text">
            <div className="cc-inspector-tag-kind">{kindLabel}</div>
            <div className="cc-inspector-tag-id">{String(props.object_label ?? element.tag)}</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar inspector"
          className="cc-inspector-close"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="space-y-0">
        {designSection && (
          <Prop k="Sección" v={String(designSection)} />
        )}
        {material && <Prop k="Material" v={String(material)} />}
        {levelName && <Prop k="Nivel" v={levelName} />}
        {length !== null && <Prop k="Longitud" v={`${length.toFixed(2)} m`} />}
        {Number.isFinite(b) && Number.isFinite(h) && (
          <Prop k="Dimensiones" v={`${(b * 100).toFixed(0)} × ${(h * 100).toFixed(0)} cm`} />
        )}
        <Prop k="Tag ETABS" v={element.tag} />
        <Prop k="UUID" v={element.id.slice(0, 8)} />
      </div>

      {(ni || nj) && (
        <div className="cc-inspector-section">
          <p className="cc-inspector-section-title">Nodos conectores</p>
          {ni && <NodeRow label="Inicio (I)" node={ni} />}
          {nj && <NodeRow label="Fin (J)" node={nj} />}
        </div>
      )}
    </aside>
  )
}

function Prop({ k, v }: { k: string; v: string }) {
  return (
    <div className="cc-inspector-prop">
      <span className="cc-inspector-prop-k">{k}</span>
      <span className="cc-inspector-prop-v">{v}</span>
    </div>
  )
}

function NodeRow({ label, node }: { label: string; node: GeomNode }) {
  return (
    <div className="cc-inspector-node">
      <div className="cc-inspector-node-head">
        <span className="cc-inspector-prop-k">{label}</span>
        <span className="cc-inspector-node-tag">{node.tag}</span>
      </div>
      <div className="cc-inspector-node-coords">
        <div>
          <span className="cc-inspector-node-ax">X</span>{' '}
          <span className="cc-inspector-node-val">{node.x.toFixed(2)}</span>
        </div>
        <div>
          <span className="cc-inspector-node-ax">Y</span>{' '}
          <span className="cc-inspector-node-val">{node.y.toFixed(2)}</span>
        </div>
        <div>
          <span className="cc-inspector-node-ax">Z</span>{' '}
          <span className="cc-inspector-node-val">{node.z.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function KindGlyph({ kind }: { kind: string }) {
  if (kind === 'column')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="6" y="2" width="4" height="12" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  if (kind === 'beam' || kind === 'joist')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="6" width="12" height="4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  if (kind === 'wall')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 3h10v10H3V3Zm0 5h10M8 3v10" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function pickNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : fallback
}

// Prisma rectangular (mesh3d) para el modo extruido.
function makeBox(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  b: number,
  h: number,
  localY: [number, number, number],
  color: string,
  opacity: number,
  highlightEdges: boolean,
  meta: string,
  hovertext: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const ax = x2 - x1
  const ay = y2 - y1
  const az = z2 - z1
  const L = Math.sqrt(ax * ax + ay * ay + az * az)
  if (L < 1e-6) return []

  const ex: [number, number, number] = [ax / L, ay / L, az / L]
  let ey: [number, number, number] = [...(localY ?? [0, 1, 0])] as [number, number, number]
  const dot = ey[0] * ex[0] + ey[1] * ex[1] + ey[2] * ex[2]
  ey = [ey[0] - dot * ex[0], ey[1] - dot * ex[1], ey[2] - dot * ex[2]]
  const lyLen = Math.sqrt(ey[0] ** 2 + ey[1] ** 2 + ey[2] ** 2)
  if (lyLen < 1e-6) {
    ey = Math.abs(ex[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
  } else {
    ey = [ey[0] / lyLen, ey[1] / lyLen, ey[2] / lyLen]
  }
  const ez: [number, number, number] = [
    ey[1] * ex[2] - ey[2] * ex[1],
    ey[2] * ex[0] - ey[0] * ex[2],
    ey[0] * ex[1] - ey[1] * ex[0],
  ]

  const hb = b / 2
  const hh = h / 2
  const corners: [number, number][] = [
    [-hb, -hh],
    [hb, -hh],
    [hb, hh],
    [-hb, hh],
  ]
  const pts: number[][] = [
    ...corners.map(([u, v]) => [
      x1 + u * ey[0] + v * ez[0],
      y1 + u * ey[1] + v * ez[1],
      z1 + u * ey[2] + v * ez[2],
    ]),
    ...corners.map(([u, v]) => [
      x2 + u * ey[0] + v * ez[0],
      y2 + u * ey[1] + v * ez[1],
      z2 + u * ey[2] + v * ez[2],
    ]),
  ]

  const px = pts.map((p) => p[0])
  const py = pts.map((p) => p[1])
  const pz = pts.map((p) => p[2])

  const i_ = [0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 2, 4, 4, 5, 6]
  const j_ = [1, 2, 2, 5, 3, 6, 0, 7, 1, 4, 5, 3, 5, 6, 6, 7]
  const k_ = [2, 5, 5, 6, 6, 7, 7, 4, 4, 5, 6, 7, 6, 7, 7, 4]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [
    {
      type: 'mesh3d',
      x: px,
      y: py,
      z: pz,
      i: i_,
      j: j_,
      k: k_,
      color,
      opacity,
      flatshading: true,
      hovertemplate: `${hovertext}<extra></extra>`,
      showlegend: false,
      meta,
      lighting: {
        ambient: 0.55,
        diffuse: 0.85,
        roughness: 0.4,
        specular: 0.25,
        fresnel: 0.15,
      },
      lightposition: { x: 800, y: 1200, z: 2500 },
    },
  ]

  // Edges: dibujo líneas alrededor del box para dar sensación "constructiva"
  const edgeColor = highlightEdges ? SELECTED_EDGE : 'rgba(15, 23, 42, 0.35)'
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0], // cara i
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4], // cara j
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7], // longitudinales
  ]
  const ex_ = edges.flatMap(([a, b2]) => [px[a], px[b2], null])
  const ey_ = edges.flatMap(([a, b2]) => [py[a], py[b2], null])
  const ez_ = edges.flatMap(([a, b2]) => [pz[a], pz[b2], null])
  out.push({
    type: 'scatter3d',
    mode: 'lines',
    x: ex_,
    y: ey_,
    z: ez_,
    line: { color: edgeColor, width: highlightEdges ? 2.5 : 1 },
    hoverinfo: 'skip',
    showlegend: false,
    meta,
  })

  return out
}
