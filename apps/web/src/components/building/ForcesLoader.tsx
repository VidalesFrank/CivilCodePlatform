'use client'

import {
  ApiError,
  type BuildingRevision,
  type ForcesSummary,
  buildings as buildingsApi,
} from '@/lib/api'
import { Badge } from '@civilcode/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

type StatusKind = 'none' | 'queued' | 'importing' | 'loaded' | 'invalid'

export function ForcesLoader({
  buildingId,
  revision,
  onChanged,
}: {
  buildingId: string
  revision: BuildingRevision
  onChanged?: () => void | Promise<void>
}) {
  const [summary, setSummary] = useState<ForcesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const s = await buildingsApi.getForcesSummary(buildingId, revision.id)
      setSummary(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }, [buildingId, revision.id])

  useEffect(() => {
    void load()
  }, [load])

  // Polling mientras esté queued o importing.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const active =
      summary?.status === 'queued' || summary?.status === 'importing'
    if (active && !pollingRef.current) {
      pollingRef.current = setInterval(() => void load(), 1500)
    } else if (!active && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
      // Notifica al padre para refrescar la revisión al terminar
      void onChanged?.()
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [summary?.status, load, onChanged])

  async function onPick(file: File) {
    setUploading(true)
    setError(null)
    try {
      await buildingsApi.uploadForces(buildingId, revision.id, file)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const status: StatusKind = summary?.status ?? 'none'
  const isLoaded = status === 'loaded'
  const isBusy = status === 'queued' || status === 'importing' || uploading
  const isInvalid = status === 'invalid'

  const badgeVariant: 'success' | 'info' | 'warning' | 'danger' | 'neutral' =
    isLoaded ? 'success' : isBusy ? 'info' : isInvalid ? 'danger' : 'neutral'
  const badgeText =
    status === 'loaded'
      ? 'Demandas cargadas'
      : status === 'queued'
        ? 'Encolado'
        : status === 'importing'
          ? 'Procesando…'
          : status === 'invalid'
            ? 'Error'
            : 'Sin demandas'

  return (
    <div className="rounded-lg border border-cc-gray-200 bg-white p-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onPick(f)
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'color-mix(in srgb, #0ea5e9 14%, transparent)',
              color: '#0ea5e9',
              border: '1px solid color-mix(in srgb, #0ea5e9 30%, transparent)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 3h18v18H3zM3 9h18M9 3v18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">
                Demandas de diseño (XLSX de ETABS)
              </p>
              <Badge variant={badgeVariant}>{badgeText}</Badge>
            </div>
            <p className="mt-1 text-cc-gray-500 text-xs">
              Hoja <code className="font-mono">Element Forces - Beams</code> con M3, V2 y
              estaciones por elemento y combo. Se linkean por Unique Name.
            </p>
            {loading ? (
              <p className="mt-2 text-cc-gray-400 text-xs">Consultando estado…</p>
            ) : summary?.status === 'loaded' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <StatPill label="registros" value={summary.n_records} />
                <StatPill label="elementos" value={summary.n_elements_with_forces} />
                <StatPill label="casos" value={summary.n_load_cases} />
                {summary.load_cases.length > 0 && (
                  <span
                    className="truncate text-cc-gray-500"
                    title={summary.load_cases.join(', ')}
                    style={{ maxWidth: '26ch' }}
                  >
                    {summary.load_cases.slice(0, 3).join(', ')}
                    {summary.load_cases.length > 3
                      ? ` +${summary.load_cases.length - 3}`
                      : ''}
                  </span>
                )}
              </div>
            ) : summary?.notes ? (
              <p
                className={`mt-2 text-xs ${
                  status === 'invalid'
                    ? 'text-cc-danger-600 dark:text-cc-danger-500'
                    : 'text-cc-gray-500'
                }`}
              >
                {summary.notes}
              </p>
            ) : null}
            {error && (
              <p className="mt-2 rounded-md bg-cc-danger-100 px-2 py-1 text-cc-danger-600 text-xs">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className="cc-cta-blue !px-3 !py-2 !text-[12.5px]"
          >
            {uploading ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
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
                Subiendo…
              </>
            ) : isLoaded ? (
              <>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 3v10M3 8h10"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Reemplazar
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 11V3m0 0l-3 3m3-3l3 3M3 13h10"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Cargar Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-md border border-cc-gray-200 bg-cc-gray-50 px-2 py-0.5 text-cc-gray-700 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-300">
      <span className="font-mono font-bold text-cc-cyan-600 dark:text-cc-cyan-400">
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-cc-gray-400">
        {label}
      </span>
    </span>
  )
}
