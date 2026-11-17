import { BaseIcon, type IconProps } from '../BaseIcon'

export function HookIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 3 L6 15 A4 4 0 0 0 14 15 L14 10" />
    </BaseIcon>
  )
}
