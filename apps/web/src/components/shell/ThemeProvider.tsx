'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeCtx {
  theme: ThemeMode
  resolved: 'light' | 'dark'
  setTheme: (t: ThemeMode) => void
}

const ThemeContext = createContext<ThemeCtx | null>(null)

const STORAGE_KEY = 'cc-theme'

function resolveSystem(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  const next = theme === 'system' ? resolveSystem() : theme
  document.documentElement.setAttribute('data-theme', next)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    let initial: ThemeMode = 'light'
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      if (saved === 'light' || saved === 'dark' || saved === 'system') initial = saved
    } catch {
      /* ignore */
    }
    setThemeState(initial)
    apply(initial)
    setResolved(initial === 'system' ? resolveSystem() : initial)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light'
      setResolved(next)
      document.documentElement.setAttribute('data-theme', next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
    apply(t)
    setResolved(t === 'system' ? resolveSystem() : t)
  }, [])

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}

const NOOP_CTX: ThemeCtx = {
  theme: 'light',
  resolved: 'light',
  setTheme: () => {},
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext) ?? NOOP_CTX
}
