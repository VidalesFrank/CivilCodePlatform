import * as React from 'react'
import { cn } from '../lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-cc-gray-900 shadow-sm placeholder:text-cc-gray-500',
          'transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-cc-navy-900 dark:text-white dark:placeholder:text-cc-gray-500',
          error
            ? 'border-cc-danger-500 focus-visible:ring-cc-danger-500'
            : 'border-cc-gray-200 dark:border-cc-navy-700',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
