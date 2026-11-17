import { BaseIcon, type IconProps } from '../BaseIcon'

export function LayerIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 L22 8 L12 13 L2 8 Z" />
      <path d="M2 13 L12 18 L22 13" />
      <path d="M2 18 L12 23 L22 18" strokeOpacity="0.6" />
    </BaseIcon>
  )
}
