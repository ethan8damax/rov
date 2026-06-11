'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/context/auth'
import { useTheme } from './ThemeProvider'

function HomeIcon()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function BudgetIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> }
function AccountsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> }
function WealthIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> }
function SettingsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }

const nav = [
  { href: '/',         label: 'Home',     Icon: HomeIcon },
  { href: '/budget',   label: 'Budget',   Icon: BudgetIcon },
  { href: '/accounts', label: 'Accounts', Icon: AccountsIcon },
  { href: '/wealth',   label: 'Wealth',   Icon: WealthIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
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
        {nav.map(({ href, label, Icon }) => {
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
              <Icon />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
            {displayName ?? ''}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="text-[12px] px-1.5 py-0.5 rounded"
              style={{ color: 'var(--color-muted)', background: 'var(--color-border)' }}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              onClick={signOut}
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ color: 'var(--color-muted)', background: 'var(--color-border)' }}
            >
              ↪
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
