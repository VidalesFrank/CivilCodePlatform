'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

interface DropdownContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

function useDropdown(): DropdownContextValue {
  const ctx = React.useContext(DropdownContext)
  if (!ctx) throw new Error('DropdownMenu* must be used inside <DropdownMenu>')
  return ctx
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <span className="relative inline-flex">{children}</span>
    </DropdownContext.Provider>
  )
}

export function DropdownMenuTrigger({
  children,
}: {
  children: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>
}) {
  const { open, setOpen, triggerRef } = useDropdown()
  const originalClick = children.props.onClick
  return React.cloneElement(children, {
    ref: triggerRef as React.Ref<HTMLButtonElement>,
    'aria-expanded': open,
    'aria-haspopup': 'menu',
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      setOpen(!open)
      originalClick?.(e)
    },
  } as React.ButtonHTMLAttributes<HTMLButtonElement>)
}

export function DropdownMenuContent({
  className,
  align = 'start',
  children,
}: {
  className?: string
  align?: 'start' | 'end'
  children: React.ReactNode
}) {
  const { open } = useDropdown()
  if (!open) return null
  return (
    <div
      role="menu"
      className={cn(
        'absolute z-50 mt-1 min-w-[10rem] rounded-md border border-cc-gray-200 bg-white p-1 shadow-lg dark:border-cc-navy-700 dark:bg-cc-navy-900',
        align === 'end' ? 'right-0 top-full' : 'left-0 top-full',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  className,
  children,
  onSelect,
}: {
  className?: string
  children: React.ReactNode
  onSelect?: () => void
}) {
  const { setOpen } = useDropdown()
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onSelect?.()
        setOpen(false)
      }}
      className={cn(
        'flex w-full items-center rounded px-2 py-1.5 text-cc-gray-700 text-sm hover:bg-cc-gray-100 dark:text-cc-gray-200 dark:hover:bg-cc-navy-800',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-cc-gray-200 dark:bg-cc-navy-700" />
}
