# Group A — Transaction Feed Improvements: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-sync with 30-min cooldown, pull-to-refresh, live Plaid balances, an N/A ignore flag, a triage section for uncategorized transactions, and 10-per-page pagination to the Accounts page.

**Architecture:** The `is_ignored` boolean column on `transactions` is the source of truth for N/A status. `AccountsPage` manages a `resolvedIds: Set<string>` as local optimistic state — when a triage row is categorized or ignored, its ID is added to the set so the triage section updates immediately without mutating the server-fetched `transactions` array. Pagination slices `transactions` in `AccountsPage` before passing to `TransactionList`; `TransactionList` needs no changes except receiving `isIgnored` on each row.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL + PostgREST), Plaid Node SDK (`plaid-node`), React (`useState`, `useEffect`, `useRef`, `useCallback`)

---

## File map

| File | Action | What changes |
|---|---|---|
| `types/index.ts` | Modify | Add `is_ignored: boolean` to `Transaction` |
| `lib/queries/accounts.ts` | Modify | Add `is_ignored` to `TransactionWithCategory`, `getTransactions`, `getUncategorizedCount`; add `markTransactionIgnored`, `unignoreTransaction` |
| `app/api/plaid/accounts/route.ts` | Modify | `accountsGet` → `accountsBalanceGet` |
| `components/accounts/TransactionRow.tsx` | Modify | Add `isIgnored` prop; N/A option in select; `onCategorized`/`onIgnored` callbacks; call `unignoreTransaction` when re-categorizing after N/A |
| `components/accounts/TriageSection.tsx` | Create | Flat list of uncategorized transaction rows with section header |
| `components/accounts/TransactionList.tsx` | Modify | Pass `isIgnored={t.is_ignored}` to each `TransactionRow` |
| `app/accounts/page.tsx` | Modify | Auto-sync cooldown; pull-to-refresh; `resolvedIds` set; `TriageSection`; pagination state + controls |

---

### Task 1: DB migration — add `is_ignored` column

**Files:**
- No file edits — run via Supabase MCP

- [ ] **Step 1: Apply the migration**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with name `add_is_ignored_to_transactions` and SQL:

```sql
alter table transactions
  add column is_ignored boolean not null default false;
```

- [ ] **Step 2: Verify the column exists**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'transactions' and column_name = 'is_ignored';
```

Expected: one row — `data_type = boolean`, `column_default = false`.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: add is_ignored boolean column to transactions"
```

---

### Task 2: Type updates

**Files:**
- Modify: `types/index.ts` (Transaction interface, lines 139–151)
- Modify: `lib/queries/accounts.ts` (TransactionWithCategory interface, lines 3–15)

- [ ] **Step 1: Add `is_ignored` to `Transaction` in `types/index.ts`**

Find the `Transaction` interface (starts around line 139). Replace it with:

```ts
export interface Transaction {
  id: string
  household_id: string
  account_id: string            // our UUID → plaid_accounts.id
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number                // positive = expense, negative = income
  date: string                  // YYYY-MM-DD
  category_id: string | null
  is_pending: boolean
  is_ignored: boolean
  created_at: string
}
```

- [ ] **Step 2: Add `is_ignored` to `TransactionWithCategory` in `lib/queries/accounts.ts`**

Find the `TransactionWithCategory` interface (lines 3–15). Replace it with:

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
  account_name: string | null
  account_mask: string | null
}
```

- [ ] **Step 3: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: TypeScript will report errors about `TransactionRow` not yet receiving `isIgnored` — those are fixed in Task 5. No other errors expected from this change.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/queries/accounts.ts
git commit -m "feat: add is_ignored to Transaction and TransactionWithCategory types"
```

---

### Task 3: Query layer — `is_ignored` support + new helpers

**Files:**
- Modify: `lib/queries/accounts.ts`

- [ ] **Step 1: Update `getTransactions` to include `is_ignored`**

Replace the full `getTransactions` function (lines 17–48):

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
    .select('id, transaction_id, merchant_name, name, amount, date, is_pending, is_ignored, category_id, budget_categories(name), plaid_accounts(name, mask)')
    .eq('household_id', householdId)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(t => ({
    id:             t.id,
    transaction_id: t.transaction_id,
    merchant_name:  t.merchant_name,
    name:           t.name,
    amount:         t.amount,
    date:           t.date,
    is_pending:     t.is_pending,
    is_ignored:     t.is_ignored,
    category_id:    t.category_id,
    category_name:  (t.budget_categories as { name: string } | null)?.name ?? null,
    account_name:   (t.plaid_accounts as { name: string; mask: string } | null)?.name ?? null,
    account_mask:   (t.plaid_accounts as { name: string; mask: string } | null)?.mask ?? null,
  }))
}
```

- [ ] **Step 2: Update `getUncategorizedCount` to exclude ignored transactions**

Replace the full `getUncategorizedCount` function (lines 50–70):

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
    .eq('is_pending', false)
    .eq('is_ignored', false)
    .gte('date', `${month}-01`)
    .lt('date',  `${nextMonth}-01`)
  if (error) throw error
  return count ?? 0
}
```

