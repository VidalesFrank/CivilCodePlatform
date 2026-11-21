'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Plotly: any
  }
}

export interface BarRun {
  layer: 'top' | 'bot'
  kind: 'continuous' | 'baston_apoyo' | 'baston_vano'
  bar: string
  n_bars: number
  start_m: number
  end_m: number
  length_m: number
  hook_left_mm: number
  hook_right_mm: number
  notes: string
}

export interface StirrupZone {
  span_offset_m: number
  span_end_m: number
  bar: string | null
  zone_conf_left_m: [number, number]
  zone_conf_right_m: [number, number]
  spacing_confined_cm: number | null
  spacing_general_cm: number | null
  governing?: string
}

export interface BeamLayout {
  group_id: string
  total_length_m: number
  section: { b_cm: number; h_cm: number; d_cm: number }
  ductility: string
  ld_top_mm: number
  ld_bot_mm: number
  lap_class_B_top_mm: number
  lap_class_B_bot_mm: number
  hook_length_top_mm: number
  hook_length_bot_mm: number
  continuous_top: { bar: string; n_bars: number }
  continuous_bot: { bar: string; n_bars: number }
  runs: BarRun[]
  commercial_pieces: {
    layer: 'top' | 'bot'
    bar: string
    start_m: number
    end_m: number
    piece_length_m: number
    splice_right: boolean
  }[]
  stirrup_zones: StirrupZone[]
  total_steel_kg: number
  warnings: string[]
}

