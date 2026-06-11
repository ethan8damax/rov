import type { AccountWithBalance } from '@/types'
import { fmt } from '@/lib/utils'

interface AccountCardProps {
  account: AccountWithBalance
}

function typeLabel(type: string, subtype: string): string {
  const label = subtype || type
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ')
}

export default function AccountCard({ account }: AccountCardProps) {
  const balance  = account.balances.current ?? account.balances.available
  const isCredit = account.type === 'credit'

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background:   'var(--color-surface)',
        border:       '0.5px solid var(--color-border)',
        borderRadius: '12px',
      }}
    >
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          {account.name}
          {account.mask && (
            <span style={{ color: 'var(--color-muted)' }}> ···{account.mask}</span>
          )}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {account.institution_name} · {typeLabel(account.type, account.subtype)}
        </p>
      </div>

      <div className="text-right">
        {balance != null ? (
          <p
            className="text-[15px] font-medium tabular-nums"
            style={{ color: isCredit ? 'var(--color-negative)' : 'var(--color-foreground)' }}
          >
            {isCredit && balance > 0 ? '−' : ''}{fmt(Math.abs(balance))}
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>—</p>
        )}
        {!isCredit && account.balances.available != null && (
          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {fmt(account.balances.available)} available
          </p>
        )}
      </div>
    </div>
  )
}
