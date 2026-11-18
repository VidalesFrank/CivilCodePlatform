'use client'

import { cn } from '@civilcode/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/settings/profile', label: 'Perfil' },
  { href: '/settings/organization', label: 'Organización' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 font-bold text-2xl text-cc-gray-900 sm:text-3xl dark:text-white">
        Ajustes
      </h1>
      <div className="grid gap-6 lg:grid-cols-[180px_1fr] lg:gap-8">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Navegación de ajustes">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname?.startsWith(`${t.href}/`)
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1',
                  active
                    ? 'bg-cc-blue-50 text-cc-blue-700 dark:bg-cc-blue-600/15 dark:text-cc-blue-400'
                    : 'text-cc-gray-700 hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  )
}
