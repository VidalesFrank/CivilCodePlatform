'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // Close when clicking the backdrop (dialog element itself)
        if (e.target === ref.current) onOpenChange(false)
      }}
      className="rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/40 dark:bg-cc-navy-900"
    >
      {children}
    </dialog>
  )
}

export function DialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('p-6', className)}>{children}</div>
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 space-y-1">{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-semibold text-cc-gray-900 text-lg dark:text-white">{children}</h2>
  )
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-cc-gray-500 text-sm">{children}</p>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>
}
