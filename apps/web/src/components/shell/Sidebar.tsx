import Link from 'next/link'
import type { ComponentType } from 'react'
import { BeamIcon, ColumnIcon, MomentIcon, SheetIcon, WallIcon } from '@civilcode/icons'
import type { IconProps } from '@civilcode/icons'

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

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-cc-gray-200 border-r bg-white py-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-cc-gray-700 text-sm hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
          >
            <Icon size={18} className="text-cc-gray-500 dark:text-cc-gray-400" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
