'use client'

import { ArrowRightIcon, PlusIcon } from '@/components/shell/nav-icons'
import { Breadcrumb } from '@/components/shell/Breadcrumb'
import {
  ApiError,
  type Project,
  projects as projectsApi,
} from '@/lib/api'
import { projectPalette } from '@/lib/project-colors'
import { Badge, Skeleton } from '@civilcode/ui'
import Link from 'next/link'
import { useEffect, useState, type ComponentType } from 'react'

export interface ModuleHubProps {
  slug: string
  title: string
  tagline: string
  status: 'ready' | 'beta' | 'soon'
  phase: string
  accent: string
  Icon: ComponentType<{ size?: number; className?: string }>
  highlights: { label: string; value: string }[]
  openTab?: 'model' | 'design' | 'analysis'
}

export function ModuleHub({
  slug,
  title,
  tagline,
  status,
  phase,
  accent,
  Icon,
  highlights,
  openTab = 'design',
}: ModuleHubProps) {
  const [list, setList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsApi
      .list()
      .then(setList)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
  }, [])

  const statusBadge =
    status === 'ready' ? (
      <Badge variant="success">Listo · NSR-10</Badge>
    ) : status === 'beta' ? (
      <Badge variant="info">Beta</Badge>
    ) : (
      <Badge variant="neutral">Pronto</Badge>
    )

  return (
    <div>
      <section className="border-cc-gray-200 border-b bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Breadcrumb
            items={[
              { href: '/dashboard', label: 'Dashboard' },
              { label: title },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-start gap-5">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: accent,
                border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
              }}
            >
              <Icon size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl tracking-tight dark:text-white">
                  {title}
                </h1>
                {statusBadge}
              </div>
              <p className="mt-1.5 max-w-2xl text-cc-gray-500 text-sm">{tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="cc-label-mono text-[10px]">{phase}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {highlights.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h) => (
              <div key={h.label} className="cc-panel py-4">
                <p className="cc-label-mono text-[10px]">{h.label}</p>
                <p className="mt-1.5 font-mono font-bold text-cc-gray-900 text-base dark:text-white">
                  {h.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="cc-panel">
          <div className="cc-panel-title">
            <h3>Abrir en un proyecto</h3>
            <Link
              href="/projects?new=1"
              className="inline-flex items-center gap-1 font-medium text-cc-cyan-600 text-xs hover:underline dark:text-cc-cyan-400"
            >
              <PlusIcon size={12} /> Nuevo proyecto
            </Link>
          </div>
          <p className="-mt-2 mb-4 text-cc-gray-500 text-xs">
            {slug === 'analysis'
              ? 'Los análisis se corren sobre una revisión importada de un edificio.'
              : 'Los diseños se disparan desde una revisión importada dentro de un proyecto.'}
          </p>

          {error && (
            <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
              {error}
            </p>
          )}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="cc-empty !py-10">
              <span className="cc-empty-icon">
                <PlusIcon size={22} />
              </span>
              <h3 className="font-bold text-cc-gray-900 text-base dark:text-white">
                Aún no tienes proyectos
              </h3>
              <p className="mx-auto mt-2 max-w-md text-cc-gray-500 text-xs">
                Crea uno y sube un modelo ETABS para empezar a usar este módulo.
              </p>
              <Link href="/projects?new=1" className="mt-5 inline-flex cc-cta-primary">
                <PlusIcon size={14} /> Crear proyecto
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => {
                const palette = projectPalette(p.code || p.id, p.id)
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}?tab=${openTab}`}
                    className="group flex items-center gap-3 rounded-lg border border-cc-gray-200 bg-white p-3 transition-all hover:border-cc-cyan-500/50 hover:bg-cc-cyan-500/5 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:hover:border-cc-cyan-500/40"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${palette.c1} 0%, ${palette.c2} 100%)`,
                      }}
                    >
                      {p.code.slice(0, 3)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-cc-gray-900 text-sm dark:text-white">
                        {p.name}
                      </p>
                      <p className="truncate text-cc-gray-500 text-xs">
                        {p.code} · {p.client || 'Sin cliente'}
                      </p>
                    </div>
                    <ArrowRightIcon
                      size={16}
                      className="text-cc-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-cc-cyan-500"
                    />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
