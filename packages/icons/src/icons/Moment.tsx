import { BaseIcon, type IconProps } from '../BaseIcon'

export function MomentIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20 Q 12 2 20 20" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <polyline points="2 18 4 20 6 18" />
      <polyline points="18 18 20 20 22 18" />
    </BaseIcon>
  )
}
