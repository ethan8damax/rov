# Group C+D — Income Transactions & Savings Pod Accounts: Design Spec

**Date:** 2026-06-15
**Status:** Approved for implementation

---

## Goal

**Group C:** Let income transactions (deposits, `amount < 0`) be assigned to income sources instead of budget categories. Add a "Sync from bank" button to the Income tab that writes transaction totals to `actual`. Add N/A option for income transactions.

**Group D:** Let the user select which connected Plaid accounts contribute to the savings balance shown on the Wealth page pods section, via a collapsible dropdown.

---

## Group C — Income Transactions

### What is an income transaction?

Plaid's convention: `amount > 0` = expense (money out), `amount < 0` = income (money in). The UI already displays negative amounts as `+$X` in green. All detection is based on `amount < 0`.

### Schema change

One new nullable FK on `transactions`:

```sql
ALTER TABLE transactions
  ADD COLUMN income_source_id uuid REFERENCES income_sources(id) ON DELETE SET NULL;
```

### Transaction row UX

`TransactionRow` detects `amount < 0` and renders an **income source dropdown** instead of the budget category dropdown:

- **N/A option** at top (`__na__`) — same mechanism as expenses: calls `markTransactionIgnored`, which sets `is_ignored = true` and clears both `category_id` and `income_source_id`
- **Unassigned** option (empty value) — clears `income_source_id`
- List of income sources for the current month (`IncomeSource[]`)
- No "create new" inline — income sources are created on the Income tab

