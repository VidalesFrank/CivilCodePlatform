import { BaseIcon, type IconProps } from '../BaseIcon'

export function StirrupIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <path d="M19 4 L22 7" />
    </BaseIcon>
  )
}