export function BeamElevationView({
  layout,
  supports_m,
}: {
  layout: BeamLayout
  supports_m: number[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.Plotly) {
      setPlotlyReady(true)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
    s.onload = () => setPlotlyReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!plotlyReady || !ref.current) return
    const Plotly = window.Plotly

    const L = layout.total_length_m
    const h = layout.section.h_cm / 100.0 // altura en m para eje Y
    // Dibujamos en coords: X = posición (m), Y = altura (m)
    // Contorno de la viga
    const yTop = h
    const yBot = 0
    const topBarY = h - 0.08
    const botBarY = 0.08

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = []

    // Contorno viga
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: [0, L, L, 0, 0],
      y: [yBot, yBot, yTop, yTop, yBot],
      line: { color: 'rgba(100,116,139,0.55)', width: 1.5 },
      fill: 'toself',
      fillcolor: 'rgba(148,163,184,0.08)',
      hoverinfo: 'skip',
      showlegend: false,
    })

    // Líneas verticales en apoyos (con triángulo de soporte)
    for (const sx of supports_m) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [sx, sx],
        y: [-h * 0.15, yTop + h * 0.1],
        line: { color: 'rgba(14,165,233,0.55)', width: 1, dash: 'dot' },
        hoverinfo: 'skip',
        showlegend: false,
      })
      // Triángulo apoyo debajo
      const tw = h * 0.12
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: [sx - tw, sx + tw, sx, sx - tw],
        y: [-h * 0.18, -h * 0.18, -h * 0.03, -h * 0.18],
        line: { color: '#0ea5e9', width: 1.5 },
        fill: 'toself',
        fillcolor: 'rgba(14,165,233,0.25)',
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    // Zonas de estribos (líneas verticales dentro de la viga)
    for (const z of layout.stirrup_zones) {
      const drawZone = (x0: number, x1: number, spacing_cm: number | null, confined: boolean) => {
        if (!spacing_cm || spacing_cm < 2) return
        const s = spacing_cm / 100.0
        const color = confined ? '#f59e0b' : 'rgba(100,116,139,0.6)'
        const dash = confined ? 'solid' : 'solid'
        let x = x0
        while (x <= x1 + 1e-6) {
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: [x, x],
            y: [yBot + 0.02, yTop - 0.02],
            line: { color, width: confined ? 1.2 : 0.8, dash },
            hoverinfo: 'skip',
            showlegend: false,
          })
          x += s
        }
      }
      drawZone(z.zone_conf_left_m[0], z.zone_conf_left_m[1], z.spacing_confined_cm, true)
      drawZone(z.zone_conf_right_m[0], z.zone_conf_right_m[1], z.spacing_confined_cm, true)
      // Zona general entre las dos confinadas
      const genStart = z.zone_conf_left_m[1]
      const genEnd = z.zone_conf_right_m[0]
      if (genEnd > genStart) {
        drawZone(genStart, genEnd, z.spacing_general_cm, false)
      }
    }

    // Barras longitudinales — una línea por run
    const colorFor = (r: BarRun): string => {
      if (r.kind === 'continuous') return r.layer === 'top' ? '#ef4444' : '#0ea5e9'
      if (r.kind === 'baston_apoyo') return '#dc2626'
      return '#0369a1'
    }
    // Para evitar superposición, separamos ligeramente las runs con el mismo layer
    const topRuns = layout.runs.filter((r) => r.layer === 'top')
    const botRuns = layout.runs.filter((r) => r.layer === 'bot')
    const offsetTop = 0.015 // m
    const offsetBot = 0.015

    const drawRun = (r: BarRun, yOffset: number) => {
      const y = r.layer === 'top' ? topBarY + yOffset : botBarY + yOffset
      const c = colorFor(r)
      const dash = r.kind === 'continuous' ? 'solid' : 'solid'
      const width = r.kind === 'continuous' ? 2.5 : 2
      const hookSize = 0.08 // altura del gancho en m
      const xs: (number | null)[] = []
      const ys: (number | null)[] = []
      // Gancho izquierdo (si existe)
      if (r.hook_left_mm > 0) {
        xs.push(r.start_m, r.start_m)
        ys.push(y, r.layer === 'top' ? y - hookSize : y + hookSize)
        xs.push(null)
        ys.push(null)
      }
      xs.push(r.start_m, r.end_m)
      ys.push(y, y)
      if (r.hook_right_mm > 0) {
        xs.push(null, r.end_m, r.end_m)
        ys.push(null, y, r.layer === 'top' ? y - hookSize : y + hookSize)
      }
      const label = `${r.n_bars}${r.bar} · ${r.length_m.toFixed(2)}m · ${
        r.kind === 'continuous'
          ? 'corrida'
          : r.kind === 'baston_apoyo'
            ? 'bastón apoyo'
            : 'bastón vano'
      }`
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: xs,
        y: ys,
        line: { color: c, width, dash },
        name: label,
        hovertemplate: `${label}<extra></extra>`,
        showlegend: false,
      })
      // Etiqueta
      const xmid = (r.start_m + r.end_m) / 2
      const ylab = r.layer === 'top' ? y + 0.035 : y - 0.035
      traces.push({
        type: 'scatter',
        mode: 'text',
        x: [xmid],
        y: [ylab],
        text: [`${r.n_bars}${r.bar}`],
        textposition: r.layer === 'top' ? 'top center' : 'bottom center',
        textfont: {
          size: 10,
          color: c,
          family: 'var(--font-mono)',
        },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    topRuns.forEach((r, i) => drawRun(r, i * offsetTop))
    botRuns.forEach((r, i) => drawRun(r, -i * offsetBot))

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark'

    Plotly.react(
      ref.current,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 44, r: 10, t: 12, b: 30 },
        xaxis: {
          title: { text: 'x (m)', font: { size: 10 } },
          range: [-0.3, L + 0.3],
          gridcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)',
          zerolinecolor: 'rgba(100,116,139,0.35)',
          color: isDark ? '#94a3b8' : '#475569',
        },
        yaxis: {
          title: { text: 'h (m)', font: { size: 10 } },
          range: [-h * 0.3, h + h * 0.3],
          gridcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)',
          scaleanchor: 'x',
          scaleratio: 1,
          color: isDark ? '#94a3b8' : '#475569',
        },
        font: { size: 10 },
      },
      { responsive: true, displayModeBar: false },
    )
  }, [plotlyReady, layout, supports_m])

  return (
    <div
      className="relative rounded-md border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900"
      style={{ height: 180 }}
    >
      {!plotlyReady && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-cc-gray-400">
          Cargando alzado…
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export function CrossSection({
  b_cm,
  h_cm,
  cover_cm = 4,
  top_bar,
  top_count,
  bot_bar,
  bot_count,
  stirrup_bar = '#3',
  label,
}: {
  b_cm: number
  h_cm: number
  cover_cm?: number
  top_bar: string
  top_count: number
  bot_bar: string
  bot_count: number
  stirrup_bar?: string
  label: string
}) {
  const barDb: Record<string, number> = {
    '#3': 9.5,
    '#4': 12.7,
    '#5': 15.9,
    '#6': 19.1,
    '#7': 22.2,
    '#8': 25.4,
  }
  const dbTop = (barDb[top_bar] ?? 12) / 10 // cm
  const dbBot = (barDb[bot_bar] ?? 12) / 10
  const dbSt = (barDb[stirrup_bar] ?? 9.5) / 10

  // Posiciones relativas al contorno
  const cRest = cover_cm + dbSt / 2 // borde interior del estribo + mitad de barra
  const yTop = h_cm - cRest - dbTop / 2
  const yBot = cRest + dbBot / 2

  const _xBars = (count: number, db: number): number[] => {
    const xStart = cRest + db / 2
    const xEnd = b_cm - cRest - db / 2
    if (count <= 1) return [(xStart + xEnd) / 2]
    const step = (xEnd - xStart) / (count - 1)
    return Array.from({ length: count }, (_, i) => xStart + i * step)
  }

  const topX = _xBars(top_count, dbTop)
  const botX = _xBars(bot_count, dbBot)

  // SVG: escalar a 160×160 px manteniendo aspect
  const maxDim = Math.max(b_cm, h_cm)
  const scale = 140 / maxDim
  const pad = 10
  const W = b_cm * scale + pad * 2
  const H = h_cm * scale + pad * 2

  const sx = (cm: number) => pad + cm * scale
  const sy = (cm: number) => H - pad - cm * scale
  const sr = (cm: number) => Math.max(1.5, (cm * scale) / 2)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="max-w-full">
        <title>{label}</title>
        {/* Concrete */}
        <rect
          x={pad}
          y={pad}
          width={b_cm * scale}
          height={h_cm * scale}
          fill="rgba(148,163,184,0.12)"
          stroke="#94a3b8"
          strokeWidth={1.2}
        />
        {/* Stirrup */}
        <rect
          x={pad + cover_cm * scale}
          y={pad + cover_cm * scale}
          width={(b_cm - 2 * cover_cm) * scale}
          height={(h_cm - 2 * cover_cm) * scale}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.2}
          rx={2}
        />
        {/* Top bars */}
        {topX.map((x, i) => (
          <circle
            key={`t${i}`}
            cx={sx(x)}
            cy={sy(yTop)}
            r={sr(dbTop)}
            fill="#ef4444"
            stroke="#7f1d1d"
            strokeWidth={0.6}
          />
        ))}
        {/* Bot bars */}
        {botX.map((x, i) => (
          <circle
            key={`b${i}`}
            cx={sx(x)}
            cy={sy(yBot)}
            r={sr(dbBot)}
            fill="#0ea5e9"
            stroke="#075985"
            strokeWidth={0.6}
          />
        ))}
      </svg>
      <div className="text-center text-[11px] text-cc-gray-600 dark:text-cc-gray-300">
        <p className="font-semibold">{label}</p>
        <p className="font-mono text-[10px] text-cc-gray-500">
          {b_cm.toFixed(0)}×{h_cm.toFixed(0)} cm
        </p>
        <p className="font-mono text-[10px]">
          <span className="text-cc-danger-600">
            {top_count}
            {top_bar}
          </span>{' '}
          /{' '}
          <span className="text-cc-blue-600 dark:text-cc-blue-400">
            {bot_count}
            {bot_bar}
          </span>{' '}
          · E{stirrup_bar}
        </p>
      </div>
    </div>
  )
}
