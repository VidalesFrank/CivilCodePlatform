import { UnderConstruction } from '@/components/shell/UnderConstruction'
import { MomentIcon } from '@civilcode/icons'

export default function AnalysisPage() {
  return (
    <UnderConstruction
      title="Análisis estructural"
      phase="Fase 2"
      description="Workers Celery para análisis modal y espectral NSR-10. Resultados vinculados a elementos por element_local_id."
      Icon={MomentIcon}
    />
  )
}
