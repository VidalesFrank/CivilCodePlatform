import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cc-gray-50">
      <header className="border-cc-gray-200 border-b bg-white px-6 py-4">
        <Link
          href="/"
          className="font-semibold text-cc-navy-900 text-lg tracking-tight"
        >
          CivilCode <span className="text-cc-blue-600">Studio</span>
        </Link>
      </header>
      <main className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
        {children}
      </main>
    </div>
  )
}
