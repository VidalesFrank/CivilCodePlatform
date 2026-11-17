import { BaseIcon, type IconProps } from '../BaseIcon'

export function ShearIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6 L21 6 L21 10 L3 18 L3 14 Z" />
      <line x1="3" y1="20" x2="21" y2="20" strokeDasharray="2 2" />
    </BaseIcon>
  )
}
