import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cc-gray-50 dark:bg-cc-navy-950">
      <header className="border-cc-gray-200 border-b bg-white px-4 py-4 sm:px-6 dark:border-cc-navy-700 dark:bg-cc-navy-900">
        <Link
          href="/"
          className="font-semibold text-cc-navy-900 text-lg tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1 rounded-sm dark:text-white"
        >
          CivilCode <span className="text-cc-blue-600">Studio</span>
        </Link>
      </header>
      <main className="mx-auto flex max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </main>
    </div>
  )
}
