'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/context/auth'
import { useTheme } from './ThemeProvider'

const nav = [
  { href: '/',         label: 'Home',     icon: '⌂' },
  { href: '/budget',   label: 'Budget',   icon: '▤' },
  { href: '/accounts', label: 'Accounts', icon: '⊞' },
  { href: '/wealth',   label: 'Wealth',   icon: '↗' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { displayName, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <aside
      className="hidden md:flex flex-col w-[200px] flex-shrink-0 h-screen sticky top-0 border-r"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <span className="text-[14px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Rov
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 flex flex-col gap-0.5">
        {nav.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
              style={{
                background: active ? 'var(--color-primary-subtle)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
            {displayName ?? ''}
          </span>
          <button
            onClick={toggle}
            className="text-[12px] px-2 py-0.5 rounded"
            style={{ color: 'var(--color-muted)', background: 'var(--color-border)' }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <button
          onClick={signOut}
          className="text-[12px] w-full text-left"
          style={{ color: 'var(--color-muted)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
