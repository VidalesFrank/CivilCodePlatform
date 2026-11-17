import { BaseIcon, type IconProps } from '../BaseIcon'

export function WallIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="0.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="9" y1="4" x2="9" y2="9" />
      <line x1="15" y1="9" x2="15" y2="14" />
      <line x1="7" y1="14" x2="7" y2="20" />
      <line x1="13" y1="14" x2="13" y2="20" />
      <line x1="19" y1="14" x2="19" y2="20" />
    </BaseIcon>
  )
}
