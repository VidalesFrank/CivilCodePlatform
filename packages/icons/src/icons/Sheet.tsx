import { BaseIcon, type IconProps } from '../BaseIcon'

export function SheetIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="17" x2="21" y2="17" />
      <line x1="15" y1="17" x2="15" y2="21" />
      <text x="17" y="21" fontSize="4" fill="currentColor" stroke="none">E-01</text>
    </BaseIcon>
  )
}