When an income source is selected: calls `updateTransactionIncomeSource(id, incomeSourceId)`. If the transaction was previously ignored, also calls `unignoreTransaction`. No merchant rule is saved (deposits don't have consistent merchant names).

New props on `TransactionRow`:
- `incomeSourceId: string | null`
- `incomeSourceName: string | null`
- `incomeSources: IncomeSource[]`

### Triage section

The triage filter catches both uncategorized expenses AND unassigned income transactions. The condition becomes:

```
!category_id && !income_source_id && !is_pending && !is_ignored
```

This works because expense transactions always have `income_source_id = null` and income transactions always have `category_id = null`.

The label "Needs a category (N)" stays as-is — both types need attention.

### `getUncategorizedCount`

Updated to match the triage filter — counts transactions where `category_id IS NULL AND income_source_id IS NULL AND is_pending = false AND is_ignored = false`.

### `markTransactionIgnored`

Updated to also clear `income_source_id`:

```ts
.update({ is_ignored: true, category_id: null, income_source_id: null })
```

### New query functions (in `lib/queries/accounts.ts`)

```ts
// Set income_source_id on a transaction
updateTransactionIncomeSource(transactionId: string, incomeSourceId: string | null): Promise<void>

// Sum absolute amounts of income transactions grouped by income_source_id
getTransactionSumsByIncomeSource(householdId: string, month: string): Promise<{ income_source_id: string; total: number }[]>
```

`getTransactionSumsByIncomeSource` filters: `amount < 0`, `is_pending = false`, `income_source_id IS NOT NULL`. Sums `Math.abs(amount)` grouped by `income_source_id`.

### Income tab sync button

`BudgetPage` loads income bank sums in its existing `load()` parallel fetch:

```ts
const [cats, incs, recs, names, pastCats, catSums, incSums] = await Promise.all([...existing..., getTransactionSumsByIncomeSource(householdId, month)])
```

Stores in `incomeBankSums` state and passes as `bankSums` prop to `IncomeTab`.

`IncomeTab` gains:
- `bankSums: { income_source_id: string; total: number }[]` prop
- `syncing` state
- `hasBankSums` derived value: `bankSums.some(b => incomes.find(i => i.id === b.income_source_id))`
- `handleSyncActuals`: parallel `updateIncomeSource(id, { actual: total })` for all matched sources, toast "Updated N income sources from bank"
- Sync button above column headers (same pattern as Budget page's "Sync from bank") — visible only when `hasBankSums`
- `useToast()` hook (new import)

### `TransactionWithCategory` type (in `lib/queries/accounts.ts`)

Add two fields:
```ts
income_source_id:   string | null
income_source_name: string | null
```

`getTransactions` select string gains: `, income_source_id, income_sources(name)`.

### AccountsPage

- Import `getIncomeSources` from `lib/queries/finance` and `IncomeSource` from `@/types`
- Add `incomeSources` state
- Load alongside transactions in `loadTransactions`
- Update triage filter to include `!t.income_source_id`
- Pass `incomeSources` to `TriageSection` and `TransactionList`

### `TriageSection` + `TransactionList`

Both gain `incomeSources: IncomeSource[]` prop, forwarded to each `TransactionRow`.

---

## Group D — Savings Pod Accounts

### Schema change

One new boolean column on `plaid_accounts`:

```sql
ALTER TABLE plaid_accounts
  ADD COLUMN is_savings_pod boolean NOT NULL DEFAULT false;
```

### Savings balance logic

The current formula (`assets.filter(a => a.type === 'savings')`) is replaced by:

- If at least one account has `is_savings_pod = true`: sum balances of `assets` whose `plaid_account_id` is in the selected set
- Otherwise (no accounts configured): fall back to current formula — sum of `assets` where `type === 'savings'`

This ensures existing behavior is preserved before the user configures anything.

### New query functions (in `lib/queries/accounts.ts`)

```ts
// Fetch all plaid accounts with their is_savings_pod flag
getSavingsPodAccounts(householdId: string): Promise<{ account_id: string; name: string; mask: string; is_savings_pod: boolean }[]>

// Toggle is_savings_pod on a plaid account
setSavingsPodAccount(accountId: string, value: boolean): Promise<void>
```

### WealthPage

- Add `podAccounts` state: `{ account_id: string; name: string; mask: string; is_savings_pod: boolean }[]`
- Load via `getSavingsPodAccounts(householdId)` in the existing `load()` Promise.all
- Derive `podAccountIds: Set<string>` from `podAccounts.filter(a => a.is_savings_pod).map(a => a.account_id)`
- Recompute `savingsBalance` using the new logic above
- Pass `podAccounts` and `setPodAccounts` to `SavingsSection`

### SavingsSection — Configure accounts dropdown

A `showAccountConfig` boolean state (default `false`) toggles a small dropdown below the "Savings balance" metric card:

```
Savings balance   $18,243   Configure accounts ▾
                              ┌──────────────────────────┐
                              │ ☑ Main Savings ···6628    │
                              │ ☑ Other Savings ···4865   │
                              │ ☐ Ethan's Checking ···3027│
                              └──────────────────────────┘
```

- Button: `"Configure accounts ▾"` / `"▴"` toggles open/close
- Positioned relative to the metrics row; absolute dropdown below
- Each account shows a checkbox + name + mask
- Toggling calls `setSavingsPodAccount(account_id, newValue)` and updates `podAccounts` state in parent via callback
- Clicking outside closes the dropdown (via `useEffect` + `mousedown` listener on document)

If `podAccounts` is empty (no Plaid connection), the button is hidden.

---

## Files modified

| File | Changes |
|---|---|
| `types/index.ts` | Add `income_source_id` to `Transaction` |
| `lib/queries/accounts.ts` | Add `income_source_id` + `income_source_name` to `TransactionWithCategory`; update `getTransactions`, `getUncategorizedCount`, `markTransactionIgnored`; add `updateTransactionIncomeSource`, `getTransactionSumsByIncomeSource`, `getSavingsPodAccounts`, `setSavingsPodAccount` |
| `components/accounts/TransactionRow.tsx` | Add income branch: income source dropdown + N/A + `incomeSourceId`/`incomeSourceName`/`incomeSources` props |
| `components/accounts/TransactionList.tsx` | Add `incomeSources` prop, forward to `TransactionRow` |
| `components/accounts/TriageSection.tsx` | Add `incomeSources` prop, forward to `TransactionRow` |
| `app/accounts/page.tsx` | Load income sources, update triage filter, pass `incomeSources` |
| `app/budget/page.tsx` | Load `incomeBankSums` in parallel, pass to `IncomeTab` |
| `components/budget/IncomeTab.tsx` | Add `bankSums` prop, `hasBankSums`, `handleSyncActuals`, sync button, `useToast` |
| `app/wealth/page.tsx` | Load `podAccounts`, recompute `savingsBalance`, pass to `SavingsSection` |

No new files. Two DB migrations (one per group).

---

## Edge cases

- **No income sources for month:** dropdown shows only N/A + Unassigned. User creates sources on Income tab.
- **Income source deleted mid-month:** `ON DELETE SET NULL` — transaction becomes unassigned, appears in triage again.
- **No Plaid connection (Group D):** `podAccounts` is empty, "Configure accounts" button is hidden, savings balance falls back to `type === 'savings'` assets.
- **All pod accounts unchecked:** falls back to savings-type assets formula (same as unconfigured).
- **Income transaction previously ignored:** selecting an income source calls `unignoreTransaction` first, then sets `income_source_id`.
