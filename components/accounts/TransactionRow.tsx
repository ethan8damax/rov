'use client'

import { useState, useRef } from 'react'
import type { BudgetCategory } from '@/types'
import { fmt } from '@/lib/utils'
import { updateTransactionCategory, upsertMerchantRule, markTransactionIgnored, unignoreTransaction } from '@/lib/queries/accounts'
import { createBudgetCategory } from '@/lib/queries/finance'

interface TransactionRowProps {
  id:                string
  merchantName:      string | null
  name:              string
  amount:            number
  date:              string
  isPending:         boolean
  isIgnored:         boolean
  categoryId:        string | null
  categoryName:      string | null
  accountName:       string | null
  accountMask:       string | null
  categories:        BudgetCategory[]
  householdId:       string
  month:             string
  onCategoryCreated: (cat: BudgetCategory) => void
  onCategorized?:    (id: string) => void
  onIgnored?:        (id: string) => void
}

export default function TransactionRow({
  id, merchantName, name, amount, date, isPending, isIgnored,
  categoryId, categoryName, accountName, accountMask,
  categories, householdId, month, onCategoryCreated,
  onCategorized, onIgnored,
}: TransactionRowProps) {
  const [currentCatId,   setCurrentCatId]   = useState(categoryId)
  const [currentCatName, setCurrentCatName] = useState(categoryName)
  const [currentIgnored, setCurrentIgnored] = useState(isIgnored)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [addingNew,      setAddingNew]      = useState(false)
  const [newCatName,     setNewCatName]     = useState('')
  const newCatInputRef = useRef<HTMLInputElement>(null)

  async function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === '__new__') {
      setAddingNew(true)
      setTimeout(() => newCatInputRef.current?.focus(), 0)
      return
    }
    if (val === '__na__') {
      setSaving(true)
      try {
        await markTransactionIgnored(id)
        setCurrentCatId(null)
        setCurrentCatName(null)
        setCurrentIgnored(true)
        onIgnored?.(id)
      } catch (err) {
        console.error('Failed to mark ignored', err)
      } finally {
        setSaving(false)
      }
      return
    }
    const newCatId = val || null
    const newCat   = categories.find(c => c.id === newCatId) ?? null
    setSaving(true)
    try {
      await updateTransactionCategory(id, newCatId)
      if (currentIgnored) {
        await unignoreTransaction(id)
        setCurrentIgnored(false)
      }
      if (newCat && merchantName) {
        await upsertMerchantRule(householdId, merchantName, newCat.name)
      }
      setCurrentCatId(newCatId)
      setCurrentCatName(newCat?.name ?? null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
      if (newCatId) onCategorized?.(id)
    } catch (err) {
      console.error('Failed to update category', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newCatName.trim()
    if (!trimmed) { setAddingNew(false); return }
    setSaving(true)
    try {
      const created = await createBudgetCategory({ name: trimmed, month, expected: 0, actual: 0 })
      onCategoryCreated(created)
      await updateTransactionCategory(id, created.id)
      if (merchantName) await upsertMerchantRule(householdId, merchantName, created.name)
      setCurrentCatId(created.id)
      setCurrentCatName(created.name)
      setNewCatName('')
      setAddingNew(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
      onCategorized?.(id)
    } catch (err) {
      console.error('Failed to create category', err)
    } finally {
      setSaving(false)
    }
  }

  const displayName = merchantName ?? name
  const isExpense   = amount > 0

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{
        borderBottom: '0.5px solid var(--color-border)',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] truncate"
          style={{
            color:     'var(--color-foreground)',
            fontStyle: isPending ? 'italic' : 'normal',
          }}
        >
          {displayName}
          {isPending && (
            <span
              className="ml-1.5 inline-block text-[9px] px-1 py-px rounded"
              style={{
                background:    'var(--color-border)',
                color:         'var(--color-muted)',
                letterSpacing: '0.04em',
                verticalAlign: 'middle',
                fontStyle:     'normal',
              }}
            >
              pending
            </span>
          )}
        </p>

        {accountName && (
          <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
            {accountName}{accountMask ? ` ···${accountMask}` : ''}
          </p>
        )}

        {addingNew ? (
          <form onSubmit={handleCreateCategory} className="flex items-center gap-1 mt-0.5">
            <input
              ref={newCatInputRef}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setAddingNew(false)}
              placeholder="Category name"
              disabled={saving}
              className="text-[11px] bg-transparent border-b outline-none flex-1 min-w-0"
              style={{ color: 'var(--color-foreground)', borderColor: 'var(--color-primary)', fontSize: '16px' }}
            />
            <button
              type="submit"
              disabled={saving || !newCatName.trim()}
              className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-40"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="text-[10px]"
              style={{ color: 'var(--color-muted)' }}
            >
              ✕
            </button>
          </form>
        ) : (
          <select
            value={currentIgnored ? '__na__' : (currentCatId ?? '')}
            onChange={handleCategoryChange}
            disabled={saving || isPending}
            className="mt-0.5 text-[11px] bg-transparent border-none outline-none cursor-pointer max-w-full"
            style={{ color: currentIgnored ? 'var(--color-muted)' : currentCatName ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <option value="__na__" style={{ color: 'var(--color-muted)' }}>N/A — transfer or ignore</option>
            <option value="">Uncategorized</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>
        )}
      </div>

      <span
        className="text-[13px] font-medium tabular-nums flex-shrink-0 transition-colors"
        style={{ color: saved ? 'var(--color-positive)' : isExpense ? 'var(--color-negative)' : 'var(--color-positive)' }}
      >
        {isExpense ? '−' : '+'}{fmt(Math.abs(amount))}
      </span>
    </div>
  )
}
