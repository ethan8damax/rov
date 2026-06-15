'use client'

import { useMemo } from 'react'
import type { BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'
import { fmt } from '@/lib/utils'

interface TransactionListProps {
  transactions:      TransactionWithCategory[]
  categories:        BudgetCategory[]
  householdId:       string
  month:             string
  loading?:          boolean
  onCategoryCreated: (cat: BudgetCategory) => void
}

function Skeleton() {
  return (
    <div className="flex gap-3 py-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex-1">
        <div className="h-4 w-40 rounded animate-pulse mb-1.5" style={{ background: 'var(--color-surface)' }} />
        <div className="h-3 w-20 rounded animate-pulse"        style={{ background: 'var(--color-surface)' }} />
      </div>
      <div className="w-14 h-4 rounded animate-pulse" style={{ background: 'var(--color-surface)' }} />
    </div>
  )
}

export default function TransactionList({
  transactions, categories, householdId, month, loading, onCategoryCreated,
}: TransactionListProps) {
  const grouped = useMemo(() => {
    const map: Record<string, TransactionWithCategory[]> = {}
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [transactions])

  if (loading) {
    return <div>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>
  }

  if (transactions.length === 0) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: 'var(--color-muted)' }}>
        No transactions this month. Click Sync to load from your connected banks.
      </p>
    )
  }

  return (
    <div>
      {grouped.map(([date, dayTxs]) => {
        const dayExpenses = dayTxs.reduce((s, t) => t.amount > 0 ? s + t.amount : s, 0)
        const dayLabel    = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })
        return (
          <div key={date}>
            <div
              className="flex items-center justify-between py-2 sticky top-0 z-10"
              style={{ background: 'var(--color-background)', borderBottom: '0.5px solid var(--color-border-subtle)' }}
            >
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
                {dayLabel}
              </span>
              {dayExpenses > 0 && (
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-muted)' }}>
                  {fmt(dayExpenses)}
                </span>
              )}
            </div>
            {dayTxs.map(t => (
              <TransactionRow
                key={t.id}
                id={t.id}
                merchantName={t.merchant_name}
                name={t.name}
                amount={t.amount}
                date={t.date}
                isPending={t.is_pending}
                isIgnored={t.is_ignored}
                categoryId={t.category_id}
                categoryName={t.category_name}
                accountName={t.account_name}
                accountMask={t.account_mask}
                categories={categories}
                householdId={householdId}
                month={month}
                onCategoryCreated={onCategoryCreated}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
