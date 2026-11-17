'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Skeleton,
} from '@civilcode/ui'
import { auth, type UserPublic } from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth
      .me()
      .then((u) => setUser(u))
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
            <Badge variant="info">Fase 0</Badge>
            <p className="text-cc-gray-600 text-sm dark:text-cc-gray-300">
              CivilCode Studio está en construcción. Pronto podrás crear proyectos, importar
              modelos ETABS y diseñar elementos estructurales desde este panel.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <CardTitle className="text-base">Proyectos</CardTitle>
            <CardDescription className="mt-1">0 activos</CardDescription>
            <Button variant="primary" size="sm" className="mt-4" disabled>
              Nuevo proyecto (próximamente)
            </Button>
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
    </div>
  )
}
