import { BaseIcon, type IconProps } from '../BaseIcon'

export function PlanIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
      <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </BaseIcon>
  )
}
