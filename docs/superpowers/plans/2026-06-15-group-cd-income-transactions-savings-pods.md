# Group C+D — Income Transactions & Savings Pod Accounts: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (C) Let income transactions be assigned to income sources and sync actual income from bank; (D) Let the user pick which Plaid accounts drive the savings balance on the Wealth page.

**Architecture:** Two independent DB migrations, a shared query-layer expansion, then UI changes layered top-down from queries → components → pages. Group C threads through four existing files (TransactionRow, TransactionList, TriageSection, AccountsPage, BudgetPage/IncomeTab). Group D threads through WealthPage + SavingsSection (both in `app/wealth/page.tsx`).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgREST, Tailwind CSS, `@supabase/supabase-js` v2 browser client.

---

## File map

| File | Change |
|---|---|
| `types/index.ts` | Add `income_source_id` to `Transaction` |
| `lib/queries/accounts.ts` | Add fields to `TransactionWithCategory`; update `getTransactions`, `getUncategorizedCount`, `markTransactionIgnored`; add `updateTransactionIncomeSource`, `getTransactionSumsByIncomeSource`, `getSavingsPodAccounts`, `setSavingsPodAccount` |
| `components/accounts/TransactionRow.tsx` | Add income branch: income source dropdown + N/A handling; new props |
| `components/accounts/TransactionList.tsx` | Add `incomeSources` prop, forward to rows |
| `components/accounts/TriageSection.tsx` | Add `incomeSources` prop, forward to rows |
| `app/accounts/page.tsx` | Load income sources, update triage filter, pass `incomeSources` |
| `app/budget/page.tsx` | Load `incomeBankSums` in parallel, pass to `IncomeTab` |
| `components/budget/IncomeTab.tsx` | Add `bankSums` prop, `handleSyncActuals`, sync button, `useToast` |
| `app/wealth/page.tsx` | Load `podAccounts`, recompute `savingsBalance`, configure dropdown in `SavingsSection` |

---

### Task 1: DB migration — `income_source_id` on `transactions`

**Files:**
- Supabase MCP: `apply_migration`

- [ ] **Step 1: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with this SQL:

```sql
ALTER TABLE transactions
  ADD COLUMN income_source_id uuid REFERENCES income_sources(id) ON DELETE SET NULL;
```

Name: `add_income_source_id_to_transactions`

- [ ] **Step 2: Verify column exists**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'income_source_id';
```

Expected: one row returned with `data_type = uuid`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add income_source_id FK to transactions"
```

---

### Task 2: Type + query layer — income source fields

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/queries/accounts.ts`

- [ ] **Step 1: Add `income_source_id` to `Transaction` in `types/index.ts`**

Current `Transaction` interface (lines 139-152). After `is_ignored: boolean` add:

```ts
export interface Transaction {
  id: string
  household_id: string
  account_id: string
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  category_id: string | null
  income_source_id: string | null
  is_pending: boolean
  is_ignored: boolean
  created_at: string
}
```

- [ ] **Step 2: Update `TransactionWithCategory` in `lib/queries/accounts.ts`**

Replace the current interface (lines 3-16) with:

```ts
export interface TransactionWithCategory {
  id: string
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  is_pending: boolean
  is_ignored: boolean
  category_id: string | null
  category_name: string | null
  income_source_id: string | null
  income_source_name: string | null
  account_name: string | null
  account_mask: string | null
}
```

- [ ] **Step 3: Update `getTransactions` to include income source**

Replace the function (lines 18-50) with:

```ts
export async function getTransactions(
  householdId: string,
  month: string,
): Promise<TransactionWithCategory[]> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_id, merchant_name, name, amount, date, is_pending, is_ignored, category_id, income_source_id, budget_categories(name), income_sources(name), plaid_accounts(name, mask)')
    .eq('household_id', householdId)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(t => ({
    id:                 t.id,
    transaction_id:     t.transaction_id,
    merchant_name:      t.merchant_name,
    name:               t.name,
    amount:             t.amount,
    date:               t.date,
    is_pending:         t.is_pending,
    is_ignored:         t.is_ignored,
    category_id:        t.category_id,
    category_name:      (t.budget_categories as unknown as { name: string } | null)?.name ?? null,
    income_source_id:   t.income_source_id,
    income_source_name: (t.income_sources as unknown as { name: string } | null)?.name ?? null,
    account_name:       (t.plaid_accounts as unknown as { name: string; mask: string } | null)?.name ?? null,
    account_mask:       (t.plaid_accounts as unknown as { name: string; mask: string } | null)?.mask ?? null,
  }))
}
```

- [ ] **Step 4: Update `getUncategorizedCount` to also filter `income_source_id IS NULL`**

Replace the function (lines 52-73) with:

```ts
export async function getUncategorizedCount(
  householdId: string,
  month: string,
): Promise<number> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('category_id', null)
    .is('income_source_id', null)
    .eq('is_pending', false)
    .eq('is_ignored', false)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
  if (error) throw error
  return count ?? 0
}
```

- [ ] **Step 5: Update `markTransactionIgnored` to clear `income_source_id`**

Replace the function (lines 87-94) with:

```ts
export async function markTransactionIgnored(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ is_ignored: true, category_id: null, income_source_id: null })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 6: Add `updateTransactionIncomeSource` and `getTransactionSumsByIncomeSource`**

