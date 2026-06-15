# Group A — Transaction Feed Improvements: Design Spec

**Date:** 2026-06-13
**Status:** Approved for implementation

---

## Goal

Make the transaction feed on the Accounts page faster to review and easier to act on: auto-sync on arrival, surface uncategorized transactions at the top so they're impossible to miss, paginate the full list so scrolling isn't endless, and let users mark transfers/non-budget items as N/A so the "needs a category" count stays meaningful.

---

## Scope

1. Auto-sync with 30-minute cooldown + pull-to-refresh on mobile
2. Real-time balances via `accountsBalanceGet`
3. N/A (ignore) flag — schema + UI
4. Triage section above the full list
5. Pagination — 10 per page, prev/next

---

## 1. Auto-sync + pull-to-refresh

### Auto-sync on load

On `AccountsPage` mount, check `localStorage.getItem('rov-last-sync')`:
- If missing or older than 30 minutes: fire `handleSync()` automatically, then set `localStorage.setItem('rov-last-sync', String(Date.now()))` on success.
- If within 30 minutes: skip auto-sync, load transactions from DB only.
- The manual "Sync" button always fires `handleSync()` and updates the timestamp.

The "Syncing…" button state is the only visual feedback — no extra toast on auto-sync unless new transactions were found (reuse existing toast).

### Pull-to-refresh (mobile)

In `AccountsPage`, attach `touchstart`/`touchmove`/`touchend` listeners via `useEffect`. Pattern:
- `touchstart`: record `startY`
- `touchmove`: if `window.scrollY === 0` and `currentY - startY > 60`, set `isPulling = true` and show a small "↓ Release to sync" indicator at the top
- `touchend`: if `isPulling`, trigger `handleSync()`

Add `overscroll-behavior-y: contain` to the page container to prevent the browser's native pull-to-refresh conflicting.

### Live balances

In `app/api/plaid/accounts/route.ts`, replace `plaidClient.accountsGet(...)` with `plaidClient.accountsBalanceGet(...)`. This requests a real-time balance from the institution rather than Plaid's cache. It's 1–3 seconds slower but meaningfully fresher. Note: Navy Federal via Plaid development tier may still have a lag of a few hours regardless — this is a Plaid limitation, not a bug.

---

## 2. N/A (ignore) flag

### Schema

```sql
alter table transactions
  add column is_ignored boolean not null default false;
```

No index needed — it's a low-cardinality boolean and queries filter by `household_id` + `month` first.

### Query layer (`lib/queries/accounts.ts`)

- `getTransactions`: add `is_ignored` to the select; include it in the mapped return type.
- `getUncategorizedCount`: add `.eq('is_ignored', false)` to exclude ignored transactions from the home nudge count.
- New function `markTransactionIgnored(id: string): Promise<void>` — sets `is_ignored = true`, `category_id = null`.

### Type (`types/index.ts`)

`TransactionWithCategory` gains `is_ignored: boolean`.

### UI — TransactionRow

New prop: `isIgnored: boolean`.

Add `"N/A"` as a special `<option value="__na__">N/A — transfer or ignore</option>` at the top of the category select (above "Uncategorized").

**Initial select value**: `useState(isIgnored ? '__na__' : (categoryId ?? ''))` — so already-ignored transactions show "N/A" selected when loaded from the full list.

**When N/A is selected:**
- Call `markTransactionIgnored(id)` — sets `is_ignored = true`, clears `category_id`
- Call `onIgnored?.(id)` so the parent removes it from triage
- No merchant rule is saved

**When a real category is selected after N/A:**
- Call `updateTransactionCategory(id, categoryId)` as usual
- Also call a new `unignoreTransaction(id)` helper that sets `is_ignored = false`, so the transaction no longer appears as N/A on next load

In the full list, ignored transactions remain visible with the select showing "N/A" in muted color. No hiding or strikethrough — they're just excluded from the nudge count and triage.

---

## 3. Triage section

### Location

Rendered in `AccountsPage` directly above `<TransactionList>`, inside a `<TriageSection>` component. Visible only when `uncategorized.length > 0`.

### Data

Derived in `AccountsPage` (see TransactionRow changes for `resolvedIds`):

