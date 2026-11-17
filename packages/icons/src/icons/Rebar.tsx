import { BaseIcon, type IconProps } from '../BaseIcon'

export function RebarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M5 10 L5 14 M8 10 L8 14 M11 10 L11 14 M14 10 L14 14 M17 10 L17 14 M20 10 L20 14" />
    </BaseIcon>
  )
}