Append to the end of `lib/queries/accounts.ts` (before `updateAccountName`):

```ts
export async function updateTransactionIncomeSource(
  transactionId: string,
  incomeSourceId: string | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ income_source_id: incomeSourceId })
    .eq('id', transactionId)
  if (error) throw error
}

export async function getTransactionSumsByIncomeSource(
  householdId: string,
  month: string,
): Promise<{ income_source_id: string; total: number }[]> {
  const supabase = createClient()
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12
    ? `${year + 1}-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('transactions')
    .select('income_source_id, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .not('income_source_id', 'is', null)
    .lt('amount', 0)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const t of data ?? []) {
    if (!t.income_source_id) continue
    totals[t.income_source_id] = (totals[t.income_source_id] ?? 0) + Math.abs(t.amount)
  }
  return Object.entries(totals).map(([income_source_id, total]) => ({ income_source_id, total }))
}
```

- [ ] **Step 7: Run build to catch type errors**

```bash
npm run build 2>&1 | tail -30
```

Expected: no TypeScript errors in `lib/queries/accounts.ts` or `types/index.ts`. (There will be TypeScript errors in components that haven't been updated yet — that's expected.)

- [ ] **Step 8: Commit**

```bash
git add types/index.ts lib/queries/accounts.ts
git commit -m "feat: income source query layer — TransactionWithCategory fields + new query functions"
```

---

### Task 3: `TransactionRow` income branch

**Files:**
- Modify: `components/accounts/TransactionRow.tsx`

- [ ] **Step 1: Add import and new props**

Replace the file content with:

```tsx
'use client'

import { useState, useRef } from 'react'
import type { BudgetCategory, IncomeSource } from '@/types'
import { fmt } from '@/lib/utils'
import {
  updateTransactionCategory, upsertMerchantRule, markTransactionIgnored, unignoreTransaction,
  updateTransactionIncomeSource,
} from '@/lib/queries/accounts'
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
  incomeSourceId:    string | null
  incomeSourceName:  string | null
  accountName:       string | null
  accountMask:       string | null
  categories:        BudgetCategory[]
  incomeSources:     IncomeSource[]
  householdId:       string
  month:             string
  onCategoryCreated: (cat: BudgetCategory) => void
  onCategorized?:    (id: string) => void
  onIgnored?:        (id: string) => void
}

