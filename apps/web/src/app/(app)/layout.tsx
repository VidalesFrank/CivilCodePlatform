import { TopBar } from '@/components/shell/TopBar'
import { Sidebar } from '@/components/shell/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-cc-gray-50 dark:bg-cc-navy-950">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
