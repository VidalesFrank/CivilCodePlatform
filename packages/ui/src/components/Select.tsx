import * as React from 'react'
import { cn } from '../lib/cn'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border bg-white px-3 text-sm text-cc-gray-900 shadow-sm',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-blue-500 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-cc-navy-900 dark:text-white',
          error
            ? 'border-cc-danger-500 focus-visible:ring-cc-danger-500'
            : 'border-cc-gray-200 dark:border-cc-navy-700',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
