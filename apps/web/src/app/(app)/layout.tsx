'use client'

import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { useEffect, useState } from 'react'

const COLLAPSED_STORAGE_KEY = 'cc-sidebar-collapsed'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile sheet
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Hidratar collapsed desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY)
      if (saved === 'true') setSidebarCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  function toggleCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className="flex h-screen flex-col bg-cc-gray-50 dark:bg-cc-navy-950">
      <TopBar
        onMenuClick={() => setSidebarOpen(true)}
        onSidebarToggle={toggleCollapsed}
        sidebarCollapsed={sidebarCollapsed}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
