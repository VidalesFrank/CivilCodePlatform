'use client'

import { ModuleHub } from '@/components/shell/ModuleHub'
import { WallIcon } from '@civilcode/icons'

export default function WallsPage() {
  return (
    <ModuleHub
      slug="walls"
      title="Diseño de muros"
      tagline="Clasificación pier/muro, cortante Vn = Acv·(αc·√fc + ρh·fy), selección automática de malla H/V y flag de elementos de borde confinados."
      status="ready"
      phase="Fase 3d · listo"
      accent="#6366f1"
      Icon={WallIcon}
      openTab="model"
      highlights={[
        { label: 'Clasificación', value: 'hw / Lw' },
        { label: 'Cortante', value: 'Vn ≤ 0.83·√fc' },
        { label: 'Malla', value: 'H + V spacing' },
        { label: 'Bordes', value: 'Confinados' },
      ]}
    />
  )
}
