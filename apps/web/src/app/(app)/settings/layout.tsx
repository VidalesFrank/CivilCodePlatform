'use client'

import { Breadcrumb } from '@/components/shell/Breadcrumb'
import { SettingsIcon, UsersIcon } from '@/components/shell/nav-icons'
import { cn } from '@civilcode/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/settings/profile', label: 'Perfil', Icon: SettingsIcon },
  { href: '/settings/organization', label: 'Organización', Icon: UsersIcon },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const current = TABS.find((t) => pathname === t.href || pathname?.startsWith(`${t.href}/`))

  return (
    <div>
      <section className="border-cc-gray-200 border-b bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Breadcrumb
            items={[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/settings/profile', label: 'Ajustes' },
              { label: current?.label ?? '' },
            ]}
          />
          <div className="mt-3">
            <h1 className="font-bold text-2xl text-cc-gray-900 sm:text-3xl tracking-tight dark:text-white">
              Ajustes
            </h1>
            <p className="mt-1 text-cc-gray-500 text-sm">
              Perfil, equipo y preferencias de tu cuenta.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          <nav aria-label="Navegación de ajustes" className="flex gap-1 lg:flex-col">
            {TABS.map((t) => {
              const active = pathname === t.href || pathname?.startsWith(`${t.href}/`)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  data-active={active}
                  className={cn('cc-sidebar-item', 'lg:!mx-0')}
                >
                  <t.Icon size={16} className="cc-sidebar-icon" />
                  <span>{t.label}</span>
                </Link>
              )
            })}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
