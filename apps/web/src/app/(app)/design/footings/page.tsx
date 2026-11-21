'use client'

import { ModuleHub } from '@/components/shell/ModuleHub'
import { FootingIcon } from '@civilcode/icons'

export default function FootingsPage() {
  return (
    <ModuleHub
      slug="footings"
      title="Diseño de zapatas"
      tagline="Predimensionado cuadrado por q_adm_net, peralte iterativo por punzonamiento (C.22.6.5), cortante one-way a d de cara, flexión cara columna y ρ mínimo por retracción."
      status="ready"
      phase="Fase 3e · listo"
      accent="#8b5cf6"
      Icon={FootingIcon}
      openTab="model"
      highlights={[
        { label: 'Capacidad', value: 'q_adm_net' },
        { label: 'Punzonamiento', value: 'C.22.6.5' },
        { label: 'One-way', value: 'A d de cara' },
        { label: 'ρ mín', value: '0.0018 retr.' },
      ]}
    />
  )
}
