'use client'

import { type UserPublic, auth } from '@/lib/api'
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@civilcode/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

function getInitials(fullName: string | undefined): string {
  if (!fullName) return '??'
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export interface TopBarProps {
  onMenuClick?: () => void
  onSidebarToggle?: () => void
  sidebarCollapsed?: boolean
  breadcrumb?: BreadcrumbItem[]
}

export function TopBar({
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed,
  breadcrumb,
}: TopBarProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function onLogout() {
    try {
      await auth.logout()
    } finally {
      router.push('/login')
    }
  }

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between border-cc-gray-200 border-b px-3 sm:px-4 dark:border-cc-navy-700 cc-glass"
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {/* Hamburger mobile */}
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-cc-gray-600 hover:bg-cc-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 md:hidden dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Toggle sidebar collapse (desktop) */}
        {onSidebarToggle && (
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            onClick={onSidebarToggle}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-cc-gray-600 hover:bg-cc-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 md:inline-flex dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {sidebarCollapsed ? (
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 6l6 6-6 6"
                />
              ) : (
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 6l-6 6 6 6"
                />
              )}
            </svg>
          </button>
        )}

        <Link
          href="/dashboard"
          className="flex items-center gap-2 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1 rounded-sm"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
              boxShadow: '0 4px 12px -4px rgba(34,211,238,0.55)',
            }}
          >
            CC
          </span>
          <span className="truncate font-semibold text-cc-navy-900 text-lg tracking-tight dark:text-white">
            CivilCode <span className="text-cc-cyan-600 dark:text-cc-cyan-400">Studio</span>
          </span>
        </Link>

        {/* Breadcrumb (oculto en mobile) */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="hidden min-w-0 items-center lg:flex">
            <span className="cc-breadcrumb-sep" aria-hidden>·</span>
            <div className="min-w-0 truncate">
              <Breadcrumb items={breadcrumb} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {loading ? (
          <Skeleton className="h-9 w-9 rounded-full" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                aria-label="Menú de usuario"
                className="flex items-center gap-2 rounded-md p-1 hover:bg-cc-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 dark:hover:bg-cc-navy-800"
              >
                <Avatar>
                  <AvatarFallback>{getInitials(user?.full_name)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-cc-gray-700 text-sm sm:inline dark:text-cc-gray-200">
                  {user?.full_name ?? 'Usuario'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <div className="px-2 py-2">
                <p className="truncate font-medium text-cc-gray-900 text-sm dark:text-white">
                  {user?.full_name ?? 'Usuario'}
                </p>
                <p className="truncate text-cc-gray-500 text-xs">{user?.email ?? '—'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push('/settings/profile')}>
                Mi perfil
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/settings/organization')}>
                Organización
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onLogout}
                className="text-cc-danger-600 hover:bg-cc-danger-100 dark:hover:bg-cc-danger-600/10"
              >
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
