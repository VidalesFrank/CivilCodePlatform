'use client'

import { BuildingsPanel } from '@/components/project/BuildingsPanel'
import { ApiError, type Project, projects as projectsApi } from '@/lib/api'
import { BeamIcon, ColumnIcon, SheetIcon, WallIcon } from '@civilcode/icons'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@civilcode/ui'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'

type Tab = 'overview' | 'model' | 'analysis' | 'design' | 'documents'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'model', label: 'Modelo 3D' },
  { id: 'analysis', label: 'Análisis' },
  { id: 'design', label: 'Diseño' },
  { id: 'documents', label: 'Documentos' },
]

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsApi
      .get(id)
      .then(setProject)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <p className="text-cc-danger-600">{error ?? 'Proyecto no encontrado'}</p>
        <Link href="/projects" className="text-cc-blue-600 text-sm hover:underline">
          Volver a proyectos
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-sm">
          <Link
            href="/projects"
            className="text-cc-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1"
          >
            ← Proyectos
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">{project.code}</Badge>
          <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl dark:text-white">
            {project.name}
          </h1>
        </div>
        <p className="mt-1 text-cc-gray-500 text-sm">
          {project.client ?? 'Sin cliente'} · {project.location ?? 'Sin ubicación'}
        </p>
      </div>

      <Tabs defaultValue="overview" className="mb-4">
        <TabsList className="overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} />
        </TabsContent>
        <TabsContent value="model">
          <BuildingsPanel projectId={project.id} />
        </TabsContent>
        <TabsContent value="analysis">
          <PlaceholderTab title="Análisis" phase="Fase 2" />
        </TabsContent>
        <TabsContent value="design">
          <DesignTab />
        </TabsContent>
        <TabsContent value="documents">
          <PlaceholderTab title="Documentos" phase="Fase 4-6" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

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
        <Link
          key={href}
          href={href}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-lg"
        >
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
