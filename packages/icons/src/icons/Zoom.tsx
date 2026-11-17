import { BaseIcon, type IconProps } from '../BaseIcon'

export function ZoomIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="10" cy="10" r="7" />
      <line x1="20" y1="20" x2="15" y2="15" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="10" y1="7" x2="10" y2="13" />
    </BaseIcon>
  )
}
