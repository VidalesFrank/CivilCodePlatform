import * as React from 'react'
import { cn } from '../lib/cn'

export const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-cc-gray-100 dark:bg-cc-navy-700',
        className,
      )}
      {...props}
    />
  ),
)
Avatar.displayName = 'Avatar'

export const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, alt, ...props }, ref) => (
  // biome-ignore lint/a11y/useAltText: alt is passed through
  <img ref={ref} alt={alt} className={cn('aspect-square h-full w-full object-cover', className)} {...props} />
))
AvatarImage.displayName = 'AvatarImage'

export const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center text-sm font-medium text-cc-gray-700 dark:text-cc-gray-200',
      className,
    )}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'
