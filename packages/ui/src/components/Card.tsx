import * as React from 'react'
import { cn } from '../lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Si true, agrega hover lift + shadow más pronunciada. */
  interactive?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl border border-cc-gray-200 bg-white dark:border-cc-navy-700 dark:bg-cc-navy-900',
        // Shadow suave estilo PerformanceLabs
        '[box-shadow:0_1px_3px_rgba(15,23,42,0.04),0_2px_12px_-6px_rgba(15,23,42,0.06)]',
        'transition-all duration-200',
        interactive &&
          'hover:-translate-y-1 hover:border-cc-cyan-400/60 hover:[box-shadow:0_20px_40px_-24px_rgba(34,211,238,0.35),0_4px_12px_-6px_rgba(15,23,42,0.08)]',
        className,
      )}
      style={style}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-semibold text-base leading-tight tracking-tight text-cc-gray-900 dark:text-white',
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-cc-gray-500 dark:text-cc-gray-400', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
