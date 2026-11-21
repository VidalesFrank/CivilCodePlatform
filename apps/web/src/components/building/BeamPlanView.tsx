'use client'

import type { BeamGroupPublic } from '@/lib/api'
import { useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Plotly: any
  }
}

export interface BeamPlanViewProps {
  groups: BeamGroupPublic[]
  selectedIds: Set<string>
  onToggle: (groupId: string) => void
  onlyShowSelected?: boolean
  height?: number
}

export function BeamPlanView({
  groups,
  selectedIds,
  onToggle,
  onlyShowSelected = false,
  height = 480,
}: BeamPlanViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [plotlyReady, setPlotlyReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  const bbox = useMemo(() => {
    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    for (const g of groups) {
      for (const sp of g.spans) {
        xMin = Math.min(xMin, sp.ni[0], sp.nj[0])
        xMax = Math.max(xMax, sp.ni[0], sp.nj[0])
        yMin = Math.min(yMin, sp.ni[1], sp.nj[1])
        yMax = Math.max(yMax, sp.ni[1], sp.nj[1])
      }
    }
    if (!Number.isFinite(xMin)) return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }
    const pad = 1.5
    return { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad }
  }, [groups])

  // biome-ignore lint/correctness/useExhaustiveDependencies: render is self-contained
  useEffect(() => {
    if (!plotlyReady || !ref.current) return
    const Plotly = window.Plotly

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = []
    const visibleGroups = onlyShowSelected
      ? groups.filter((g) => selectedIds.has(g.id))
      : groups

    // Traza una línea por grupo (uniendo todos sus spans) para click/hover
    for (const g of visibleGroups) {
      const sel = selectedIds.has(g.id)
      const hovered = hoveredId === g.id
      // Construye polilinea del grupo en orden de offsets
      const spans = [...g.spans].sort((a, b) => a.offset_m - b.offset_m)
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i < spans.length; i++) {
        const sp = spans[i]
        // Orientación: considera flipped para dibujar en el sentido del grupo
        const start = sp.flipped ? sp.nj : sp.ni
        const end = sp.flipped ? sp.ni : sp.nj
        if (i === 0) xs.push(start[0]), ys.push(start[1])
        xs.push(end[0])
        ys.push(end[1])
      }
      const color = sel ? '#0ea5e9' : '#94a3b8'
      const width = hovered ? 6 : sel ? 4 : 2
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: xs,
        y: ys,
        name: g.id,
        line: { color, width },
        marker: { size: sel ? 6 : 4, color, line: { color: '#ffffff', width: 1 } },
        customdata: Array(xs.length).fill(g.id),
        hovertemplate:
          `<b>${g.id}</b><br>` +
          `${g.n_spans} tramos · ${g.total_length_m.toFixed(2)} m<br>` +
          `${sel ? '✓ seleccionada' : 'click para seleccionar'}` +
          '<extra></extra>',
        showlegend: false,
      })
    }

    // Puntos de apoyo (uniones entre spans) por grupo
    for (const g of visibleGroups) {
      const sel = selectedIds.has(g.id)
      if (!sel) continue
      const sx: number[] = []
      const sy: number[] = []
      const spans = [...g.spans].sort((a, b) => a.offset_m - b.offset_m)
      if (spans.length > 1) {
        for (let i = 1; i < spans.length; i++) {
          const sp = spans[i]
          const start = sp.flipped ? sp.nj : sp.ni
          sx.push(start[0])
          sy.push(start[1])
        }
      }
      if (sx.length > 0) {
        traces.push({
          type: 'scatter',
          mode: 'markers',
          x: sx,
          y: sy,
          marker: { size: 8, symbol: 'square', color: '#f59e0b', line: { color: '#ffffff', width: 1 } },
          hoverinfo: 'skip',
          showlegend: false,
        })
      }
    }

    // Etiquetas de ID de grupo en el centro
    const lx: number[] = []
    const ly: number[] = []
    const lt: string[] = []
    for (const g of visibleGroups) {
      if (!selectedIds.has(g.id) && !hoveredId) continue
      const spans = [...g.spans].sort((a, b) => a.offset_m - b.offset_m)
      const mid = Math.floor(spans.length / 2)
      const sp = spans[mid]
      if (!sp) continue
      lx.push((sp.ni[0] + sp.nj[0]) / 2)
      ly.push((sp.ni[1] + sp.nj[1]) / 2)
      lt.push(g.id)
    }
    if (lx.length > 0) {
      traces.push({
        type: 'scatter',
        mode: 'text',
        x: lx,
        y: ly,
        text: lt,
        textposition: 'top center',
        textfont: { size: 10, color: '#0369a1', family: 'var(--font-mono)' },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark'

    Plotly.react(
      ref.current,
      traces,
      {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 40, r: 10, t: 10, b: 40 },
        xaxis: {
          title: { text: 'X (m)', font: { size: 10 } },
          range: [bbox.xMin, bbox.xMax],
          gridcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)',
          zerolinecolor: isDark ? 'rgba(34,211,238,0.35)' : 'rgba(14,165,233,0.4)',
          scaleanchor: 'y',
          scaleratio: 1,
          color: isDark ? '#94a3b8' : '#475569',
        },
        yaxis: {
          title: { text: 'Y (m)', font: { size: 10 } },
          range: [bbox.yMin, bbox.yMax],
          gridcolor: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)',
          zerolinecolor: isDark ? 'rgba(34,211,238,0.35)' : 'rgba(14,165,233,0.4)',
          color: isDark ? '#94a3b8' : '#475569',
        },
        font: { size: 11 },
      },
      { responsive: true, displayModeBar: true, displaylogo: false },
    )

    // Click handler
    const el = ref.current as unknown as {
      on?: (ev: string, h: (ev: unknown) => void) => void
      removeAllListeners?: (ev: string) => void
    }
    const clickHandler = (evt: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pts = (evt as any)?.points
      if (!pts || !pts.length) return
      const id = pts[0].customdata as string | undefined
      if (id) onToggle(id)
    }
    const hoverHandler = (evt: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pts = (evt as any)?.points
      if (!pts || !pts.length) return
      const id = pts[0].customdata as string | undefined
      if (id) setHoveredId(id)
    }
    const unhoverHandler = () => setHoveredId(null)
    el.on?.('plotly_click', clickHandler)
    el.on?.('plotly_hover', hoverHandler)
    el.on?.('plotly_unhover', unhoverHandler)
    return () => {
      el.removeAllListeners?.('plotly_click')
      el.removeAllListeners?.('plotly_hover')
      el.removeAllListeners?.('plotly_unhover')
    }
  }, [plotlyReady, groups, selectedIds, hoveredId, onlyShowSelected, bbox, onToggle])

  return (
    <div
      className="relative rounded-md border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900"
      style={{ height }}
    >
      {!plotlyReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-cc-gray-500">
          Cargando vista en planta…
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
