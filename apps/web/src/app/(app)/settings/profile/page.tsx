'use client'

import { ApiError, type UserPublic, auth } from '@/lib/api'
import { Button, Card, CardContent, CardTitle, Input, Label, Skeleton } from '@civilcode/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
      setMessage({
        kind: 'err',
        text: err instanceof ApiError ? err.message : 'Error de red',
      })
    } finally {
      setSaving(false)
    }
  }

  async function onLogout() {
    await auth.logout()
    router.push('/login')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="mb-4 text-base">Información personal</CardTitle>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <form onSubmit={onSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" value={user?.email ?? ''} disabled />
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
              <Button type="submit" loading={saving}>
                Guardar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <CardTitle className="mb-2 text-base">Sesión</CardTitle>
          <p className="mb-4 text-cc-gray-500 text-sm">
            Cerrar sesión limpiará las cookies de autenticación de este navegador.
          </p>
          <Button variant="outline" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
