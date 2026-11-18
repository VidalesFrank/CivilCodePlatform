import Link from 'next/link'
import { Card, CardContent, CardDescription, CardTitle } from '@civilcode/ui'
import { BeamIcon } from '@civilcode/icons'

export default function BeamsPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-start gap-4">
        <BeamIcon size={48} className="text-cc-blue-600" />
        <div>
          <h1 className="font-bold text-3xl text-cc-gray-900 dark:text-white">Diseño de vigas</h1>
          <p className="mt-1 text-cc-gray-500 text-sm">
            Motor de flexión + cortante NSR-10. Dispara diseños desde la revisión importada de un
            edificio.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CardTitle className="text-base">¿Cómo diseñar vigas?</CardTitle>
          <CardDescription className="mt-2 space-y-2">
            <p>
              El diseño se dispara por <strong>revisión</strong>: cada revisión imported de un
              edificio te deja seleccionar vigas por nivel y configurar parámetros.
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                Ve a tu <Link href="/projects" className="text-cc-blue-600 hover:underline">proyecto</Link>.
              </li>
              <li>Tab <strong>Modelo 3D</strong> → despliega un edificio → ver sus revisiones.</li>
              <li>
                Sobre una revisión con estado <strong>imported</strong>, click en{' '}
                <em>&ldquo;Diseñar vigas&rdquo;</em>.
              </li>
              <li>
                Selecciona el nivel, ajusta parámetros (f&rsquo;c, fy, recubrimiento, CV, CM
                extra), y click <strong>Diseñar vigas del nivel</strong>.
              </li>
              <li>
                Expande el diseño completado para ver la tabla; descarga <strong>DXF</strong>{' '}
                (cuadro de despiece) o <strong>PDF</strong> (memoria de cálculo).
              </li>
            </ol>
            <p className="mt-2 text-xs italic text-cc-gray-500">
              Limitaciones actuales: Mu asumido como w·L²/10 (apoyo) y w·L²/14 (centro) sin
              envelope de análisis real. Solo flexión + cortante; sin despiece longitudinal con
              traslapos ni anclajes.
            </p>
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}
