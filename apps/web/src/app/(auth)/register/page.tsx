'use client'

import { ApiError, auth } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@civilcode/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await auth.register({ full_name: fullName, email, password })
      await auth.login({ email, password })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cc-fade-up">
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-cc-gray-900 tracking-tight dark:text-white">
          Crea tu cuenta
        </h1>
        <p className="mt-1 text-cc-gray-500 text-sm">
          Empieza gratis. Tu organización personal se crea automáticamente.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="cc-label-mono">
                Nombre completo
              </Label>
              <Input
                id="full_name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Frank Vidales"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="cc-label-mono">
                Correo
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="cc-label-mono">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-cc-gray-500 text-xs">Mínimo 8 caracteres.</p>
            </div>
            {error && (
              <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm dark:bg-cc-danger-500/20 dark:text-cc-danger-500">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Crear cuenta
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-cc-gray-500 text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-cc-cyan-600 hover:underline dark:text-cc-cyan-400"
        >
          Inicia sesión →
        </Link>
      </p>
    </div>
  )
}
