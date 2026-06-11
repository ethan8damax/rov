'use client'

import { useState } from 'react'
import type { BudgetCategory } from '@/types'
import { fmt } from '@/lib/utils'
import { updateTransactionCategory, upsertMerchantRule } from '@/lib/queries/accounts'

interface TransactionRowProps {
  id:           string
  merchantName: string | null
  name:         string
  amount:       number
  date:         string
  isPending:    boolean
  categoryId:   string | null
  categoryName: string | null
  categories:   BudgetCategory[]
  householdId:  string
}

export default function TransactionRow({
  id, merchantName, name, amount, date, isPending,
  categoryId, categoryName, categories, householdId,
}: TransactionRowProps) {
  const [currentCatId,   setCurrentCatId]   = useState(categoryId)
  const [currentCatName, setCurrentCatName] = useState(categoryName)
  const [saving, setSaving] = useState(false)

  async function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCatId = e.target.value || null
    const newCat   = categories.find(c => c.id === newCatId) ?? null
    setSaving(true)
    try {
      await updateTransactionCategory(id, newCatId)
      if (newCat && merchantName) {
        await upsertMerchantRule(householdId, merchantName, newCat.name)
      }
      setCurrentCatId(newCatId)
      setCurrentCatName(newCat?.name ?? null)
    } catch (err) {
      console.error('Failed to update category', err)
    } finally {
      setSaving(false)
    }
  }

  const displayName   = merchantName ?? name
  const isExpense     = amount > 0
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      <span
        className="text-[11px] w-11 flex-shrink-0 tabular-nums"
        style={{ color: 'var(--color-muted)' }}
      >
        {formattedDate}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>
          {displayName}
          {isPending && (
            <span className="ml-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>pending</span>
          )}
        </p>
        <select
          value={currentCatId ?? ''}
          onChange={handleCategoryChange}
          disabled={saving}
          className="mt-0.5 text-[11px] bg-transparent border-none outline-none cursor-pointer"
          style={{ color: currentCatName ? 'var(--color-primary)' : 'var(--color-muted)' }}
        >
          <option value="">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <span
        className="text-[13px] font-medium tabular-nums flex-shrink-0"
        style={{ color: isExpense ? 'var(--color-foreground)' : 'var(--color-positive)' }}
      >
        {!isExpense && '+'}{fmt(Math.abs(amount))}
      </span>
    </div>
  )
}
