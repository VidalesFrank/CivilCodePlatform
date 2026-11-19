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

export interface SidebarProps {
  /** Si está abierto como sheet en mobile */
  open?: boolean
  /** Handler para cerrar el sheet (click en overlay o link) */
  onClose?: () => void
  /** Si está colapsado (desktop: solo íconos) */
  collapsed?: boolean
}

export function Sidebar({ open = false, onClose, collapsed = false }: SidebarProps) {
  const pathname = usePathname()

  const content = (
    <nav
      className={cn('flex flex-col gap-0.5 py-4', collapsed ? 'px-2' : 'px-3')}
      aria-label="Navegación principal"
    >
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onClose}
            title={collapsed ? label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-1',
              collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2',
              active
                ? 'bg-cc-cyan-500/10 text-cc-cyan-600 dark:bg-cc-cyan-500/15 dark:text-cc-cyan-400'
                : 'text-cc-gray-700 hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800',
            )}
          >
            {active && !collapsed && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-cc-cyan-500"
              />
            )}
            <Icon
              size={18}
              className={cn(
                active
                  ? 'text-cc-cyan-600 dark:text-cc-cyan-400'
                  : 'text-cc-gray-500 dark:text-cc-gray-400',
              )}
            />
            {!collapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside
        className={cn(
          'hidden flex-col border-cc-gray-200 border-r bg-white md:flex dark:border-cc-navy-700 dark:bg-cc-navy-900',
          'transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-56',
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
