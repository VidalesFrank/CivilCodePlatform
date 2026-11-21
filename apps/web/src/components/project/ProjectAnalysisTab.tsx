'use client'

import { AnalysisPanel } from '@/components/building/AnalysisPanel'
import {
  ApiError,
  type Building,
  type BuildingDetail,
  type BuildingRevision,
  buildings as buildingsApi,
} from '@/lib/api'
import { Badge, Skeleton } from '@civilcode/ui'
import { useEffect, useState } from 'react'

export function ProjectAnalysisTab({ projectId }: { projectId: string }) {
  const [buildings, setBuildings] = useState<Building[]>([])
  const [details, setDetails] = useState<Record<string, BuildingDetail>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  useEffect(() => {
    buildingsApi
      .listByProject(projectId)
      .then(async (list) => {
        setBuildings(list)
        const results = await Promise.all(
          list.map((b) => buildingsApi.get(b.id).catch(() => null)),
        )
        const map: Record<string, BuildingDetail> = {}
        list.forEach((b, i) => {
          const d = results[i]
          if (d) map[b.id] = d
        })
        setDetails(map)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">{error}</p>
    )
  }

  // Revisiones imported de todos los buildings, flat
  const importedRows: { building: Building; revision: BuildingRevision }[] = []
  for (const b of buildings) {
    const d = details[b.id]
    if (!d) continue
    for (const r of d.revisions) {
      if (r.status === 'imported') importedRows.push({ building: b, revision: r })
    }
  }

  if (importedRows.length === 0) {
    return (
      <div className="cc-empty">
        <span className="cc-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3v18M3 12h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <h3 className="font-bold text-cc-gray-900 text-xl tracking-tight dark:text-white">
          Aún no hay revisiones importadas
        </h3>
        <p className="mx-auto mt-2 max-w-md text-cc-gray-500 text-sm">
          Para correr un análisis necesitas al menos una revisión ETABS importada. Súbela desde el
          tab <strong>Modelo 3D</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="cc-panel">
        <div className="cc-panel-title">
          <h3>Análisis preliminar (quick check)</h3>
          <span className="cc-label-mono text-[10px]">{importedRows.length} revisiones</span>
        </div>
        <p className="-mt-1 mb-4 text-cc-gray-500 text-xs">
          Métricas geométricas, masa por nivel, conteo de elementos y chequeos de consistencia.
          Sin OpenSees — modal/espectral vienen en Fase 2b.
        </p>

        <div className="space-y-3">
          {importedRows.map(({ building, revision }) => {
            const key = `${building.id}:${revision.id}`
            const isOpen = openKey === key
            return (
              <div
                key={key}
                className="rounded-lg border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900"
              >
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cc-gray-50 dark:hover:bg-cc-navy-800/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: 'color-mix(in srgb, #8b5cf6 14%, transparent)',
                        color: '#8b5cf6',
                        border: '1px solid color-mix(in srgb, #8b5cf6 30%, transparent)',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M3 20h18M5 20V9l4-3 4 3 4-5 2 2v14"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cc-gray-900 text-sm dark:text-white">
                        {building.name}
                      </p>
                      <p className="truncate text-cc-gray-500 text-xs">
                        Revisión #{revision.revision_number} ·{' '}
                        <span className="font-mono">{revision.source}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="success">imported</Badge>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <path
                        d="m6 9 6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-cc-gray-200 border-t px-4 py-4 dark:border-cc-navy-700">
                    <AnalysisPanel buildingId={building.id} revisionId={revision.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
