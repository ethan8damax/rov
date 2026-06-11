import type { BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'

interface TransactionListProps {
  transactions: TransactionWithCategory[]
  categories:   BudgetCategory[]
  householdId:  string
  loading?:     boolean
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

export default function TransactionList({ transactions, categories, householdId, loading }: TransactionListProps) {
  if (loading) {
    return <div>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>
  }

  if (transactions.length === 0) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: 'var(--color-muted)' }}>
        No transactions yet. Click Sync to load from your connected banks.
      </p>
    )
  }

  return (
    <div>
      {transactions.map(t => (
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
          categories={categories}
          householdId={householdId}
        />
      ))}
    </div>
  )
}
