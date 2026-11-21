'use client'

import { ModuleHub } from '@/components/shell/ModuleHub'
import { MomentIcon } from '@civilcode/icons'

export default function AnalysisPage() {
  return (
    <ModuleHub
      slug="analysis"
      title="Análisis estructural"
      tagline="Chequeos preliminares sobre la geometría importada: masa por nivel, elementos, consistencia. OpenSees (modal + espectral NSR-10) en progreso."
      status="beta"
      phase="Fase 2 · preliminar"
      accent="#8b5cf6"
      Icon={MomentIcon}
      openTab="analysis"
      highlights={[
        { label: 'Preliminar', value: 'Masa · Rigidez' },
        { label: 'Modal', value: 'OpenSees (soon)' },
        { label: 'Espectral', value: 'NSR-10 A.2.6' },
        { label: 'Workers', value: 'Celery' },
      ]}
    />
  )
}
