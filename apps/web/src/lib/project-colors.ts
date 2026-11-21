export interface ProjectPalette {
  c1: string
  c2: string
  accent: string
}

export const PROJECT_PALETTES: ProjectPalette[] = [
  { c1: '#0f172a', c2: '#1e293b', accent: '#22d3ee' },
  { c1: '#082f49', c2: '#0c4a6e', accent: '#38bdf8' },
  { c1: '#1e1b4b', c2: '#312e81', accent: '#818cf8' },
  { c1: '#064e3b', c2: '#065f46', accent: '#34d399' },
  { c1: '#3b0764', c2: '#581c87', accent: '#c084fc' },
  { c1: '#7c2d12', c2: '#9a3412', accent: '#fb923c' },
  { c1: '#164e63', c2: '#155e75', accent: '#67e8f9' },
]

const OVERRIDE_KEY = 'cc-project-palette-overrides'

function readOverrides(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function setPaletteOverride(projectId: string, paletteIndex: number): void {
  if (typeof window === 'undefined') return
  try {
    const map = readOverrides()
    map[projectId] = paletteIndex
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function paletteByIndex(i: number): ProjectPalette {
  return PROJECT_PALETTES[((i % PROJECT_PALETTES.length) + PROJECT_PALETTES.length) % PROJECT_PALETTES.length]
}

export function hashPaletteIndex(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h % PROJECT_PALETTES.length
}

export function projectPalette(input: string, projectId?: string): ProjectPalette {
  if (projectId) {
    const overrides = readOverrides()
    const idx = overrides[projectId]
    if (typeof idx === 'number') return paletteByIndex(idx)
  }
  return paletteByIndex(hashPaletteIndex(input))
}
