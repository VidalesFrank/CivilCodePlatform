import { BeamIcon } from '@civilcode/icons'
import { UnderConstruction } from '@/components/shell/UnderConstruction'

export default function BeamsPage() {
  return (
    <UnderConstruction
      title="Diseño de vigas"
      phase="Fase 3"
      description="Motor de flexión + cortante + despiece NSR-10. Portado desde PlataformaDespieceVigas (TypeScript → Python)."
      Icon={BeamIcon}
    />
  )
}
