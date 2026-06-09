'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

const AUTH_ROUTES = ['/login', '/signup', '/join']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_ROUTES.some(r => pathname === r || pathname.startsWith(r + '?'))

  if (isAuth) return <>{children}</>

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
