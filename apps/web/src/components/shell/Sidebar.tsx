'use client'

import { BeamIcon, ColumnIcon, MomentIcon, SheetIcon, WallIcon } from '@civilcode/icons'
import type { IconProps } from '@civilcode/icons'
import { cn } from '@civilcode/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'

interface NavItem {
  href: string
  label: string
  Icon: ComponentType<IconProps>
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', Icon: SheetIcon },
  { href: '/projects', label: 'Proyectos', Icon: SheetIcon },
  { href: '/analysis', label: 'Análisis', Icon: MomentIcon },
  { href: '/design/beams', label: 'Vigas', Icon: BeamIcon },
  { href: '/design/columns', label: 'Columnas', Icon: ColumnIcon },
  { href: '/design/walls', label: 'Muros', Icon: WallIcon },
]

interface SidebarProps {
  /** Si está abierto como sheet en mobile */
  open?: boolean
  /** Handler para cerrar el sheet (click en overlay o link) */
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  const content = (
    <nav className="flex flex-col gap-0.5 px-3 py-4" aria-label="Navegación principal">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1',
              active
                ? 'bg-cc-blue-50 text-cc-blue-700 dark:bg-cc-blue-600/15 dark:text-cc-blue-400'
                : 'text-cc-gray-700 hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800',
            )}
          >
            <Icon
              size={18}
              className={cn(
                active
                  ? 'text-cc-blue-600 dark:text-cc-blue-400'
                  : 'text-cc-gray-500 dark:text-cc-gray-400',
              )}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-56 flex-col border-cc-gray-200 border-r bg-white md:flex dark:border-cc-navy-700 dark:bg-cc-navy-900">
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
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-cc-gray-200 border-r bg-white md:hidden dark:border-cc-navy-700 dark:bg-cc-navy-900"
            aria-label="Menú móvil"
          >
            {content}
          </aside>
        </>
      )}
    </>
  )
}
