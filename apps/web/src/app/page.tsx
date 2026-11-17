import Link from 'next/link'
import { Button, Card, CardContent, CardDescription, CardTitle } from '@civilcode/ui'
import { BeamIcon, ColumnIcon, WallIcon, SheetIcon } from '@civilcode/icons'

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-cc-navy-900 px-6 py-24 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-cc-blue-600)_0%,_transparent_60%)] opacity-40" />
        <div className="relative mx-auto max-w-6xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cc-navy-700 bg-cc-navy-800/50 px-3 py-1 text-xs font-medium text-cc-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cc-cyan-500" />
            CivilCode Studio — v0.0 en construcción
          </p>
          <h1 className="font-bold text-4xl leading-tight tracking-tight sm:text-6xl">
            Plataforma integral de
            <br />
            <span className="bg-gradient-to-r from-cc-cyan-400 to-cc-blue-400 bg-clip-text text-transparent">
              ingeniería estructural
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-cc-gray-300">
            Importa tu modelo de ETABS, visualízalo en 3D, diseña tus elementos bajo NSR-10,
            genera planos y memorias, y comparte el proyecto con tus clientes y constructores
            desde un único espacio profesional.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg" variant="primary">
                Iniciar sesión
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="border-cc-navy-700 text-white hover:bg-cc-navy-800">
                Crear cuenta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section className="bg-cc-gray-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center font-semibold text-sm uppercase tracking-wider text-cc-blue-600">
            Lo que podrás hacer
          </h2>
          <p className="mb-12 text-center font-bold text-3xl text-cc-gray-900">
            Un flujo completo, desde el modelo hasta los planos
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <Card key={m.title}>
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-cc-blue-600/10 text-cc-blue-600">
                    <m.icon size={28} />
                  </div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <CardDescription className="mt-2">{m.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-cc-navy-950 px-6 py-8 text-center text-cc-gray-500 text-sm">
        © {new Date().getFullYear()} CivilCode Solutions — Todos los derechos reservados
      </footer>
    </main>
  )
}

const MODULES = [
  {
    icon: BeamIcon,
    title: 'Diseño de vigas',
    desc: 'Flexión, cortante, despiece automático con traslapos comerciales según NSR-10.',
  },
  {
    icon: ColumnIcon,
    title: 'Diseño de columnas',
    desc: 'Interacción P-M, estribos sísmicos y chequeos de confinamiento NSR-10 C.21.',
  },
  {
    icon: WallIcon,
    title: 'Diseño de muros',
    desc: 'Pier/spandrel, elementos de borde, refuerzo vertical y horizontal.',
  },
  {
    icon: SheetIcon,
    title: 'Planos y memorias',
    desc: 'Genera despieces, láminas y memorias técnicas desde el mismo modelo.',
  },
]
