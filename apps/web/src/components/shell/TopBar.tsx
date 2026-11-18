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

function getInitials(fullName: string | undefined): string {
  if (!fullName) return '??'
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
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
    <header className="flex h-14 items-center justify-between border-cc-gray-200 border-b bg-white px-3 sm:px-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {/* Hamburger (solo en mobile) */}
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-cc-gray-600 hover:bg-cc-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 md:hidden dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
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

        <Link
          href="/dashboard"
          className="truncate font-semibold text-cc-navy-900 text-lg tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-sm dark:text-white"
        >
          CivilCode <span className="text-cc-blue-600">Studio</span>
        </Link>
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
                className="flex items-center gap-2 rounded-md p-1 hover:bg-cc-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 dark:hover:bg-cc-navy-800"
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
