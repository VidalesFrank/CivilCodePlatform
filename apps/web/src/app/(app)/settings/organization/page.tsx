'use client'

import {
  ApiError,
  type Member,
  type OrganizationWithRole,
  organizations as orgsApi,
} from '@/lib/api'
import { PlusIcon, UsersIcon } from '@/components/shell/nav-icons'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Skeleton,
  cn,
} from '@civilcode/ui'
import { useEffect, useState } from 'react'

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '??'
}

function orgBadge(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'CC'
}

export default function OrganizationSettingsPage() {
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [selected, setSelected] = useState<OrganizationWithRole | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)

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
    setMembersLoading(true)
    orgsApi
      .members(selected.id)
      .then(setMembers)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Error de red'))
      .finally(() => setMembersLoading(false))
  }, [selected])

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <p className="text-cc-danger-600 text-sm">{error}</p>
  }

  return (
    <div className="space-y-5">
      <div className="cc-panel">
        <div className="cc-panel-title">
          <h3>Tus organizaciones</h3>
          <span className="cc-label-mono text-[10px]">{orgs.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {orgs.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o)}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                selected?.id === o.id
                  ? 'border-cc-cyan-500/50 bg-cc-cyan-500/10 shadow-[0_0_0_1px_var(--tech-cyan)]'
                  : 'border-cc-gray-200 bg-white hover:border-cc-gray-300 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:hover:bg-cc-navy-800',
              )}
            >
              <span className="cc-org-avatar">{orgBadge(o.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-cc-gray-900 text-sm dark:text-white">
                  {o.name}
                </span>
                <span className="block truncate text-cc-gray-500 text-xs">
                  {o.is_personal ? 'Personal' : `Compartida · ${o.role}`}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled
            className="flex items-center gap-3 rounded-lg border border-cc-gray-200 border-dashed bg-cc-gray-50/50 px-3 py-2.5 text-cc-gray-400 opacity-80 dark:border-cc-navy-700 dark:bg-cc-navy-800/30"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cc-gray-200 dark:bg-cc-navy-700">
              <PlusIcon size={14} />
            </span>
            <span className="text-sm">Nueva organización (pronto)</span>
          </button>
        </div>
      </div>

      {selected && (
        <>
          <div className="cc-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="cc-org-avatar h-10 w-10 text-sm">{orgBadge(selected.name)}</span>
                <div>
                  <h2 className="font-semibold text-cc-gray-900 text-base dark:text-white">
                    {selected.name}
                  </h2>
                  <p className="mt-0.5 text-cc-gray-500 text-xs">
                    slug: <code className="font-mono text-[11px]">{selected.slug}</code> ·{' '}
                    {selected.is_personal ? 'Personal' : 'Compartida'}
                  </p>
                </div>
              </div>
              <Badge variant={selected.role === 'owner' ? 'success' : 'info'}>
                Tu rol: {selected.role}
              </Badge>
            </div>
          </div>

          <div className="cc-panel">
            <div className="cc-panel-title">
              <h3 className="flex items-center gap-2">
                <UsersIcon size={15} />
                Miembros
              </h3>
              <div className="flex items-center gap-2">
                <span className="cc-label-mono text-[10px]">{members.length}</span>
                <Button variant="outline" size="sm" disabled>
                  <PlusIcon size={13} />
                  Invitar (pronto)
                </Button>
              </div>
            </div>
            {membersLoading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-cc-gray-500 text-sm">
                Esta organización no tiene miembros activos.
              </p>
            ) : (
              <ul className="divide-y divide-cc-gray-100 dark:divide-cc-navy-800">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <Avatar>
                      <AvatarFallback>{initialsOf(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-cc-gray-900 text-sm dark:text-white">
                        {m.full_name}
                      </p>
                      <p className="truncate text-cc-gray-500 text-xs">{m.email}</p>
                    </div>
                    <Badge variant={m.role === 'owner' ? 'success' : 'info'}>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
