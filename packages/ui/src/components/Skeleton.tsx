import * as React from 'react'
import { cn } from '../lib/cn'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-cc-gray-200 dark:bg-cc-navy-700', className)}
      {...props}
    />
  )
}
