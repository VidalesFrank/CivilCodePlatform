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

const KIND_COLOR: Record<string, string> = {
  column: '#54643a',
  beam: '#75b72a',
  wall: '#8aa0d8',
  slab: '#b7d38a',
  joist: '#c0a060',
}

export function ModelViewer3D({ geometry }: { geometry: RevisionGeometry }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('lines')
  const [showCols, setShowCols] = useState(true)
  const [showBeams, setShowBeams] = useState(true)
  const [showSlabs, setShowSlabs] = useState(true)
  const [showWalls, setShowWalls] = useState(true)
  const [showNodes, setShowNodes] = useState(false)

  const nodeById = useMemo(() => {
    const m = new Map<string, GeomNode>()
    for (const n of geometry.nodes) m.set(n.id, n)
    return m
  }, [geometry.nodes])

  const sortedLevels = useMemo(
    () => [...geometry.levels].sort((a, b) => a.elevation - b.elevation),
    [geometry.levels],
  )
  const [activeLevels, setActiveLevels] = useState<string[]>([])

  useEffect(() => {
    setActiveLevels(sortedLevels.map((l) => l.id))
  }, [sortedLevels])

  // Cargar Plotly desde CDN (evita SSR)
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: render() reads all these states but biome can't see through the helper
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
    activeLevels,
  ])

  function render() {
    const Plotly = window.Plotly
    if (!Plotly || !containerRef.current) return

    const levelsFilter = new Set(activeLevels)
    const visible = geometry.elements.filter((e) => !e.level_id || levelsFilter.has(e.level_id))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = []

    function pushLineGroup(els: GeomElement[], color: string, width: number) {
      const x: (number | null)[] = []
      const y: (number | null)[] = []
      const z: (number | null)[] = []
      for (const e of els) {
        const ni = e.node_i_id ? nodeById.get(e.node_i_id) : undefined
        const nj = e.node_j_id ? nodeById.get(e.node_j_id) : undefined
        if (!ni || !nj) continue
        x.push(ni.x, nj.x, null)
        y.push(ni.y, nj.y, null)
        z.push(ni.z, nj.z, null)
      }
      if (x.length)
        traces.push({
          type: 'scatter3d',
          mode: 'lines',
          x,
          y,
          z,
          line: { color, width },
          hoverinfo: 'none',
          showlegend: false,
        })
    }

    function pushExtruded(
      els: GeomElement[],
      color: string,
      fallbackLocalY: [number, number, number],
    ) {
      for (const e of els) {
        const ni = e.node_i_id ? nodeById.get(e.node_i_id) : undefined
        const nj = e.node_j_id ? nodeById.get(e.node_j_id) : undefined
        if (!ni || !nj) continue
        const props = e.properties ?? {}
        const geo = (props.geometry ?? {}) as Record<string, unknown>
        const b = pickNumber(geo.base ?? geo.width, 0.3)
        const h = pickNumber(geo.height ?? geo.depth, 0.3)
        const tv =
          (props.geometry_transformation_vector as [number, number, number] | undefined) ??
          fallbackLocalY
        const label = `${String(props.object_label ?? e.tag)}<br>${String(props.design_section ?? '')}<br>b=${b}m h=${h}m`
        traces.push(...makeBox(ni.x, ni.y, ni.z, nj.x, nj.y, nj.z, b, h, tv, color, label))
      }
    }

    const byKind = new Map<string, GeomElement[]>()
    for (const e of visible) {
      if (!byKind.has(e.kind)) byKind.set(e.kind, [])
      byKind.get(e.kind)!.push(e)
    }

    if (showCols) {
      const els = byKind.get('column') ?? []
      if (viewMode === 'lines') pushLineGroup(els, KIND_COLOR.column, 5)
      else pushExtruded(els, KIND_COLOR.column, [0, 1, 0])
    }
    if (showBeams) {
      const els = byKind.get('beam') ?? []
      if (viewMode === 'lines') pushLineGroup(els, KIND_COLOR.beam, 3)
      else pushExtruded(els, KIND_COLOR.beam, [0, 0, 1])
    }
    if (showWalls) {
      const els = byKind.get('wall') ?? []
      pushLineGroup(els, KIND_COLOR.wall, 2)
    }
    if (showSlabs) {
      const els = byKind.get('slab') ?? []
      pushLineGroup(els, KIND_COLOR.slab, 1)
    }

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
        nt.push(`Nodo ${n.tag}<br>X:${n.x} Y:${n.y} Z:${n.z}`)
      }
      if (nx.length)
        traces.push({
          type: 'scatter3d',
          mode: 'markers',
          x: nx,
          y: ny,
          z: nz,
          text: nt,
          hoverinfo: 'text',
          marker: { size: 3, color: '#575756' },
          showlegend: false,
        })
    }

    // Leyenda
    traces.push(
      {
        type: 'scatter3d',
        mode: 'lines',
        x: [null],
        y: [null],
        z: [null],
        name: 'Columnas',
        line: { color: KIND_COLOR.column, width: 4 },
        showlegend: true,
      },
      {
        type: 'scatter3d',
        mode: 'lines',
        x: [null],
        y: [null],
        z: [null],
        name: 'Vigas',
        line: { color: KIND_COLOR.beam, width: 3 },
        showlegend: true,
      },
      {
        type: 'scatter3d',
        mode: 'lines',
        x: [null],
        y: [null],
        z: [null],
        name: 'Muros',
        line: { color: KIND_COLOR.wall, width: 2 },
        showlegend: true,
      },
      {
        type: 'scatter3d',
        mode: 'lines',
        x: [null],
        y: [null],
        z: [null],
        name: 'Losas',
        line: { color: KIND_COLOR.slab, width: 1 },
        showlegend: true,
      },
    )

    Plotly.react(
      containerRef.current!,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, t: 10, b: 0 },
        scene: {
          xaxis: { title: 'X (m)', gridcolor: '#e8e8e8', zerolinecolor: '#ccc' },
          yaxis: { title: 'Y (m)', gridcolor: '#e8e8e8', zerolinecolor: '#ccc' },
          zaxis: { title: 'Z (m)', gridcolor: '#e8e8e8', zerolinecolor: '#ccc' },
          bgcolor: 'rgba(248,248,247,0.4)',
          aspectmode: 'data',
          camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
        },
        legend: {
          x: 0.01,
          y: 0.99,
          bgcolor: 'rgba(255,255,255,.85)',
          bordercolor: '#e0e0e0',
          borderwidth: 1,
          font: { size: 11 },
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-cc-gray-200 text-xs dark:border-cc-navy-700">
          {(['lines', 'extruded'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={
                viewMode === m
                  ? 'bg-cc-blue-600 px-3 py-1.5 font-medium text-white'
                  : 'px-3 py-1.5 font-medium text-cc-gray-500 hover:text-cc-gray-700 dark:hover:text-cc-gray-300'
              }
            >
              {m === 'lines' ? 'Líneas' : 'Extruido'}
            </button>
          ))}
        </div>

        {(
          [
            ['Columnas', showCols, setShowCols, KIND_COLOR.column, counts.column ?? 0],
            ['Vigas', showBeams, setShowBeams, KIND_COLOR.beam, counts.beam ?? 0],
            ['Muros', showWalls, setShowWalls, KIND_COLOR.wall, counts.wall ?? 0],
            ['Losas', showSlabs, setShowSlabs, KIND_COLOR.slab, counts.slab ?? 0],
            ['Nodos', showNodes, setShowNodes, '#575756', geometry.nodes.length],
          ] as const
        ).map(([label, active, setter, color, n]) => (
          <button
            key={label}
            type="button"
            onClick={() => (setter as React.Dispatch<React.SetStateAction<boolean>>)(!active)}
            className={
              active
                ? 'flex items-center gap-1.5 rounded-full border border-cc-blue-600 bg-cc-blue-50 px-2.5 py-1 text-[11px] font-medium text-cc-blue-700 dark:bg-cc-blue-900/30'
                : 'flex items-center gap-1.5 rounded-full border border-cc-gray-200 px-2.5 py-1 text-[11px] font-medium text-cc-gray-500 dark:border-cc-navy-700'
            }
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: color,
                display: 'inline-block',
                opacity: active ? 1 : 0.35,
              }}
            />
            {label} <span className="opacity-60">({n})</span>
          </button>
        ))}

        {sortedLevels.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="text-cc-gray-500">Pisos:</span>
            <button
              type="button"
              className="font-semibold text-cc-blue-600"
              onClick={toggleAllLevels}
            >
              {activeLevels.length === sortedLevels.length ? 'Ninguno' : 'Todos'}
            </button>
            <div className="flex flex-wrap gap-1">
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
                    className={
                      isOn
                        ? 'rounded border border-cc-blue-600 bg-cc-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white'
                        : 'rounded border border-cc-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-cc-gray-500 dark:border-cc-navy-700'
                    }
                    title={`Elevación: ${l.elevation}m`}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-cc-gray-500">
        {viewMode === 'extruded'
          ? 'Secciones extruidas · dimensiones reales'
          : 'Vista de líneas · eje centroidal'}
      </div>

      <div
        className="relative rounded-lg border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900"
        style={{ height: 580 }}
      >
        {!plotlyReady && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-cc-gray-500">
            Cargando visor 3D…
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

function pickNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : fallback
}

// Prisma rectangular (mesh3d) para el modo extruido. Portado de Saas_PerformanceLabs.
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
  label: string,
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

  return [
    {
      type: 'mesh3d',
      x: px,
      y: py,
      z: pz,
      i: i_,
      j: j_,
      k: k_,
      color,
      opacity: 0.75,
      flatshading: true,
      hovertext: label,
      hoverinfo: 'text',
      showlegend: false,
      lighting: { ambient: 0.7, diffuse: 0.8, roughness: 0.5, specular: 0.2 },
      lightposition: { x: 1000, y: 1000, z: 2000 },
    },
  ]
}
