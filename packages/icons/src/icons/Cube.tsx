import { BaseIcon, type IconProps } from '../BaseIcon'

export function CubeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
      <path d="M12 2 L12 12 L3 7" />
      <path d="M12 12 L21 7" />
      <path d="M12 12 L12 22" />
    </BaseIcon>
  )
}
