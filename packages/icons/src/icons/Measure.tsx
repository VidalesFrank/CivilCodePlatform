import { BaseIcon, type IconProps } from '../BaseIcon'

export function MeasureIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="2" y="10" width="20" height="5" rx="0.5" />
      <line x1="5" y1="10" x2="5" y2="13" />
      <line x1="8" y1="10" x2="8" y2="12" />
      <line x1="11" y1="10" x2="11" y2="13" />
      <line x1="14" y1="10" x2="14" y2="12" />
      <line x1="17" y1="10" x2="17" y2="13" />
      <line x1="20" y1="10" x2="20" y2="12" />
    </BaseIcon>
  )
}
