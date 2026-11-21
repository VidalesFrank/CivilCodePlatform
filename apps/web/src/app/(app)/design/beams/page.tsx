'use client'

import { ModuleHub } from '@/components/shell/ModuleHub'
import { BeamIcon } from '@civilcode/icons'

export default function BeamsPage() {
  return (
    <ModuleHub
      slug="beams"
      title="Diseño de vigas"
      tagline="Motor de flexión + cortante NSR-10. Selección automática de refuerzo longitudinal y estribos, con export DXF (cuadro de despiece) y PDF (memoria)."
      status="ready"
      phase="Fase 3a-b · listo"
      accent="#22d3ee"
      Icon={BeamIcon}
      openTab="model"
      highlights={[
        { label: 'Flexión', value: 'As #3 – #8' },
        { label: 'Cortante', value: 'Vc + Vs' },
        { label: 'Confinamiento', value: 'DMO / DES' },
        { label: 'Export', value: 'DXF + PDF' },
      ]}
    />
  )
}
