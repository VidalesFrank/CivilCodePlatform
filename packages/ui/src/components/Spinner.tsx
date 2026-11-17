import type * as React from 'react'
import { cn } from '../lib/cn'

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number
}

export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <svg
      aria-label="Cargando"
      role="status"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      className={cn('animate-spin text-current', className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        fill="currentColor"
        className="opacity-75"
      />
    </svg>
  )
}
