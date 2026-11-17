import { BaseIcon, type IconProps } from '../BaseIcon'

export function PanIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 13 L8 6 A1.5 1.5 0 0 1 11 6 L11 12" />
      <path d="M11 11 L11 5 A1.5 1.5 0 0 1 14 5 L14 12" />
      <path d="M14 11 L14 6 A1.5 1.5 0 0 1 17 6 L17 12" />
      <path d="M17 11 L17 8 A1.5 1.5 0 0 1 20 8 L20 15 A6 6 0 0 1 14 21 L11 21 A3 3 0 0 1 8.5 19.5 L5 14 A1.5 1.5 0 0 1 7.5 12 Z" />
    </BaseIcon>
  )
}
