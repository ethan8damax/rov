'use client'

import { useState, useEffect } from 'react'
import type { BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'

const PAGE_SIZE = 10

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
      <div className="w-11 h-4 rounded animate-pulse" style={{ background: 'var(--color-surface)' }} />
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
  const [page, setPage] = useState(0)

  // Reset to first page whenever the month/data changes
  useEffect(() => { setPage(0) }, [transactions])

  if (loading) {
    return <div>{Array.from({ length: PAGE_SIZE }).map((_, i) => <Skeleton key={i} />)}</div>
  }

  if (transactions.length === 0) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: 'var(--color-muted)' }}>
        No transactions this month. Click Sync to load from your connected banks.
      </p>
    )
  }

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE)
  const start      = page * PAGE_SIZE
  const slice      = transactions.slice(start, start + PAGE_SIZE)

  return (
    <div>
      {slice.map(t => (
        <TransactionRow
          key={t.id}
          id={t.id}
          merchantName={t.merchant_name}
          name={t.name}
          amount={t.amount}
          date={t.date}
          isPending={t.is_pending}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="text-[12px] px-3 py-1 rounded-md disabled:opacity-30"
            style={{ color: 'var(--color-muted)', background: 'var(--color-surface)' }}
          >
            ← Prev
          </button>
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {start + 1}–{Math.min(start + PAGE_SIZE, transactions.length)} of {transactions.length}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className="text-[12px] px-3 py-1 rounded-md disabled:opacity-30"
            style={{ color: 'var(--color-muted)', background: 'var(--color-surface)' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