- [ ] **Step 3: Add `markTransactionIgnored` and `unignoreTransaction` helpers**

Insert after the closing brace of `updateTransactionCategory` (after line 82):

```ts
export async function markTransactionIgnored(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ is_ignored: true, category_id: null })
    .eq('id', id)
  if (error) throw error
}

export async function unignoreTransaction(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ is_ignored: false })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: same TransactionRow errors as before (not yet fixed). No new errors from the query layer.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/accounts.ts
git commit -m "feat: is_ignored in getTransactions, filter in getUncategorizedCount, add markTransactionIgnored + unignoreTransaction"
```

---

### Task 4: Live balances — `accountsBalanceGet`

**Files:**
- Modify: `app/api/plaid/accounts/route.ts` (line 36)

- [ ] **Step 1: Replace `accountsGet` with `accountsBalanceGet`**

On line 36, change:

```ts
      const res = await plaidClient.accountsGet({ access_token: item.access_token })
```

to:

```ts
      const res = await plaidClient.accountsBalanceGet({ access_token: item.access_token })
```

`accountsBalanceGet` accepts the same `{ access_token }` parameter and returns the identical `res.data.accounts` structure — no other changes needed. It requests a real-time refresh from the institution (1–3 s slower per item). Navy Federal on Plaid's development tier may still lag a few hours regardless — that is a Plaid limitation, not a bug.

- [ ] **Step 2: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/plaid/accounts/route.ts
git commit -m "feat: use accountsBalanceGet for real-time Plaid balances"
```

---

### Task 5: `TransactionRow` — `isIgnored` prop, N/A option, callbacks, unignore on re-categorize

**Files:**
- Modify: `components/accounts/TransactionRow.tsx`

- [ ] **Step 1: Update the import**

Line 6 currently imports `updateTransactionCategory` and `upsertMerchantRule`. Replace with:

```ts
import { updateTransactionCategory, upsertMerchantRule, markTransactionIgnored, unignoreTransaction } from '@/lib/queries/accounts'
```

- [ ] **Step 2: Update the props interface**

Replace the `TransactionRowProps` interface (lines 9–24) with:

```ts
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
```

- [ ] **Step 3: Update the function signature and state declarations**

Replace lines 26–37 (function signature through state declarations) with:

```ts
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
```

- [ ] **Step 4: Replace `handleCategoryChange`**

Replace the `handleCategoryChange` function (lines 39–63) with:

```ts
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
```

- [ ] **Step 5: Update the `<select>` element**

Replace the `<select>` element (lines 160–173) with:

```tsx
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
```

- [ ] **Step 6: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: errors about `isIgnored` not passed from `TransactionList` — fixed in Task 6. No errors within `TransactionRow` itself.

- [ ] **Step 7: Commit**

```bash
git add components/accounts/TransactionRow.tsx
git commit -m "feat: TransactionRow — N/A option, isIgnored prop, onCategorized + onIgnored callbacks, unignore on re-categorize"
```

---

### Task 6: `TransactionList` — pass `isIgnored` to rows

**Files:**
- Modify: `components/accounts/TransactionList.tsx` (lines 76–93)

- [ ] **Step 1: Add `isIgnored` to each `TransactionRow` in the grouped list**

Inside the `grouped.map` block (around line 76), the `TransactionRow` is missing `isIgnored`. Replace the entire `dayTxs.map(...)` block with:

```tsx
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
```

`onCategorized` and `onIgnored` are intentionally omitted here — the full list does not need to remove rows when they are resolved.

- [ ] **Step 2: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: the `isIgnored`-related TypeScript errors should be gone. Only `AccountsPage` errors about triage/pagination remain (fixed in Task 8).

- [ ] **Step 3: Commit**

```bash
git add components/accounts/TransactionList.tsx
git commit -m "feat: pass isIgnored to TransactionRow in TransactionList"
```

---

### Task 7: Create `TriageSection` component

**Files:**
- Create: `components/accounts/TriageSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Run type check**

```bash
npm run build 2>&1 | head -40
```

