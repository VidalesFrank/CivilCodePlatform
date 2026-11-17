import { BaseIcon, type IconProps } from '../BaseIcon'

export function LoadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <line x1="4" y1="4" x2="4" y2="16" />
      <polyline points="2 14 4 16 6 14" />
      <line x1="10" y1="4" x2="10" y2="16" />
      <polyline points="8 14 10 16 12 14" />
      <line x1="16" y1="4" x2="16" y2="16" />
      <polyline points="14 14 16 16 18 14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </BaseIcon>
  )
}
