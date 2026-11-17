import Link from 'next/link'
import { Avatar, AvatarFallback } from '@civilcode/ui'

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-cc-gray-200 border-b bg-white px-4 dark:border-cc-navy-700 dark:bg-cc-navy-900">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="font-semibold text-cc-navy-900 text-lg tracking-tight dark:text-white"
        >
          CivilCode <span className="text-cc-blue-600">Studio</span>
        </Link>
        <span className="text-cc-gray-400 text-sm dark:text-cc-gray-500">·</span>
        <span className="text-cc-gray-600 text-sm dark:text-cc-gray-300">
          Sin proyecto activo
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-9 rounded-md border border-cc-gray-200 bg-cc-gray-50 px-3 text-cc-gray-500 text-xs hover:bg-cc-gray-100 dark:border-cc-navy-700 dark:bg-cc-navy-800 dark:text-cc-gray-400"
        >
          ⌘K buscar
        </button>
        <Link href="/settings/profile" aria-label="Ajustes">
          <Avatar>
            <AvatarFallback>FV</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}
