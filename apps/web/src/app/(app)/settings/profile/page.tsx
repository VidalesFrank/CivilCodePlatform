'use client'

import { ApiError, type UserPublic, auth } from '@/lib/api'
import { LogOutIcon, SparkleIcon } from '@/components/shell/nav-icons'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
} from '@civilcode/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function initials(name: string | undefined) {
  if (!name) return '??'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    auth
      .me()
      .then((u) => {
        setUser(u)
        setFullName(u.full_name)
      })
      .finally(() => setLoading(false))
  }, [])

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const updated = await auth.updateMe({ full_name: fullName })
      setUser(updated)
      setMessage({ kind: 'ok', text: 'Perfil actualizado.' })
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof ApiError ? err.message : 'Error de red' })
    } finally {
      setSaving(false)
    }
  }

  async function onLogout() {
    await auth.logout()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="cc-panel flex flex-wrap items-center gap-5">
        <Avatar className="h-20 w-20 text-lg">
          <AvatarFallback>{initials(user?.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-cc-gray-900 text-lg tracking-tight dark:text-white">
              {user?.full_name}
            </h2>
            {user?.is_admin && <Badge variant="info">Admin</Badge>}
          </div>
          <p className="truncate text-cc-gray-500 text-sm">{user?.email}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="cc-label-mono text-[10px]">Plan</p>
          <p className="mt-1 font-mono text-cc-gray-900 text-sm dark:text-white">Beta</p>
        </div>
      </div>

      <div className="cc-panel">
        <div className="cc-panel-title">
          <h3>Información personal</h3>
          <span className="cc-label-mono text-[10px]">Datos de cuenta</span>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" value={user?.email ?? ''} disabled />
              <p className="text-cc-gray-400 text-xs">Contacta al soporte para cambiar el correo.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>
          {message && (
            <p
              className={
                message.kind === 'ok'
                  ? 'rounded-md bg-cc-success-100 px-3 py-2 text-cc-success-600 text-sm dark:bg-cc-success-500/20 dark:text-cc-success-500'
                  : 'rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm dark:bg-cc-danger-500/20 dark:text-cc-danger-500'
              }
            >
              {message.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>

      <div className="cc-panel">
        <div className="cc-panel-title">
          <h3>Seguridad</h3>
          <Badge variant="neutral">Pronto</Badge>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-cc-gray-100 p-3 dark:border-cc-navy-800">
            <div className="min-w-0">
              <p className="font-medium text-cc-gray-900 text-sm dark:text-white">Contraseña</p>
              <p className="text-cc-gray-500 text-xs">Actualiza tu contraseña periódicamente.</p>
            </div>
            <Button variant="ghost" size="sm" disabled>
              Cambiar
            </Button>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-cc-gray-100 p-3 dark:border-cc-navy-800">
            <div className="min-w-0">
              <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
                Tokens de API
              </p>
              <p className="text-cc-gray-500 text-xs">
                Para acceso programático (próximamente).
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled>
              Gestionar
            </Button>
          </div>
        </div>
      </div>

      <div className="cc-panel">
        <div className="cc-panel-title">
          <h3>Sesión</h3>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-cc-gray-900 text-sm dark:text-white">
              Este navegador
            </p>
            <p className="text-cc-gray-500 text-xs">
              Cerrar sesión limpiará las cookies de autenticación de este dispositivo.
            </p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOutIcon size={15} />
            Cerrar sesión
          </Button>
        </div>
      </div>

      <div className="cc-panel bg-gradient-to-br from-cc-cyan-500/5 to-cc-blue-500/5 dark:from-cc-cyan-500/10 dark:to-cc-blue-500/5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-cc-cyan-600 dark:text-cc-cyan-400"
            style={{ background: 'color-mix(in srgb, #22d3ee 14%, transparent)' }}
          >
            <SparkleIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">
              ¿Quieres feedback personalizado?
            </p>
            <p className="mt-0.5 text-cc-gray-500 text-xs">
              CivilCode Studio está en beta. Tu opinión como ingeniero estructural guía la hoja de
              ruta.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
