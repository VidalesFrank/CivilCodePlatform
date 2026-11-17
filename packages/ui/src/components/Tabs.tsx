'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be rendered inside <Tabs>')
  return ctx
}

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const controlled = value !== undefined
  const current = controlled ? value : internal

  const setValue = React.useCallback(
    (v: string) => {
      if (!controlled) setInternal(v)
      onValueChange?.(v)
    },
    [controlled, onValueChange],
  )

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 border-cc-gray-200 border-b dark:border-cc-navy-700',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const ctx = useTabsContext()
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={
        active
          ? 'border-cc-blue-600 border-b-2 px-4 py-2 font-medium text-cc-blue-600 text-sm'
          : 'border-transparent border-b-2 px-4 py-2 font-medium text-cc-gray-500 text-sm hover:text-cc-gray-700 dark:hover:text-cc-gray-300'
      }
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const ctx = useTabsContext()
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" className="mt-4">
      {children}
    </div>
  )
}
