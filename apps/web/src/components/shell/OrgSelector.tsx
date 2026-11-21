'use client'

import { type OrganizationWithRole, organizations } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@civilcode/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckIcon, ChevronDownIcon, PlusIcon, UsersIcon } from './nav-icons'

const SELECTED_KEY = 'cc-org-id'

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'CC'
}

export function OrgSelector() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([])
  const [selected, setSelected] = useState<OrganizationWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    organizations
      .list()
      .then((list) => {
        setOrgs(list)
        let picked: OrganizationWithRole | undefined
        try {
          const savedId = localStorage.getItem(SELECTED_KEY)
          if (savedId) picked = list.find((o) => o.id === savedId)
        } catch {
          /* ignore */
        }
        if (!picked) picked = list.find((o) => !o.is_personal) ?? list[0]
        setSelected(picked ?? null)
      })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false))
  }, [])

  function pick(org: OrganizationWithRole) {
    setSelected(org)
    try {
      localStorage.setItem(SELECTED_KEY, org.id)
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <div className="cc-skeleton h-8 w-32" />
  }

  if (!selected) {
    return (
      <button
        type="button"
        className="cc-org-trigger"
        onClick={() => router.push('/settings/organization')}
      >
        <span className="cc-org-avatar">CC</span>
        <span>Sin organización</span>
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" className="cc-org-trigger" aria-label="Cambiar de organización">
          <span className="cc-org-avatar">{initialsOf(selected.name)}</span>
          <span className="truncate font-medium">{selected.name}</span>
          <ChevronDownIcon size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[18rem]">
        <div className="px-2 pt-2 pb-1 cc-label-mono">Organizaciones</div>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => pick(org)}
            className="flex items-center gap-2"
          >
            <span className="cc-org-avatar">{initialsOf(org.name)}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate font-medium text-cc-gray-900 text-sm dark:text-white">
                {org.name}
              </span>
              <span className="block truncate text-cc-gray-500 text-xs">
                {org.is_personal ? 'Personal' : org.role}
              </span>
            </span>
            {selected.id === org.id && <CheckIcon size={14} />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push('/settings/organization')}
          className="flex items-center gap-2"
        >
          <UsersIcon size={15} />
          Gestionar organización
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => router.push('/settings/organization?new=1')}
          className="flex items-center gap-2 text-cc-cyan-600 dark:text-cc-cyan-400"
        >
          <PlusIcon size={15} />
          Nueva organización
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
