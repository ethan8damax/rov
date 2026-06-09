import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0 min-w-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
