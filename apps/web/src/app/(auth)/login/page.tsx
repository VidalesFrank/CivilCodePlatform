'use client'

import { ApiError, auth } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@civilcode/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
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
          Bienvenido de vuelta
        </h1>
        <p className="mt-1 text-cc-gray-500 text-sm">
          Inicia sesión para continuar con tus diseños.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm dark:bg-cc-danger-500/20 dark:text-cc-danger-500">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-cc-gray-500 text-sm">
        ¿Sin cuenta?{' '}
        <Link
          href="/register"
          className="font-medium text-cc-cyan-600 hover:underline dark:text-cc-cyan-400"
        >
          Crea una ahora →
        </Link>
      </p>
    </div>
  )
}
