'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

export type ToastVariant = 'default' | 'success' | 'danger' | 'warning'

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: 'border-cc-gray-200 bg-white text-cc-gray-900 dark:border-cc-navy-700 dark:bg-cc-navy-900 dark:text-white',
  success: 'border-cc-success-200 bg-cc-success-50 text-cc-success-900',
  danger: 'border-cc-danger-200 bg-cc-danger-50 text-cc-danger-900',
  warning: 'border-cc-warn-200 bg-cc-warn-50 text-cc-warn-900',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      const duration = t.duration ?? 4000
      setItems((prev) => [...prev, { ...t, id }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss],
  )

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-80 rounded-md border px-3 py-2 shadow-lg',
              VARIANT_CLASS[t.variant ?? 'default'],
            )}
            role="status"
          >
            {t.title && <p className="font-medium text-sm">{t.title}</p>}
            {t.description && <p className="text-xs opacity-80">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
