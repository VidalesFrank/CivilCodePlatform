import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cc-gray-50 dark:bg-cc-navy-950">
      {/* Panel izquierdo: HERO oscuro (solo visible lg+) */}
      <aside className="hidden lg:flex lg:w-1/2 xl:w-2/5 cc-hero-dark relative">
        <div className="flex w-full flex-col justify-between px-12 py-12 xl:px-16 xl:py-16">
          <Link
            href="/"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b18] rounded-sm"
          >
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                boxShadow: '0 8px 24px -8px rgba(34,211,238,0.6)',
              }}
            >
              CC
            </span>
            <span className="font-semibold text-white text-xl tracking-tight">
              CivilCode <span className="text-cc-cyan-400">Studio</span>
            </span>
          </Link>

          <div className="cc-fade-up" style={{ animationDelay: '120ms' }}>
            <span className="cc-hero-pill">
              <span className="cc-hero-pill-dot" />
              Plataforma estructural · NSR-10
            </span>
            <h1 className="cc-hero-headline mt-5 text-3xl xl:text-4xl">
              Diseña, analiza y despieza{' '}
              <span className="cc-hero-gradient-text">en una sola herramienta.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-[color:var(--hero-text-muted)]">
              Importa ETABS, corre análisis, diseña vigas / columnas / muros / zapatas con la
              norma colombiana, y exporta DXF + PDF al cliente. Todo en el navegador.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Feature title="ETABS" desc="Import E2K/XLSX + visor 3D" />
              <Feature title="OpenSees" desc="Análisis real (próx.)" />
              <Feature title="NSR-10" desc="Vigas · columnas · muros" />
              <Feature title="DXF / PDF" desc="Despiece + memoria" />
            </div>
          </div>

          <p className="cc-label-mono text-[10px]">© CivilCode Solutions · 2026</p>
        </div>
      </aside>

      {/* Panel derecho: form card */}
      <main className="flex w-full items-center justify-center p-4 sm:p-6 lg:w-1/2 lg:p-8 xl:w-3/5">
        <div className="w-full max-w-md">
          {/* Logo mobile (hidden en lg) */}
          <Link
            href="/"
            className="mb-6 flex items-center justify-center gap-2 lg:hidden"
          >
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                boxShadow: '0 6px 18px -6px rgba(34,211,238,0.55)',
              }}
            >
              CC
            </span>
            <span className="font-semibold text-cc-navy-900 text-lg tracking-tight dark:text-white">
              CivilCode <span className="text-cc-cyan-600 dark:text-cc-cyan-400">Studio</span>
            </span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="min-w-[8rem]">
      <p className="font-mono font-bold text-[11px] text-cc-cyan-400 uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] text-[color:var(--hero-text-muted)]">{desc}</p>
    </div>
  )
}
