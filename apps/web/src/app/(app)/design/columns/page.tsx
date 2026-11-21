'use client'

import { ModuleHub } from '@/components/shell/ModuleHub'
import { ColumnIcon } from '@civilcode/icons'

export default function ColumnsPage() {
  return (
    <ModuleHub
      slug="columns"
      title="Diseño de columnas"
      tagline="Interacción P-M (Bresler α=1), armado longitudinal simétrico ρ 0.01-0.04 y confinamiento NSR-10 C.21.6.4 para DMO/DES."
      status="ready"
      phase="Fase 3c · listo"
      accent="#3b82f6"
      Icon={ColumnIcon}
      openTab="model"
      highlights={[
        { label: 'Carga axial', value: 'φPn_max C.22.4.2.2' },
        { label: 'Biaxial', value: 'Bresler α=1' },
        { label: 'Confinamiento', value: 'C.21.6.4' },
        { label: 'Cuantía', value: 'ρ 0.01 – 0.04' },
      ]}
    />
  )
}
