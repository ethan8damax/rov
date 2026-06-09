'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',         label: 'Home',     icon: '⌂' },
  { href: '/budget',   label: 'Budget',   icon: '▤' },
  { href: '/accounts', label: 'Accounts', icon: '⊞' },
  { href: '/wealth',   label: 'Wealth',   icon: '↗' },
  { href: '/settings', label: 'More',     icon: '⋯' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-50"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ href, label, icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center py-2 gap-0.5"
            style={{ color: active ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <span className="text-[18px] leading-none">{icon}</span>
            <span className="text-[9px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
