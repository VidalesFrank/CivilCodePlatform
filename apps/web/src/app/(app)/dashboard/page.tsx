'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
} from '@civilcode/ui'
import { auth, projects as projectsApi, type Project, type UserPublic } from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([auth.me(), projectsApi.list()])
      .then(([u, ps]) => {
        setUser(u)
        setProjects(ps)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function onLogout() {
    await auth.logout()
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-cc-gray-500 text-sm">Buen día,</p>
          <h1 className="font-bold text-3xl text-cc-gray-900 dark:text-white">
            {loading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              (user?.full_name ?? 'Ingeniero')
            )}
          </h1>
        </div>
        <Button variant="outline" onClick={onLogout}>
          Cerrar sesión
        </Button>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Badge variant="info">Fase 1</Badge>
            <p className="text-cc-gray-600 text-sm dark:text-cc-gray-300">
              CivilCode Studio está en construcción. Ya puedes crear proyectos; importación
              ETABS y visor 3D llegan en los próximos hitos.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <CardTitle className="text-base">Proyectos</CardTitle>
            <CardDescription className="mt-1">
              {loading ? '—' : `${projects.length} activos`}
            </CardDescription>
            <Link href="/projects">
              <Button variant="primary" size="sm" className="mt-4">
                Ver proyectos
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <CardTitle className="text-base">Jobs en ejecución</CardTitle>
            <CardDescription className="mt-1">—</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <CardTitle className="text-base">Documentos aprobados</CardTitle>
            <CardDescription className="mt-1">—</CardDescription>
          </CardContent>
        </Card>
      </div>

      {!loading && projects.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 font-semibold text-cc-gray-900 text-lg dark:text-white">
            Proyectos recientes
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <Badge variant="info">{p.code}</Badge>
                    <CardTitle className="mt-2 text-base">{p.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {p.client ?? 'Sin cliente'}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
