import type * as React from 'react'

export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'children'> {
  size?: number
  strokeWidth?: number
}

interface BaseIconProps extends IconProps {
  children: React.ReactNode
}

/**
 * Base para iconos del dominio estructural CivilCode.
 * Usa `currentColor` por default para heredar color del contenedor.
 * Stroke 1.5 estándar alineado con Lucide.
 */
export function BaseIcon({
  size = 24,
  strokeWidth = 1.5,
  className,
  children,
  ...props
}: BaseIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}
