'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
} from '@civilcode/ui'
import { BeamIcon, ColumnIcon, SheetIcon, WallIcon } from '@civilcode/icons'
import { ApiError, projects as projectsApi, type Project } from '@/lib/api'
import { BuildingsPanel } from '@/components/project/BuildingsPanel'

type Tab = 'overview' | 'model' | 'analysis' | 'design' | 'documents'

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    projectsApi
      .get(id)
      .then(setProject)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Error de red'),
      )
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <p className="text-cc-danger-600">{error ?? 'Proyecto no encontrado'}</p>
        <Link href="/projects" className="text-cc-blue-600 text-sm hover:underline">
          Volver a proyectos
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link
          href="/projects"
          className="text-cc-blue-600 text-sm hover:underline"
        >
          ← Proyectos
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant="info">{project.code}</Badge>
          <h1 className="font-bold text-3xl text-cc-gray-900 dark:text-white">
            {project.name}
          </h1>
        </div>
        <p className="mt-1 text-cc-gray-500 text-sm">
          {project.client ?? 'Sin cliente'} · {project.location ?? 'Sin ubicación'}
        </p>
      </div>

      <nav className="mb-6 flex gap-1 border-cc-gray-200 border-b dark:border-cc-navy-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={
              activeTab === t.id
                ? 'border-cc-blue-600 border-b-2 px-4 py-2 font-medium text-cc-blue-600 text-sm'
                : 'border-transparent border-b-2 px-4 py-2 font-medium text-cc-gray-500 text-sm hover:text-cc-gray-700 dark:hover:text-cc-gray-300'
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && <OverviewTab project={project} />}
      {activeTab === 'model' && <BuildingsPanel projectId={project.id} />}
      {activeTab === 'analysis' && <PlaceholderTab title="Análisis" phase="Fase 2" />}
      {activeTab === 'design' && <DesignTab />}
      {activeTab === 'documents' && <PlaceholderTab title="Documentos" phase="Fase 4-6" />}
    </div>
  )
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'model', label: 'Modelo 3D' },
  { id: 'analysis', label: 'Análisis' },
  { id: 'design', label: 'Diseño' },
  { id: 'documents', label: 'Documentos' },
]

function OverviewTab({ project }: { project: Project }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="text-base">Información</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Código" value={project.code} />
            <Row label="Nombre" value={project.name} />
            <Row label="Cliente" value={project.client ?? '—'} />
            <Row label="Ubicación" value={project.location ?? '—'} />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="text-base">Descripción</CardTitle>
          <CardDescription className="mt-2">
            {project.description ?? 'Sin descripción. Agrega una desde edición del proyecto.'}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-cc-gray-500">{label}</dt>
      <dd className="text-cc-gray-900 dark:text-white">{value}</dd>
    </div>
  )
}

function PlaceholderTab({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <SheetIcon size={48} className="mx-auto mb-4 text-cc-gray-400" />
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="mt-2">{phase}</CardDescription>
      </CardContent>
    </Card>
  )
}

function DesignTab() {
  const MODULES = [
    { href: '/design/beams', label: 'Vigas', Icon: BeamIcon, phase: 'Fase 3' },
    { href: '/design/columns', label: 'Columnas', Icon: ColumnIcon, phase: 'Fase 5' },
    { href: '/design/walls', label: 'Muros', Icon: WallIcon, phase: 'Fase 5' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {MODULES.map(({ href, label, Icon, phase }) => (
        <Link key={href} href={href}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <Icon size={28} className="mb-3 text-cc-blue-600" />
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="mt-1">{phase}</CardDescription>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
