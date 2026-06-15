'use client'

import type { BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'

interface TriageSectionProps {
  transactions:      TransactionWithCategory[]
  categories:        BudgetCategory[]
  householdId:       string
  month:             string
  onCategoryCreated: (cat: BudgetCategory) => void
  onResolved:        (id: string) => void
}

export default function TriageSection({
  transactions, categories, householdId, month, onCategoryCreated, onResolved,
}: TriageSectionProps) {
  if (transactions.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[14px] font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
        Needs a category ({transactions.length})
      </p>
      <div
        style={{
          background:   'var(--color-surface)',
          border:       '0.5px solid var(--color-border)',
          borderRadius: '12px',
          padding:      '0 1rem',
        }}
      >
        {transactions.map(t => (
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
            onCategorized={onResolved}
            onIgnored={onResolved}
          />
        ))}
      </div>
    </div>
  )
}
