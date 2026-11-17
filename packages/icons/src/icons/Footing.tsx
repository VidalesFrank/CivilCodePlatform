import { BaseIcon, type IconProps } from '../BaseIcon'

export function FootingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="10" y="3" width="4" height="10" rx="0.5" />
      <rect x="3" y="13" width="18" height="6" rx="0.5" />
      <line x1="3" y1="20" x2="21" y2="20" strokeDasharray="2 2" />
    </BaseIcon>
  )
}
