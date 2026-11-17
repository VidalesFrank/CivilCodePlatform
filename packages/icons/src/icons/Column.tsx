import { BaseIcon, type IconProps } from '../BaseIcon'

export function ColumnIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="9" y="3" width="6" height="18" rx="0.5" />
      <line x1="7" y1="5" x2="17" y2="5" />
      <line x1="7" y1="19" x2="17" y2="19" />
    </BaseIcon>
  )
}