export default function TransactionRow({
  id, merchantName, name, amount, date, isPending, isIgnored,
  categoryId, categoryName, incomeSourceId, incomeSourceName,
  accountName, accountMask,
  categories, incomeSources, householdId, month, onCategoryCreated,
  onCategorized, onIgnored,
}: TransactionRowProps) {
  const [currentCatId,       setCurrentCatId]       = useState(categoryId)
  const [currentCatName,     setCurrentCatName]     = useState(categoryName)
  const [currentIncSrcId,    setCurrentIncSrcId]    = useState(incomeSourceId)
  const [currentIncSrcName,  setCurrentIncSrcName]  = useState(incomeSourceName)
  const [currentIgnored,     setCurrentIgnored]     = useState(isIgnored)
  const [saving,             setSaving]             = useState(false)
  const [saved,              setSaved]              = useState(false)
  const [addingNew,          setAddingNew]          = useState(false)
  const [newCatName,         setNewCatName]         = useState('')
  const newCatInputRef = useRef<HTMLInputElement>(null)

  const isIncome  = amount < 0
  const isExpense = amount > 0

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

  async function handleIncomeSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === '__na__') {
      setSaving(true)
      try {
        await markTransactionIgnored(id)
        setCurrentIncSrcId(null)
        setCurrentIncSrcName(null)
        setCurrentIgnored(true)
        onIgnored?.(id)
      } catch (err) {
        console.error('Failed to mark ignored', err)
      } finally {
        setSaving(false)
      }
      return
    }
    const newSrcId = val || null
    const newSrc   = incomeSources.find(s => s.id === newSrcId) ?? null
    setSaving(true)
    try {
      if (currentIgnored) {
        await unignoreTransaction(id)
        setCurrentIgnored(false)
      }
      await updateTransactionIncomeSource(id, newSrcId)
      setCurrentIncSrcId(newSrcId)
      setCurrentIncSrcName(newSrc?.name ?? null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
      if (newSrcId) onCategorized?.(id)
    } catch (err) {
      console.error('Failed to update income source', err)
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

        {isIncome ? (
          <select
            value={currentIgnored ? '__na__' : (currentIncSrcId ?? '')}
            onChange={handleIncomeSourceChange}
            disabled={saving || isPending}
            className="mt-0.5 text-[11px] bg-transparent border-none outline-none cursor-pointer max-w-full"
            style={{ color: currentIgnored ? 'var(--color-muted)' : currentIncSrcName ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <option value="__na__" style={{ color: 'var(--color-muted)' }}>N/A — transfer or ignore</option>
            <option value="">Unassigned</option>
            {incomeSources.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.owner})</option>
            ))}
          </select>
        ) : addingNew ? (
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
```

- [ ] **Step 2: Commit**

```bash
git add components/accounts/TransactionRow.tsx
git commit -m "feat: TransactionRow income branch — income source dropdown and N/A handling"
```

---

### Task 4: `TransactionList` and `TriageSection` — add `incomeSources` prop

**Files:**
- Modify: `components/accounts/TransactionList.tsx`
- Modify: `components/accounts/TriageSection.tsx`

- [ ] **Step 1: Update `TransactionList`**

Replace file content with:

```tsx
'use client'

import { useMemo } from 'react'
import type { BudgetCategory, IncomeSource } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'
import { fmt } from '@/lib/utils'

interface TransactionListProps {
  transactions:      TransactionWithCategory[]
  categories:        BudgetCategory[]
  incomeSources:     IncomeSource[]
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
  transactions, categories, incomeSources, householdId, month, loading, onCategoryCreated,
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
                incomeSourceId={t.income_source_id}
                incomeSourceName={t.income_source_name}
                accountName={t.account_name}
                accountMask={t.account_mask}
                categories={categories}
                incomeSources={incomeSources}
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
```

- [ ] **Step 2: Update `TriageSection`**

Replace file content with:

```tsx
'use client'

import type { BudgetCategory, IncomeSource } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'

interface TriageSectionProps {
  transactions:      TransactionWithCategory[]
  categories:        BudgetCategory[]
  incomeSources:     IncomeSource[]
  householdId:       string
  month:             string
  onCategoryCreated: (cat: BudgetCategory) => void
  onResolved:        (id: string) => void
}

export default function TriageSection({
  transactions, categories, incomeSources, householdId, month, onCategoryCreated, onResolved,
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
            incomeSourceId={t.income_source_id}
            incomeSourceName={t.income_source_name}
            accountName={t.account_name}
            accountMask={t.account_mask}
            categories={categories}
            incomeSources={incomeSources}
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
```

- [ ] **Step 3: Commit**

```bash
git add components/accounts/TransactionList.tsx components/accounts/TriageSection.tsx
git commit -m "feat: TransactionList + TriageSection — add incomeSources prop"
```

---

### Task 5: `AccountsPage` — load income sources, update triage filter

**Files:**
- Modify: `app/accounts/page.tsx`

- [ ] **Step 1: Update imports and state**

At the top of the file, update the imports block:

```tsx
import { getTransactions } from '@/lib/queries/accounts'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import { getBudgetCategories, getIncomeSources } from '@/lib/queries/finance'
import { currentMonth, shiftMonth, formatMonthLabel } from '@/lib/utils'
import type { AccountWithBalance, BudgetCategory, IncomeSource } from '@/types'
```

- [ ] **Step 2: Add `incomeSources` state**

In the `AccountsPage` function body, after `const [categories, setCategories]` line, add:

```ts
const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
```

- [ ] **Step 3: Update `loadTransactions` to load income sources**

Replace the `loadTransactions` callback:

```ts
const loadTransactions = useCallback(async () => {
  if (!householdId) return
  setLoadingTx(true)
  try {
    const [txs, cats, srcs] = await Promise.all([
      getTransactions(householdId, month),
      getBudgetCategories(month),
      getIncomeSources(month),
    ])
    setTransactions(txs)
    setCategories(cats)
    setIncomeSources(srcs)
  } catch {
    setError('Failed to load transactions')
  } finally {
    setLoadingTx(false)
  }
}, [householdId, month])
```

- [ ] **Step 4: Update triage filter to include `income_source_id`**

Find the `uncategorized` derivation:

```ts
const uncategorized = transactions.filter(
  t => !t.category_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
)
```

Replace with:

```ts
const uncategorized = transactions.filter(
  t => !t.category_id && !t.income_source_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
)
```

- [ ] **Step 5: Pass `incomeSources` to `TriageSection` and `TransactionList`**

Find the `TriageSection` JSX and add the prop:

```tsx
<TriageSection
  transactions={uncategorized}
  categories={categories}
  incomeSources={incomeSources}
  householdId={householdId}
  month={month}
  onCategoryCreated={addCategory}
  onResolved={handleResolved}
/>
```

Find the `TransactionList` JSX and add the prop:

```tsx
<TransactionList
  transactions={pagedTxs}
  categories={categories}
  incomeSources={incomeSources}
  householdId={householdId}
  month={month}
  loading={loadingTx}
  onCategoryCreated={addCategory}
/>
```

- [ ] **Step 6: Run build to check types**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors in the accounts files.

- [ ] **Step 7: Commit**

```bash
git add app/accounts/page.tsx
git commit -m "feat: AccountsPage — load income sources, update triage filter, pass incomeSources"
```

---

### Task 6: `BudgetPage` + `IncomeTab` — income bank sums and sync button

**Files:**
- Modify: `app/budget/page.tsx`
- Modify: `components/budget/IncomeTab.tsx`

- [ ] **Step 1: Update `BudgetPage` to import and load income bank sums**

In `app/budget/page.tsx`, add `getTransactionSumsByIncomeSource` to the accounts import:

```ts
import { getTransactionSumsByCategory, getTransactionSumsByIncomeSource } from '@/lib/queries/accounts'
```

Add `incomeBankSums` state after `bankSums`:

```ts
const [incomeBankSums, setIncomeBankSums] = useState<{ income_source_id: string; total: number }[]>([])
```

In the `load` function, update the parallel fetch (current line: `const [cats, incs, recs, names, pastCats, sums] = await Promise.all([...])`) to also fetch income sums:

```ts
const [cats, incs, recs, names, pastCats, sums, incSums] = await Promise.all([
  getBudgetCategories(month),
  getIncomeSources(month),
  getRecurringPayments(),
  getHouseholdMemberNames(),
  getBudgetCategoriesPastMonths(trendMonths),
  householdId ? getTransactionSumsByCategory(householdId, month) : Promise.resolve([]),
  householdId ? getTransactionSumsByIncomeSource(householdId, month) : Promise.resolve([]),
])
setCategories(cats)
setIncomes(incs)
setRecurrings(recs)
setOwners(names)
setPastCategories(pastCats)
setBankSums(sums)
setIncomeBankSums(incSums)
```

- [ ] **Step 2: Pass `incomeBankSums` to `IncomeTab`**

Find the `IncomeTab` JSX in the render:

```tsx
{tab === 'income' && (
  <IncomeTab month={month} incomes={incomes} setIncomes={setIncomes} owners={owners} />
)}
```

Replace with:

```tsx
{tab === 'income' && (
  <IncomeTab month={month} incomes={incomes} setIncomes={setIncomes} owners={owners} bankSums={incomeBankSums} />
)}
```

- [ ] **Step 3: Update `IncomeTab` to accept `bankSums` and add sync button**

Replace the full `components/budget/IncomeTab.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { createIncomeSource, updateIncomeSource, deleteIncomeSource } from '@/lib/queries/finance'
import { fmtWhole } from '@/lib/utils'
import type { IncomeSource } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const inputCls = 'h-8 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = { fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

export default function IncomeTab({ month, incomes, setIncomes, owners, bankSums }: {
  month: string
  incomes: IncomeSource[]
  setIncomes: React.Dispatch<React.SetStateAction<IncomeSource[]>>
  owners: string[]
  bankSums: { income_source_id: string; total: number }[]
}) {
  const { toast } = useToast()
  const [newOwner, setNewOwner] = useState('')
  const [newName,  setNewName]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [syncing,  setSyncing]  = useState(false)

  useEffect(() => { if (owners.length > 0 && !newOwner) setNewOwner(owners[0]) }, [owners, newOwner])

  const hasBankSums = bankSums.some(b => incomes.find(i => i.id === b.income_source_id))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      const created = await createIncomeSource({ owner: newOwner, name: newName.trim(), month, expected: 0, actual: 0 })
      setIncomes(prev => [...prev, created])
      setNewName('')
    } finally { setAdding(false) }
  }

  async function handleUpdate(id: string, field: 'expected' | 'actual', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateIncomeSource(id, { [field]: val })
    setIncomes(prev => prev.map(i => i.id === id ? updated : i))
  }

  async function handleSyncActuals() {
    setSyncing(true)
    try {
      const toSync = incomes.filter(i => bankSums.find(b => b.income_source_id === i.id))
      const updated = await Promise.all(
        toSync.map(i => updateIncomeSource(i.id, { actual: bankSums.find(b => b.income_source_id === i.id)!.total }))
      )
      setIncomes(prev => prev.map(i => updated.find(u => u.id === i.id) ?? i))
      toast(`Updated ${updated.length} income ${updated.length === 1 ? 'source' : 'sources'} from bank`, 'success')
    } catch {
      toast('Failed to sync — please try again', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const total = incomes.reduce((s, i) => s + i.expected, 0)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Income sources</span>
        {hasBankSums && (
          <button
            type="button"
            onClick={handleSyncActuals}
            disabled={syncing}
            className="text-[11px] disabled:opacity-40"
            style={{ color: 'var(--color-primary)' }}
          >
            {syncing ? 'Syncing…' : 'Sync from bank'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Source</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Expected</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Actual</span>
        <span className="w-5" />
      </div>
      {incomes.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No income sources for this month yet — add one below.</p>
      ) : (
        <>
          {incomes.map(inc => (
            <IncomeRow
              key={inc.id} source={inc}
              onUpdate={handleUpdate}
              onDelete={async (id) => { setIncomes(prev => prev.filter(i => i.id !== id)); await deleteIncomeSource(id) }}
            />
          ))}
          <div className="flex items-center gap-2 pt-2 mt-1" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>Total expected</span>
            <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(total)}</span>
            <span className="w-[88px]" /><span className="w-5" />
          </div>
        </>
      )}
      <form onSubmit={handleAdd} className="flex gap-2 mt-4 pt-3 flex-wrap" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {owners.length > 0 && (
          <select value={newOwner} onChange={e => setNewOwner(e.target.value)} className={`w-[96px] ${inputCls}`} style={inputStyle}>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Source name" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
        <Button type="submit" size="sm" disabled={!newName.trim() || adding}>Add</Button>
      </form>
    </Card>
  )
}

function IncomeRow({ source, onUpdate, onDelete }: {
  source: IncomeSource
  onUpdate: (id: string, f: 'expected' | 'actual', v: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [exp,           setExp]           = useState(String(source.expected))
  const [act,           setAct]           = useState(String(source.actual))
  const [savedField,    setSavedField]    = useState<'expected' | 'actual' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setExp(String(source.expected)) }, [source.expected])
  useEffect(() => { setAct(String(source.actual))   }, [source.actual])

  async function handleSave(field: 'expected' | 'actual', raw: string) {
    await onUpdate(source.id, field, raw)
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1200)
  }

  function fieldStyle(field: 'expected' | 'actual') {
    return {
      fontSize: '16px',
      background: 'var(--color-background)',
      border: `0.5px solid ${savedField === field ? 'var(--color-positive)' : 'var(--color-border)'}`,
      color: 'var(--color-foreground)',
      transition: 'border-color 0.4s ease',
    }
  }

  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{source.name}</span>
        <span className="ml-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>{source.owner}</span>
      </div>
      <input type="number" min="0" step="0.01" value={exp} onChange={e => setExp(e.target.value)} onBlur={e => handleSave('expected', e.target.value)} className={numCls} style={fieldStyle('expected')} />
      <input type="number" min="0" step="0.01" value={act} onChange={e => setAct(e.target.value)} onBlur={e => handleSave('actual',   e.target.value)} className={numCls} style={fieldStyle('actual')} />
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onDelete(source.id)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Delete ${source.name}`} style={{ color: 'var(--color-muted)' }}>×</button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: clean build with no TypeScript errors in the budget files.

- [ ] **Step 5: Commit**

```bash
git add app/budget/page.tsx components/budget/IncomeTab.tsx
git commit -m "feat: IncomeTab sync from bank — load income bank sums, add sync button"
```

---

### Task 7: DB migration — `is_savings_pod` on `plaid_accounts`

**Files:**
- Supabase MCP: `apply_migration`

- [ ] **Step 1: Apply migration**

Use `mcp__plugin_supabase_supabase__apply_migration` with:

```sql
ALTER TABLE plaid_accounts
  ADD COLUMN is_savings_pod boolean NOT NULL DEFAULT false;
```

Name: `add_is_savings_pod_to_plaid_accounts`

- [ ] **Step 2: Verify**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'plaid_accounts' AND column_name = 'is_savings_pod';
```

Expected: one row, `data_type = boolean`, `column_default = false`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add is_savings_pod column to plaid_accounts"
```

---

### Task 8: Query layer — savings pod account functions

**Files:**
- Modify: `lib/queries/accounts.ts`

- [ ] **Step 1: Add `getSavingsPodAccounts` and `setSavingsPodAccount`**

Append to the end of `lib/queries/accounts.ts`:

```ts
export async function getSavingsPodAccounts(
  householdId: string,
): Promise<{ account_id: string; name: string; mask: string; is_savings_pod: boolean }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('plaid_accounts')
    .select('account_id, name, mask, is_savings_pod')
    .eq('household_id', householdId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function setSavingsPodAccount(accountId: string, value: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('plaid_accounts')
    .update({ is_savings_pod: value })
    .eq('account_id', accountId)
  if (error) throw error
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/accounts.ts
git commit -m "feat: add getSavingsPodAccounts and setSavingsPodAccount query functions"
```

---

### Task 9: `WealthPage` — pod account state, savingsBalance, configure dropdown

**Files:**
- Modify: `app/wealth/page.tsx`

This task modifies the `WealthPage` function and the `SavingsSection` component within the same file.

- [ ] **Step 1: Update `WealthPage` imports**

Add `getSavingsPodAccounts` and `setSavingsPodAccount` to the accounts import at the top of the file:

```ts
import { getSavingsPodAccounts, setSavingsPodAccount } from '@/lib/queries/accounts'
```

- [ ] **Step 2: Add `podAccounts` state and load it**

In `WealthPage`, after `const [syncing, setSyncing]` state declarations, add:

```ts
type PodAccount = { account_id: string; name: string; mask: string; is_savings_pod: boolean }
const [podAccounts, setPodAccounts] = useState<PodAccount[]>([])
```

Update the `load` function's `useAuth` — the current call is:
```ts
const { loading: authLoading } = useAuth()
```

Update the `load` function's `Promise.all` inside `load`:

```ts
const load = useCallback(async () => {
  if (authLoading) return
  setLoading(true); setError(null)
  try {
    const [p, a, d, s, pods] = await Promise.all([
      getSavingsPods(), getAssets(), getDebts(), getNetWorthSnapshots(), getSavingsPodAccounts(''),
    ])
    setPods(p); setAssets(a); setDebts(d); setSnapshots(s); setPodAccounts(pods)
  } catch (err) {
    setError(sanitizeError(err))
  } finally { setLoading(false) }
}, [authLoading])
```

Wait — `getSavingsPodAccounts` requires `householdId`, but `WealthPage` currently uses `resolveHouseholdId()` internally via `lib/queries/wealth`. We need householdId from `useAuth`. Add it:

```ts
const { loading: authLoading, householdId } = useAuth()
```

Then the `load` function:

```ts
const load = useCallback(async () => {
  if (authLoading) return
  setLoading(true); setError(null)
  try {
    const podFetch = householdId ? getSavingsPodAccounts(householdId) : Promise.resolve([])
    const [p, a, d, s, pods] = await Promise.all([
      getSavingsPods(), getAssets(), getDebts(), getNetWorthSnapshots(), podFetch,
    ])
    setPods(p); setAssets(a); setDebts(d); setSnapshots(s); setPodAccounts(pods)
  } catch (err) {
    setError(sanitizeError(err))
  } finally { setLoading(false) }
}, [authLoading, householdId])
```

- [ ] **Step 3: Update `savingsBalance` derivation**

Replace the existing `savingsBalance` useMemo:

```ts
const savingsBalance = useMemo(() => assets.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0), [assets])
```

With:

```ts
const podAccountIds = useMemo(
  () => new Set(podAccounts.filter(a => a.is_savings_pod).map(a => a.account_id)),
  [podAccounts]
)
const savingsBalance = useMemo(() =>
  podAccountIds.size > 0
    ? assets.filter(a => a.plaid_account_id != null && podAccountIds.has(a.plaid_account_id)).reduce((s, a) => s + a.balance, 0)
    : assets.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
  [assets, podAccountIds]
)
```

- [ ] **Step 4: Pass `podAccounts` and callback to `SavingsSection`**

Find the `SavingsSection` usage and update:

```tsx
<SavingsSection
  pods={pods} setPods={setPods}
  totalAllotted={totalAllotted} totalPodGoal={totalPodGoal}
  savingsBalance={savingsBalance}
  podAccounts={podAccounts}
  onPodAccountToggle={(accountId, value) => {
    setSavingsPodAccount(accountId, value)
    setPodAccounts(prev => prev.map(a => a.account_id === accountId ? { ...a, is_savings_pod: value } : a))
  }}
/>
```

- [ ] **Step 5: Update `SavingsSection` props and add configure dropdown**

Find the `SavingsSection` function definition and replace it in full. The signature and the metrics row block need a new "Configure accounts" toggle. Here is the complete updated `SavingsSection` function (replace from `function SavingsSection(` to the closing `}` of the function, before `function SavingsPodRow`):

```tsx
type PodAccount = { account_id: string; name: string; mask: string; is_savings_pod: boolean }

function SavingsSection({ pods, setPods, totalAllotted, totalPodGoal, savingsBalance, podAccounts, onPodAccountToggle }: {
  pods: SavingsPod[]
  setPods: React.Dispatch<React.SetStateAction<SavingsPod[]>>
  totalAllotted: number
  totalPodGoal: number
  savingsBalance: number
  podAccounts: PodAccount[]
  onPodAccountToggle: (accountId: string, value: boolean) => void
}) {
  const [newName,          setNewName]          = useState('')
  const [adding,           setAdding]           = useState(false)
  const [showAdd,          setShowAdd]          = useState(false)
  const [showAccountConfig, setShowAccountConfig] = useState(false)
  const unallocated = savingsBalance - totalAllotted

  async function handleAdd(name: string) {
    if (!name.trim()) return
    setAdding(true)
    try {
      const created = await createSavingsPod({ name: name.trim(), allotted: 0, goal: 0 })
      setPods(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } finally { setAdding(false) }
  }

  async function handleUpdate(id: string, field: 'allotted' | 'goal', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateSavingsPod(id, { [field]: val } as SavingsPodUpdate)
    setPods(prev => prev.map(p => p.id === id ? updated : p))
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Savings pods</h2>
      <p className="text-[12px] mb-3" style={{ color: 'var(--color-muted)' }}>Every dollar saved has a home.</p>
      <div className="rounded-xl px-5 py-4 mb-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <MetricCard label="Savings balance" value={fmtWhole(savingsBalance)} />
          <MetricCard label="Allotted" value={fmtWhole(totalAllotted)} />
          <MetricCard
            label={unallocated >= 0 ? 'Unallocated' : 'Over-allotted'}
            value={fmtWhole(Math.abs(unallocated))}
            valueColor={unallocated < 0 ? 'var(--color-negative)' : undefined}
          />
          <MetricCard label="Total goal" value={fmtWhole(totalPodGoal)} />
        </div>
        {podAccounts.length > 0 && (
          <div className="relative mt-3 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setShowAccountConfig(v => !v)}
              className="text-[11px]"
              style={{ color: 'var(--color-muted)' }}
            >
              Configure accounts {showAccountConfig ? '▴' : '▾'}
            </button>
            {showAccountConfig && (
              <div
                className="mt-2 rounded-lg overflow-hidden"
                style={{ border: '0.5px solid var(--color-border)', background: 'var(--color-background)' }}
              >
                {podAccounts.map(acct => (
                  <label
                    key={acct.account_id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    style={{ borderBottom: '0.5px solid var(--color-border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={acct.is_savings_pod}
                      onChange={e => onPodAccountToggle(acct.account_id, e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-[12px] flex-1" style={{ color: 'var(--color-foreground)' }}>
                      {acct.name}
                      {acct.mask && <span style={{ color: 'var(--color-muted)' }}> ···{acct.mask}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Card>
        <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Pod</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Allotted</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Goal</span>
          <span className="w-5" />
        </div>
        {pods.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No savings pods yet — add one to start tracking where your money is going.</p>
        ) : pods.map(p => (
          <SavingsPodRow
            key={p.id} pod={p}
            onUpdate={handleUpdate}
            onDelete={async (id) => { setPods(prev => prev.filter(x => x.id !== id)); await deleteSavingsPod(id) }}
          />
        ))}
        {showAdd ? (
          <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <form onSubmit={e => { e.preventDefault(); handleAdd(newName) }} className="flex gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Pod name" autoFocus className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
              <Button type="submit" size="sm" disabled={!newName.trim() || adding}>Add</Button>
              <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => setShowAdd(false)}>Cancel</Button>
            </form>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_PODS.filter(n => !pods.find(p => p.name.toLowerCase() === n.toLowerCase())).map(n => (
                <button key={n} type="button" onClick={() => handleAdd(n)} className="px-2 py-[3px] rounded-md text-[11px] hover:opacity-80 transition-opacity" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{n}</button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-3 text-[13px]" style={{ color: 'var(--color-muted)' }}>+ New pod</button>
        )}
      </Card>
    </section>
  )
}
```

- [ ] **Step 6: Run build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: clean build with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/wealth/page.tsx
git commit -m "feat: savings pod account selector — configure accounts dropdown, dynamic savingsBalance"
```

---

### Task 10: Browser smoke test + build + push

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Accounts page — verify income transactions show income source dropdown**

Navigate to `/accounts`. For any transaction with `amount < 0` (displayed as `+$X` in green):
- Confirm the dropdown shows "N/A — transfer or ignore", "Unassigned", and any income sources for the month
- For expense transactions (`-$X` in red), confirm the dropdown still shows budget categories as before

- [ ] **Step 3: Budget page — Income tab — verify sync from bank**

Navigate to `/budget`, click "Income" tab:
- If any income transactions have been assigned to income sources, the "Sync from bank" button should appear
- Click it and confirm `actual` values update on income rows

- [ ] **Step 4: Wealth page — verify configure accounts dropdown**

Navigate to `/wealth`, scroll to "Savings pods":
- If Plaid accounts are connected, "Configure accounts ▾" button should appear below the metrics
- Click it to see accounts list with checkboxes
- Toggle a savings account checkbox, confirm "Savings balance" metric updates

- [ ] **Step 5: Final production build**

```bash
npm run build
```

Expected: clean build, zero TypeScript errors.

- [ ] **Step 6: Push**

```bash
git push
```
