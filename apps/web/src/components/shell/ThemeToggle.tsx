'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@civilcode/ui'
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from './nav-icons'
import { type ThemeMode, useTheme } from './ThemeProvider'

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Claro', Icon: SunIcon },
  { value: 'dark', label: 'Oscuro', Icon: MoonIcon },
  { value: 'system', label: 'Sistema', Icon: MonitorIcon },
]

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          className="cc-icon-btn"
          aria-label={`Tema: ${theme}. Cambiar tema`}
          title="Cambiar tema"
        >
          {resolved === 'dark' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className="flex items-center gap-2"
          >
            <Icon size={15} />
            <span className="flex-1">{label}</span>
            {theme === value && <CheckIcon size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
