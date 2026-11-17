import Link from 'next/link'

const TABS = [
  { href: '/settings/profile', label: 'Perfil' },
  { href: '/settings/organization', label: 'Organización' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 font-bold text-3xl text-cc-gray-900 dark:text-white">Ajustes</h1>
      <div className="grid grid-cols-[180px_1fr] gap-8">
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-md px-3 py-2 text-cc-gray-700 text-sm hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </div>
  )
}
