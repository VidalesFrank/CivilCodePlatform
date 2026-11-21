import { BeamIcon, ColumnIcon, CubeIcon, DxfIcon, SheetIcon, WallIcon } from '@civilcode/icons'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-cc-gray-50 dark:bg-cc-navy-950">
      <section className="cc-hero-dark relative px-6 py-16 sm:py-20 lg:py-24">
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <span className="cc-logo-badge !h-9 !w-9 !text-sm">CC</span>
            <span className="font-semibold text-white text-lg tracking-tight">
              CivilCode <span className="text-cc-cyan-400">Studio</span>
            </span>
          </div>

          <div className="mt-10 cc-fade-up">
            <span className="cc-hero-pill">
              <span className="cc-hero-pill-dot" />
              v0 · Plataforma estructural NSR-10
            </span>
            <h1 className="cc-hero-headline mt-5 text-4xl sm:text-5xl lg:text-6xl">
              Diseña estructuras <br />
              <span className="cc-hero-gradient-text">completas en un solo lugar.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-[color:var(--hero-text-muted)] sm:text-lg">
              Importa tu modelo ETABS, visualízalo en 3D, corre análisis, diseña vigas, columnas,
              muros y zapatas con NSR-10, y entrega DXF + PDF al cliente. Sin salir del navegador.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="cc-cta-primary">
                Iniciar sesión
              </Link>
              <Link href="/register" className="cc-cta-ghost">
                Crear cuenta
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-6">
              <HeroStat num="4" label="Módulos listos" accent="#22d3ee" />
              <HeroStat num="NSR-10" label="Normativa" accent="#6366f1" />
              <HeroStat num=".E2K" label="Importa ETABS" accent="#10b981" />
              <HeroStat num="DXF+PDF" label="Entregables" accent="#f59e0b" />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="cc-label-mono text-cc-cyan-600 dark:text-cc-cyan-400">Qué podrás hacer</p>
            <h2 className="mt-2 font-bold text-2xl text-cc-gray-900 tracking-tight sm:text-3xl dark:text-white">
              Un flujo completo, desde el modelo hasta los planos
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-cc-gray-500 text-sm">
              Cada módulo está acoplado al modelo 3D, así que no duplicas información entre
              ETABS, Excel y AutoCAD.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <div
                key={m.title}
                className="cc-tool-card cc-fade-up"
                data-active="true"
                style={{
                  ['--_card-accent' as string]: m.accent,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="cc-tool-card-icon"
                    style={{ ['--_card-accent' as string]: m.accent }}
                  >
                    <m.icon size={20} />
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-cc-gray-900 text-sm dark:text-white">
                    {m.title}
                  </p>
                  <p className="mt-1 text-cc-gray-500 text-xs">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-cc-gray-200 border-t px-6 py-8 text-center text-cc-gray-500 text-xs dark:border-cc-navy-700">
        © {new Date().getFullYear()} CivilCode Solutions — Todos los derechos reservados
      </footer>
    </main>
  )
}

function HeroStat({ num, label, accent }: { num: string; label: string; accent: string }) {
  return (
    <div className="cc-stat-chip" style={{ ['--_stat-accent' as string]: accent }}>
      <span className="cc-stat-chip-num">{num}</span>
      <span>{label}</span>
    </div>
  )
}

const MODULES = [
  {
    icon: CubeIcon,
    accent: '#22d3ee',
    title: 'Importar ETABS',
    desc: 'E2K y XLSX con validación auto. Visor 3D con Plotly, nodos, elementos y niveles.',
  },
  {
    icon: BeamIcon,
    accent: '#06b6d4',
    title: 'Diseño de vigas',
    desc: 'Flexión + cortante NSR-10, confinamiento DMO/DES, DXF (cuadro de despiece) y PDF (memoria).',
  },
  {
    icon: ColumnIcon,
    accent: '#3b82f6',
    title: 'Diseño de columnas',
    desc: 'P-M Bresler, confinamiento NSR-10 C.21.6.4, cuantías 0.01-0.04, estribos sísmicos.',
  },
  {
    icon: WallIcon,
    accent: '#6366f1',
    title: 'Diseño de muros',
    desc: 'Clasificación pier/muro, malla H+V, elementos de borde, cortante Vn ≤ 0.83·√fc.',
  },
  {
    icon: DxfIcon,
    accent: '#8b5cf6',
    title: 'Diseño de zapatas',
    desc: 'q_adm_net, punzonamiento, flexión cara columna, ρ mínimo por retracción.',
  },
  {
    icon: SheetIcon,
    accent: '#10b981',
    title: 'Memorias y planos',
    desc: 'DXF listos para AutoCAD, memorias técnicas PDF con portada, tablas y detalles.',
  },
]
