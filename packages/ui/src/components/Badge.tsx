import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        neutral:
          'bg-cc-gray-100 text-cc-gray-700 dark:bg-cc-navy-700 dark:text-cc-gray-200',
        info: 'bg-cc-cyan-300/30 text-cc-cyan-600 dark:bg-cc-cyan-500/20 dark:text-cc-cyan-300',
        success:
          'bg-cc-success-100 text-cc-success-600 dark:bg-cc-success-500/20 dark:text-cc-success-500',
        warning:
          'bg-cc-warn-100 text-cc-warn-600 dark:bg-cc-warn-500/20 dark:text-cc-warn-500',
        danger:
          'bg-cc-danger-100 text-cc-danger-600 dark:bg-cc-danger-500/20 dark:text-cc-danger-500',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}
