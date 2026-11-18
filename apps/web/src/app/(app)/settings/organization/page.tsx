'use client'

import {
  ApiError,
  type Member,
  type OrganizationWithRole,
  organizations as orgsApi,
} from '@/lib/api'
import {
  Badge,
  Card,
  CardContent,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@civilcode/ui'
import { useEffect, useState } from 'react'

export default function OrganizationSettingsPage() {
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [selected, setSelected] = useState<OrganizationWithRole | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    orgsApi
      .list()
      .then((list) => {
        setOrgs(list)
        if (list.length > 0) setSelected(list[0])
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    setMembers([])
    orgsApi
      .members(selected.id)
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
  }, [selected])

  if (loading) {
    return <Skeleton className="h-32 w-full" />
  }

  if (error) {
    return <p className="text-cc-danger-600 text-sm">{error}</p>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <CardTitle className="mb-4 text-base">Mis organizaciones</CardTitle>
          <div className="flex flex-wrap gap-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className={
                  selected?.id === o.id
                    ? 'rounded-md bg-cc-blue-600 px-3 py-1.5 font-medium text-sm text-white'
                    : 'rounded-md border border-cc-gray-200 px-3 py-1.5 font-medium text-cc-gray-700 text-sm hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800'
                }
              >
                {o.name}
                {o.is_personal && <span className="ml-2 text-xs opacity-70">(personal)</span>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{selected.name}</CardTitle>
                <p className="mt-1 text-cc-gray-500 text-sm">
                  slug: <code className="font-mono text-xs">{selected.slug}</code> ·{' '}
                  {selected.is_personal ? 'Personal' : 'Compartida'} · tu rol:{' '}
                  <Badge variant="info">{selected.role}</Badge>
                </p>
              </div>
            </div>

            <h3 className="mb-2 font-medium text-cc-gray-700 text-sm dark:text-cc-gray-300">
              Miembros ({members.length})
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.full_name}</TableCell>
                    <TableCell className="text-cc-gray-500">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === 'owner' ? 'success' : 'info'}>{m.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
