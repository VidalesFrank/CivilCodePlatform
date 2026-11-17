import { BaseIcon, type IconProps } from '../BaseIcon'

export function BeamIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="2" y="10" width="20" height="4" rx="0.5" />
      <line x1="5" y1="14" x2="5" y2="20" strokeDasharray="1 2" />
      <line x1="19" y1="14" x2="19" y2="20" strokeDasharray="1 2" />
    </BaseIcon>
  )
}
