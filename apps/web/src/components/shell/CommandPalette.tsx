'use client'

import { type Project, projects } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRightIcon,
  BuildingIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparkleIcon,
  UsersIcon,
} from './nav-icons'

type ItemKind = 'nav' | 'action' | 'project'

interface CommandItem {
  id: string
  kind: ItemKind
  label: string
  hint?: string
  Icon: typeof HomeIcon
  onSelect: () => void
  keywords?: string
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [projectList, setProjectList] = useState<Project[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIdx(0)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    projects
      .list()
      .then(setProjectList)
      .catch(() => setProjectList([]))
    return () => clearTimeout(t)
  }, [open])

  const go = useCallback(
    (path: string) => {
      onClose()
      router.push(path)
    },
    [onClose, router],
  )

  const items: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = [
      { id: 'home', kind: 'nav', label: 'Inicio', hint: 'Dashboard', Icon: HomeIcon, onSelect: () => go('/dashboard'), keywords: 'inicio home dashboard' },
      { id: 'projects', kind: 'nav', label: 'Proyectos', Icon: FolderIcon, onSelect: () => go('/projects'), keywords: 'proyectos projects' },
      { id: 'analysis', kind: 'nav', label: 'Análisis', Icon: SparkleIcon, onSelect: () => go('/analysis'), keywords: 'analisis analysis' },
      { id: 'beams', kind: 'nav', label: 'Vigas', Icon: BuildingIcon, onSelect: () => go('/design/beams'), keywords: 'vigas beams diseño' },
      { id: 'columns', kind: 'nav', label: 'Columnas', Icon: BuildingIcon, onSelect: () => go('/design/columns'), keywords: 'columnas columns' },
      { id: 'walls', kind: 'nav', label: 'Muros', Icon: BuildingIcon, onSelect: () => go('/design/walls'), keywords: 'muros walls' },
      { id: 'profile', kind: 'nav', label: 'Perfil', Icon: SettingsIcon, onSelect: () => go('/settings/profile'), keywords: 'perfil profile ajustes settings' },
      { id: 'org', kind: 'nav', label: 'Organización', Icon: UsersIcon, onSelect: () => go('/settings/organization'), keywords: 'organizacion organization team' },
    ]
    const actions: CommandItem[] = [
      { id: 'new-project', kind: 'action', label: 'Crear proyecto', hint: 'Nuevo', Icon: PlusIcon, onSelect: () => go('/projects?new=1'), keywords: 'crear nuevo proyecto new project' },
    ]
    const proj: CommandItem[] = projectList.map((p) => ({
      id: `p-${p.id}`,
      kind: 'project',
      label: p.name,
      hint: p.code,
      Icon: FolderIcon,
      onSelect: () => go(`/projects/${p.id}`),
      keywords: `${p.name} ${p.code} ${p.client ?? ''}`,
    }))
    return [...nav, ...actions, ...proj]
  }, [projectList, go])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        (it.hint && it.hint.toLowerCase().includes(q)) ||
        (it.keywords && it.keywords.toLowerCase().includes(q)),
    )
  }, [items, query])

  useEffect(() => {
    setSelectedIdx((i) => Math.min(i, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const it = filtered[selectedIdx]
        if (it) it.onSelect()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, selectedIdx, onClose])

  if (!open) return null

  const grouped = {
    action: filtered.filter((i) => i.kind === 'action'),
    nav: filtered.filter((i) => i.kind === 'nav'),
    project: filtered.filter((i) => i.kind === 'project'),
  }

  let runningIdx = -1
  const renderGroup = (label: string, list: CommandItem[]) => {
    if (list.length === 0) return null
    return (
      <div key={label}>
        <div className="cc-cmdk-section-label">{label}</div>
        {list.map((it) => {
          runningIdx += 1
          const myIdx = runningIdx
          return (
            <button
              key={it.id}
              type="button"
              className="cc-cmdk-item w-full text-left"
              data-selected={myIdx === selectedIdx}
              onMouseEnter={() => setSelectedIdx(myIdx)}
              onClick={() => it.onSelect()}
            >
              <span className="cc-cmdk-item-icon">
                <it.Icon size={15} />
              </span>
              <span className="truncate">{it.label}</span>
              {it.hint && <span className="cc-cmdk-item-hint">{it.hint}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="cc-cmdk-overlay cursor-default"
      aria-label="Cerrar buscador"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cc-cmdk-panel"
        role="dialog"
        aria-label="Buscador global"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <span
            className="absolute top-1/2 left-5 -translate-y-1/2 text-cc-gray-400"
            aria-hidden="true"
          >
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cc-cmdk-input pl-11"
            placeholder="Buscar páginas, proyectos, acciones..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="cc-cmdk-empty">Sin resultados para «{query}»</div>
          ) : (
            <>
              {renderGroup('Acciones', grouped.action)}
              {renderGroup('Navegación', grouped.nav)}
              {renderGroup('Proyectos', grouped.project)}
            </>
          )}
        </div>
        <div className="cc-cmdk-footer">
          <span className="flex items-center gap-1.5">
            <span className="cc-kbd">↑</span>
            <span className="cc-kbd">↓</span>
            moverse
          </span>
          <span className="flex items-center gap-1.5">
            <span className="cc-kbd">⏎</span>
            abrir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="cc-kbd">esc</span>
            cerrar
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <ArrowRightIcon size={12} />
            CivilCode Studio
          </span>
        </div>
      </div>
    </button>
  )
}
