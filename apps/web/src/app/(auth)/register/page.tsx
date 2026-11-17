'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@civilcode/ui'
import { ApiError, auth } from '@/lib/api'

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
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
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
            <p className="rounded-md bg-cc-danger-100 px-3 py-2 text-cc-danger-600 text-sm">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Crear cuenta
          </Button>
          <p className="text-center text-cc-gray-500 text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-cc-blue-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