Expected: only `AccountsPage` errors remain (TriageSection not yet imported there).

- [ ] **Step 3: Commit**

```bash
git add components/accounts/TriageSection.tsx
git commit -m "feat: add TriageSection — flat list of uncategorized transactions with section header"
```

---

### Task 8: `AccountsPage` — triage, `resolvedIds`, auto-sync, pull-to-refresh, pagination

**Files:**
- Modify: `app/accounts/page.tsx`

- [ ] **Step 1: Replace the entire file**

The file currently has 177 lines. Replace it entirely with the version below. Key changes:
- `useRef` added to import
- `TriageSection` imported
- `resolvedIds`, `page`, `PAGE_SIZE`, `pullStartY`, `isPulling`, `pullIndicator` added
- `uncategorized`, `totalPages`, `pagedTxs`, `handleResolved` derived/declared after `accountGroups`
- `handleSync` saves the timestamp on success
- `useEffect` resets `page` + `resolvedIds` on month change
- Auto-sync `useEffect` fires on mount if `rov-last-sync` is stale/missing
- Pull-to-refresh `useEffect` attaches touch listeners
- JSX updated with `overscrollBehaviorY`, pull indicator, `TriageSection`, `pagedTxs`, pagination controls

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/context/auth'
import { getTransactions } from '@/lib/queries/accounts'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import { getBudgetCategories } from '@/lib/queries/finance'
import { currentMonth, shiftMonth, formatMonthLabel } from '@/lib/utils'
import type { AccountWithBalance, BudgetCategory } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PlaidLinkButton from '@/components/accounts/PlaidLinkButton'
import AccountCard from '@/components/accounts/AccountCard'
import TransactionList from '@/components/accounts/TransactionList'
import TriageSection from '@/components/accounts/TriageSection'
import { useToast } from '@/components/ui/Toast'

