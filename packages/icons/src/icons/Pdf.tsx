import { BaseIcon, type IconProps } from '../BaseIcon'

export function PdfIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 4 L14 4 L20 10 L20 20 L4 20 Z" />
      <path d="M14 4 L14 10 L20 10" />
      <text x="12" y="17" textAnchor="middle" fontSize="5" fontFamily="monospace" fill="currentColor" stroke="none">PDF</text>
    </BaseIcon>
  )
}
