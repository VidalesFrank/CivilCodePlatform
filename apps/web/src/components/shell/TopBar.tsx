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
import { CommandPalette } from './CommandPalette'
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from './nav-icons'
import { OrgSelector } from './OrgSelector'
import { ThemeToggle } from './ThemeToggle'

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
}

export function TopBar({ onMenuClick, onSidebarToggle, sidebarCollapsed }: TopBarProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform))
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function onLogout() {
    try {
      await auth.logout()
    } finally {
      router.push('/login')
    }
  }

  const modKey = isMac ? '⌘' : 'Ctrl'

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-cc-gray-200 border-b px-3 sm:px-4 dark:border-cc-navy-700 cc-glass">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={onMenuClick}
            className="cc-icon-btn md:hidden"
          >
            <MenuIcon size={18} />
          </button>

          {onSidebarToggle && (
            <button
              type="button"
              aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              onClick={onSidebarToggle}
              className="hidden cc-icon-btn md:inline-flex"
            >
              {sidebarCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
            </button>
          )}

          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 truncate rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1"
          >
            <span className="cc-logo-badge" aria-hidden>CC</span>
            <span className="truncate font-semibold text-cc-navy-900 text-[15px] tracking-tight dark:text-white">
              CivilCode <span className="text-cc-cyan-600 dark:text-cc-cyan-400">Studio</span>
            </span>
          </Link>

          <span
            aria-hidden
            className="mx-1 hidden h-6 w-px bg-cc-gray-200 lg:inline-block dark:bg-cc-navy-700"
          />

          <div className="hidden lg:block">
            <OrgSelector />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setCmdkOpen(true)}
            className="cc-search-trigger hidden md:inline-flex"
            aria-label="Buscar (Cmd+K)"
          >
            <SearchIcon size={15} />
            <span className="flex-1 text-left">Buscar…</span>
            <span className="cc-kbd">{modKey}</span>
            <span className="cc-kbd">K</span>
          </button>

          <button
            type="button"
            onClick={() => setCmdkOpen(true)}
            className="cc-icon-btn md:hidden"
            aria-label="Buscar"
          >
            <SearchIcon size={17} />
          </button>

          <ThemeToggle />

          <button
            type="button"
            className="cc-icon-btn"
            aria-label="Notificaciones"
            title="Notificaciones (próximamente)"
            style={{ ['--_dot-ring' as string]: 'transparent' }}
          >
            <BellIcon size={17} />
          </button>

          <span
            aria-hidden
            className="mx-0.5 hidden h-6 w-px bg-cc-gray-200 sm:inline-block dark:bg-cc-navy-700"
          />

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
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[16rem]">
                <div className="flex items-center gap-2 px-2 py-2">
                  <Avatar>
                    <AvatarFallback>{getInitials(user?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-cc-gray-900 text-sm dark:text-white">
                      {user?.full_name ?? 'Usuario'}
                    </p>
                    <p className="truncate text-cc-gray-500 text-xs">{user?.email ?? '—'}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push('/settings/profile')}
                  className="flex items-center gap-2"
                >
                  <SettingsIcon size={15} />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push('/settings/organization')}
                  className="flex items-center gap-2"
                >
                  <UsersIcon size={15} />
                  Organización
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onLogout}
                  className="flex items-center gap-2 text-cc-danger-600 hover:bg-cc-danger-100 dark:hover:bg-cc-danger-600/10"
                >
                  <LogOutIcon size={15} />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
    </>
  )
}