export default function AccountsPage() {
  const { householdId } = useAuth()
  const { toast } = useToast()
  const [month,          setMonth]          = useState(() => currentMonth())
  const [accounts,       setAccounts]       = useState<AccountWithBalance[]>([])
  const [transactions,   setTransactions]   = useState<TransactionWithCategory[]>([])
  const [categories,     setCategories]     = useState<BudgetCategory[]>([])
  const [loadingAcct,    setLoadingAcct]    = useState(true)
  const [loadingTx,      setLoadingTx]      = useState(true)
  const [syncing,        setSyncing]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [resolvedIds,    setResolvedIds]    = useState<Set<string>>(new Set())
  const [page,           setPage]           = useState(1)
  const [pullIndicator,  setPullIndicator]  = useState(false)
  const PAGE_SIZE    = 10
  const pullStartY   = useRef(0)
  const isPulling    = useRef(false)

  const loadAccounts = useCallback(async () => {
    setLoadingAcct(true)
    try {
      const res  = await fetch('/api/plaid/accounts')
      const data = await res.json()
      setAccounts(data.accounts ?? [])
    } catch {
      setError('Failed to load accounts')
    } finally {
      setLoadingAcct(false)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    if (!householdId) return
    setLoadingTx(true)
    try {
      const [txs, cats] = await Promise.all([
        getTransactions(householdId, month),
        getBudgetCategories(month),
      ])
      setTransactions(txs)
      setCategories(cats)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoadingTx(false)
    }
  }, [householdId, month])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadTransactions() }, [loadTransactions])

  useEffect(() => {
    setPage(1)
    setResolvedIds(new Set())
  }, [month])

  useEffect(() => {
    const THIRTY_MIN = 30 * 60 * 1000
    const last = localStorage.getItem('rov-last-sync')
    if (!last || Date.now() - Number(last) > THIRTY_MIN) {
      handleSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      pullStartY.current = e.touches[0].clientY
      isPulling.current  = false
    }
    function onTouchMove(e: TouchEvent) {
      if (window.scrollY !== 0) return
      const delta = e.touches[0].clientY - pullStartY.current
      if (delta > 60) {
        isPulling.current = true
        setPullIndicator(true)
      }
    }
    function onTouchEnd() {
      if (isPulling.current && !syncing) handleSync()
      isPulling.current = false
      setPullIndicator(false)
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/transactions')
      const data = await res.json()
      const count = data.synced ?? 0
      localStorage.setItem('rov-last-sync', String(Date.now()))
      toast(count === 0 ? 'Already up to date' : `Synced ${count} new transaction${count !== 1 ? 's' : ''}`, 'success')
      await loadTransactions()
    } catch {
      setError('Sync failed — please try again')
    } finally {
      setSyncing(false)
    }
  }

  function handleConnected() {
    loadAccounts()
    loadTransactions()
  }

  function handleResolved(id: string) {
    setResolvedIds(prev => new Set([...prev, id]))
  }

  function addCategory(cat: BudgetCategory) {
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const now = currentMonth()

  const accountGroups = (() => {
    const checking   = accounts.filter(a => a.type === 'depository')
    const investment = accounts.filter(a => a.type === 'investment')
    const credit     = accounts.filter(a => a.type === 'credit')
    const other      = accounts.filter(a => !['depository', 'investment', 'credit'].includes(a.type))
    return [
      { label: 'Checking & savings', accounts: checking },
      { label: 'Investments',        accounts: investment },
      { label: 'Credit cards',       accounts: credit },
      { label: 'Other',              accounts: other },
    ].filter(g => g.accounts.length > 0)
  })()

  const uncategorized = transactions.filter(
    t => !t.category_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
  )
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE)
  const pagedTxs   = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" style={{ overscrollBehaviorY: 'contain' }}>
      {pullIndicator && (
        <p className="text-center text-[11px] py-1 mb-2" style={{ color: 'var(--color-muted)' }}>
          Release to sync
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Accounts
        </h1>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          )}
          <PlaidLinkButton onConnected={handleConnected} />
        </div>
      </div>

      {error && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}

      {loadingAcct ? (
        <div className="flex flex-col gap-2 mb-6">
          {[0, 1].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="mb-6">
          <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>
            No banks connected yet. Connect your first account to see live balances and your transaction history.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5 mb-6">
          {accountGroups.map(group => (
            <div key={group.label}>
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
                {group.label}
              </p>
              <div className="flex flex-col gap-2">
                {group.accounts.map(acct => (
                  <AccountCard
                    key={acct.account_id}
                    account={acct}
                    onDisconnected={() => { loadAccounts(); loadTransactions() }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div id="transactions" className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Transactions
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(m => shiftMonth(m, -1))}>←</Button>
          <span className="text-[13px] min-w-[100px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>
            {formatMonthLabel(month)}
          </span>
          <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= now}>→</Button>
        </div>
      </div>

      {householdId && (
        <>
          <TriageSection
            transactions={uncategorized}
            categories={categories}
            householdId={householdId}
            month={month}
            onCategoryCreated={addCategory}
            onResolved={handleResolved}
          />

          <TransactionList
            transactions={pagedTxs}
            categories={categories}
            householdId={householdId}
            month={month}
            loading={loadingTx}
            onCategoryCreated={addCategory}
          />

          {totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-4 pt-3"
              style={{ borderTop: '0.5px solid var(--color-border)' }}
            >
              <Button
                variant="ghost"
                size="sm"
                intent="neutral"
                disabled={page === 1}
                onClick={() => {
                  setPage(p => p - 1)
                  document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                ← Previous
              </Button>
              <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                intent="neutral"
                disabled={page === totalPages}
                onClick={() => {
                  setPage(p => p + 1)
                  document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npm run build 2>&1 | head -60
```

Expected: clean build — zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/accounts/page.tsx
git commit -m "feat: AccountsPage — triage section, resolvedIds, auto-sync cooldown, pull-to-refresh, pagination"
```

---

### Task 9: Browser smoke test

**Files:**
- No code changes — verification only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

If port 3000 is occupied: `lsof -ti:3000 | xargs kill -9` then retry.

- [ ] **Step 2: Verify triage section**

Go to `/accounts`. If there are uncategorized non-pending non-ignored transactions, a "Needs a category (N)" section appears above the full list with a count. Categorizing or marking N/A on any triage row removes it from the section immediately (count decreases).

- [ ] **Step 3: Verify N/A in full list**

Find a transaction previously marked N/A in the paginated list — its select should show "N/A — transfer or ignore". Pick a real category — the select should update to that category name.

- [ ] **Step 4: Verify pagination**

Navigate to a month with more than 10 transactions. The paginated list shows 10 rows. "← Previous / Page 1 of N / Next →" controls appear below the list. Clicking "Next →" advances the page and scrolls the Transactions heading into view.

- [ ] **Step 5: Verify auto-sync**

Open DevTools → Application → Local Storage → delete `rov-last-sync`. Reload. The Sync button should briefly show "Syncing…" automatically. Check the Network tab for a POST to `/api/plaid/transactions`.

- [ ] **Step 6: Final build check**

```bash
npm run build
```

Expected: exit code 0, zero errors.

- [ ] **Step 7: Push**

```bash
git push origin main
```
