import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-cc-navy-900 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-cc-blue-600 text-white hover:bg-cc-blue-500 active:bg-cc-blue-700',
        secondary:
          'bg-cc-gray-100 text-cc-gray-900 hover:bg-cc-gray-200 dark:bg-cc-navy-800 dark:text-white dark:hover:bg-cc-navy-700',
        ghost:
          'bg-transparent text-cc-gray-700 hover:bg-cc-gray-100 dark:text-cc-gray-300 dark:hover:bg-cc-navy-800',
        outline:
          'border border-cc-gray-200 bg-transparent text-cc-gray-900 hover:bg-cc-gray-50 dark:border-cc-navy-700 dark:text-white dark:hover:bg-cc-navy-800',
        danger: 'bg-cc-danger-500 text-white hover:bg-cc-danger-600',
        success: 'bg-cc-success-500 text-white hover:bg-cc-success-600',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, disabled, leadingIcon, trailingIcon, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading ? (
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
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
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </button>
    )
  },
)
Button.displayName = 'Button'