```ts
const uncategorized = transactions.filter(
  t => !t.category_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
)
```

The triage section is **not paginated** — it shows all uncategorized transactions. In practice this should be a short list.

### Component: `components/accounts/TriageSection.tsx`

Props: `{ transactions, categories, householdId, month, onCategoryCreated, onResolved }`.

`onResolved(id)` is called by a row when it's categorized or marked N/A. The parent removes that id from the `transactions` state so the triage section updates immediately.

Renders:
- Section header: `"Needs a category (N)"` in 14px muted text
- One `TransactionRow` per uncategorized transaction, with an additional `onCategorized` and `onIgnored` prop
- No date group headers within triage — just a flat list

### TransactionRow changes

Add two optional callbacks:
- `onCategorized?: (id: string) => void` — fires after a category is successfully saved
- `onIgnored?: (id: string) => void` — fires after `markTransactionIgnored` succeeds

`TriageSection` passes both callbacks to each `TransactionRow`, both wired to the same `onResolved(id)` prop it receives from `AccountsPage`.

In `AccountsPage`, track a `resolvedIds` Set so the triage filter updates immediately without mutating the `transactions` array:

```ts
const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

const uncategorized = transactions.filter(
  t => !t.category_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
)

function handleResolved(id: string) {
  setResolvedIds(prev => new Set([...prev, id]))
}
```

`resolvedIds` resets to an empty Set when `month` changes (same `useEffect` that resets `page`).

### Home nudge

The home nudge (`app/page.tsx`) already links to `/accounts` — no change needed. The triage section is always at the top of Accounts so users land on it immediately.

---

## 4. Pagination

### State

```ts
const [page, setPage] = useState(1)
const PAGE_SIZE = 10
```

Reset to page 1 when `month` changes.

### Slicing

In `AccountsPage`, derive the paginated slice before passing to `TransactionList`:

```ts
const totalPages   = Math.ceil(transactions.length / PAGE_SIZE)
const pagedTxs     = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
```

Pass `pagedTxs` to `<TransactionList>` instead of the full `transactions`. `TransactionList`'s existing date-grouping logic operates on whatever it receives, so date headers are preserved within each page naturally.

### Controls

Rendered below `<TransactionList>` in `AccountsPage` when `totalPages > 1`:

```
← Previous    Page 2 of 14    Next →
```

- "← Previous" disabled on page 1
- "Next →" disabled on last page
- Clicking scrolls the page to the `#transactions` anchor (or `window.scrollTo` to the transactions header) so the user doesn't have to scroll up manually

### TransactionList

No changes needed — it already renders whatever transactions it receives.

---

## Files modified

| File | Change |
|---|---|
| `types/index.ts` | Add `is_ignored` to `TransactionWithCategory` |
| `lib/queries/accounts.ts` | Add `is_ignored` to select + return; filter in `getUncategorizedCount`; add `markTransactionIgnored` + `unignoreTransaction` |
| `app/api/plaid/accounts/route.ts` | `accountsBalanceGet` instead of `accountsGet` |
| `app/accounts/page.tsx` | Auto-sync logic; pull-to-refresh; triage section; pagination state + controls; `resolvedIds` set; `handleResolved` callback |
| `components/accounts/TransactionRow.tsx` | `isIgnored` prop; N/A option in select; `onCategorized` + `onIgnored` callbacks; `unignoreTransaction` on re-categorize |
| `components/accounts/TriageSection.tsx` | New component — flat list of uncategorized rows |

DB migration (Supabase MCP):
```sql
alter table transactions add column is_ignored boolean not null default false;
```

---

## What this does NOT change

- The home nudge copy and link — already correct
- `TransactionList` internal structure — date grouping is untouched
- Merchant rule behavior — N/A does not save a rule
- Pending transactions — excluded from triage (already the case), remain visible in full list

---

## Edge cases

- **All transactions categorized**: triage section disappears; pagination controls remain if total > 10
- **Empty month**: existing empty state in `TransactionList` handles this
- **Auto-sync fails silently**: if `handleSync` errors, nothing breaks — transactions still load from DB
- **Pull-to-refresh during active sync**: guard with `if (syncing) return` in touchend handler
- **Page out of range after month change**: `useEffect` resets `page = 1` when `month` changes
