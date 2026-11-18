'use client'

import { type Project, type UserPublic, auth, projects as projectsApi } from '@/lib/api'
import { SheetIcon } from '@civilcode/icons'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
} from '@civilcode/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <p className="text-cc-gray-500 text-sm">Buen día,</p>
        <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl dark:text-white">
          {loading ? <Skeleton className="h-9 w-48" /> : (user?.full_name ?? 'Ingeniero')}
        </h1>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
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
            <p className="mt-4 text-cc-gray-400 text-xs">Próximamente.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <CardTitle className="text-base">Documentos</CardTitle>
            <CardDescription className="mt-1">—</CardDescription>
            <p className="mt-4 text-cc-gray-400 text-xs">Próximamente.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 sm:mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-cc-gray-900 text-lg dark:text-white">
            Proyectos recientes
          </h2>
          {!loading && projects.length > 0 && (
            <Link
              href="/projects"
              className="text-cc-blue-600 text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded"
            >
              Ver todos →
            </Link>
          )}
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <SheetIcon size={40} className="mx-auto mb-3 text-cc-gray-400" />
              <CardTitle className="text-base">Aún no tienes proyectos</CardTitle>
              <CardDescription className="mt-1">
                Crea el primero para comenzar a importar modelos y diseñar vigas.
              </CardDescription>
              <Link href="/projects">
                <Button variant="primary" size="sm" className="mt-4">
                  Crear proyecto
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-lg"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <Badge variant="info">{p.code}</Badge>
                    <CardTitle className="mt-2 text-base">{p.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {p.client ?? 'Sin cliente'}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
