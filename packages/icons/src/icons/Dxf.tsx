import { BaseIcon, type IconProps } from '../BaseIcon'

export function DxfIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <text x="12" y="15" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor" stroke="none">DXF</text>
    </BaseIcon>
  )
}
