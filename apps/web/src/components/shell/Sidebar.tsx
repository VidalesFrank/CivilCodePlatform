'use client'

import { type UserPublic, auth } from '@/lib/api'
import { BeamIcon, ColumnIcon, FootingIcon, WallIcon } from '@civilcode/icons'
import type { IconProps } from '@civilcode/icons'
import { Avatar, AvatarFallback, cn } from '@civilcode/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ComponentType, useEffect, useState } from 'react'
import {
  FolderIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  SparkleIcon,
  UsersIcon,
} from './nav-icons'

interface NavItem {
  href: string
  label: string
  Icon: ComponentType<IconProps> | ComponentType<{ size?: number; className?: string }>
  badge?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Inicio', Icon: HomeIcon },
      { href: '/projects', label: 'Proyectos', Icon: FolderIcon },
    ],
  },
  {
    label: 'Análisis & Diseño',
    items: [
      { href: '/analysis', label: 'Análisis', Icon: SparkleIcon, badge: 'β' },
      { href: '/design/beams', label: 'Vigas', Icon: BeamIcon },
      { href: '/design/columns', label: 'Columnas', Icon: ColumnIcon },
      { href: '/design/walls', label: 'Muros', Icon: WallIcon },
      { href: '/design/footings', label: 'Zapatas', Icon: FootingIcon },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      { href: '/settings/profile', label: 'Perfil', Icon: SettingsIcon },
      { href: '/settings/organization', label: 'Organización', Icon: UsersIcon },
    ],
  },
]

function getInitials(fullName: string | undefined): string {
  if (!fullName) return '??'
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (pathname === href) return true
  if (href !== '/dashboard' && pathname.startsWith(`${href}/`)) return true
  return false
}

export interface SidebarProps {
  open?: boolean
  onClose?: () => void
  collapsed?: boolean
}

export function Sidebar({ open = false, onClose, collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<UserPublic | null>(null)

  useEffect(() => {
    auth.me().then(setUser).catch(() => setUser(null))
  }, [])

  const content = (
    <div className="flex h-full flex-col">
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Navegación principal">
        {SECTIONS.map((section, i) => (
          <div key={section.label} className={cn(i > 0 && !collapsed && 'mt-2')}>
            {!collapsed && <div className="cc-sidebar-section-label">{section.label}</div>}
            {collapsed && i > 0 && (
              <div
                aria-hidden
                className="mx-3 my-2 h-px bg-cc-gray-200 dark:bg-cc-navy-700"
              />
            )}
            {section.items.map(({ href, label, Icon, badge }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  data-active={active}
                  className={cn('cc-sidebar-item', collapsed && 'cc-sidebar-collapsed-item')}
                >
                  <Icon size={18} className="cc-sidebar-icon" />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && badge && <span className="cc-sidebar-badge">{badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {user && !collapsed && (
        <div className="cc-sidebar-footer">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="cc-sidebar-user-name truncate">{user.full_name}</div>
            <div className="cc-sidebar-user-email truncate">{user.email}</div>
          </div>
          <button
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={async () => {
              try {
                await auth.logout()
              } finally {
                window.location.href = '/login'
              }
            }}
            className="cc-icon-btn h-8 w-8"
          >
            <LogOutIcon size={15} />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside
        className={cn(
          'hidden flex-col border-cc-gray-200 border-r bg-white md:flex dark:border-cc-navy-700 dark:bg-cc-navy-900',
          'transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {content}
      </aside>

      {/* Mobile: sheet con overlay */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-cc-gray-200 border-r bg-white md:hidden dark:border-cc-navy-700 dark:bg-cc-navy-900"
            aria-label="Menú móvil"
          >
            {content}
          </aside>
        </>
      )}
    </>
  )
}
