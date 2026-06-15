# Group B — Budget Improvements: Design Spec

**Date:** 2026-06-15
**Status:** Approved for implementation

---

## Goal

Three quality-of-life improvements to the Budget page: inline category renaming, a "left to spend" metric card alongside the existing "unallocated" card, and a single "Sync from bank" button that writes all bank totals to `actual` in one click. Also fixes a rounding bug where tiny floating-point errors cause the unallocated amount to display as ±$1 instead of $0.

---

## Scope

1. Inline rename for flexible budget categories
2. Left to spend card alongside Unallocated card + rounding fix
3. Sync actuals from bank — single button in Spending tab

---

## 1. Inline rename

### Where

`BudgetCategoryRow` (defined inside `app/budget/page.tsx`, lines ~352+). The category name is currently a `<span>`. Clicking it switches to an `<input>`. Fixed categories (those with a `recurring_payment_id`) are not renameable — their name stays a plain `<span>`.

### State

Two new local state fields in `BudgetCategoryRow`:

```ts
const [editingName, setEditingName] = useState(false)
const [draftName,   setDraftName]   = useState(category.name)
```

Keep `draftName` in sync with prop changes:

```ts
useEffect(() => { setDraftName(category.name) }, [category.name])
```

### UX

- Click name → `setEditingName(true)`, auto-focus and select-all the input
- Enter key or blur → save (if trimmed draft differs from current name and is non-empty)
- Escape → `setEditingName(false)`, reset draft to current name, no save
- While saving: input is disabled, no visual spinner (the save is fast)

### Data flow

`BudgetCategoryRow` receives an expanded `onUpdate` callback. Both the prop type on `BudgetCategoryRow` and the parent's `handleUpdateField` must widen to `'expected' | 'actual' | 'name'`:

```ts
async function handleUpdateField(id: string, field: 'expected' | 'actual' | 'name', raw: string) {
  if (field === 'name') {
    const trimmed = raw.trim()
    if (!trimmed) return
    const updated = await updateBudgetCategory(id, { name: trimmed })
    setCategories(prev => prev.map(c => c.id === id ? updated : c))
    return
  }
  const val = parseFloat(raw)
  if (isNaN(val) || val < 0) return
  const updated = await updateBudgetCategory(id, { [field]: val })
  setCategories(prev => prev.map(c => c.id === id ? updated : c))
}
```

No query-layer changes needed — `updateBudgetCategory` already accepts `name` via `BudgetCategoryUpdate`.

### Input style

Match the account rename input in `AccountCard`: transparent background, primary-color bottom border, 16px font-size (prevents iOS zoom), full width of the name area.

---

## 2. Left to spend card + rounding fix

### Rounding fix

Before any sign/color checks, round both metrics to the nearest whole dollar to eliminate floating-point noise:

```ts
const leftover    = Math.round(totalIncome - totalBudgeted)
const leftToSpend = Math.round(totalIncome - totalActual)
```

This means a 1-cent float error no longer triggers the negative-color path or suppresses the "every dollar allocated" message.

### Metrics

| Label | Formula | Color logic |
|---|---|---|
| Unallocated | `totalIncome − totalBudgeted` (rounded) | negative if < 0, positive if = 0 and income > 0, warning if > 0 and income > 0, foreground if no income |
| Left to spend | `totalIncome − totalActual` (rounded) | negative if < 0 (over budget), positive if ≥ 0 |

### Layout

Replace the current single full-width "Unallocated this month" card with two side-by-side metric cards using a 2-column grid:

```
┌─────────────────────┬─────────────────────┐
│ Unallocated         │ Left to spend        │
│ $XXX                │ $XXX                 │
└─────────────────────┴─────────────────────┘
Income: $X · Budgeted: $X · Spent: $X   ← one line below the cards
```

Each card: surface background, `0.5px` border, `12px` radius, `1rem` padding. No change to the "every dollar allocated" message — it sits inside the Unallocated card when `leftover === 0 && totalIncome > 0`.

The "Income · Budgeted · Spent" detail line moves below the two-card row as a single muted line, same as today.

---

## 3. Sync actuals from bank

### Location

Inside the Spending tab, in the column header row that shows "Expected" and "Actual" labels. The button goes on the right side of that row:

```
Expected    Actual    [Sync from bank]
```

The button is only shown when at least one flexible category has a non-zero bank sum. If no bank data is available (no Plaid connection or all categories already match), the button is hidden.

### Behavior

On click:

1. Find all flexible categories (`!recurring_payment_id`) where `bankSums` has a non-zero total for that `category_id`
2. For each, call `updateBudgetCategory(id, { actual: bankSum })`
3. Update local `categories` state with the returned values
4. Toast: `"Updated X categories from bank"` (success)

All updates fire in parallel (`Promise.all`). The button shows a disabled state while saving ("Syncing…").

This overwrites any manually entered `actual` values — it is a deliberate bulk replace, not a "fill in blanks" operation. The user chose this behavior.

### No per-row hint removal

The existing per-row `"$X from bank / set as actual"` hint is **removed** — replaced entirely by the single Sync button. After sync, the hints would all show 0 difference anyway, so removing them cleans up the row. If bank data is unavailable (`bankSum === null`), the row shows nothing below the inputs (same as today for uncategorized transactions).

---

## Files modified

| File | Change |
|---|---|
| `app/budget/page.tsx` | Rename: extend `handleUpdateField` to accept `'name'`; rounding fix on `leftover` + `leftToSpend`; two-card layout for metrics; Sync button + handler in Spending tab header; remove per-row bank hint |

No new files, no query changes, no schema changes.

---

## Edge cases

- **Empty name on rename**: if the user clears the field and blurs, no save — reset to current name
- **Duplicate name on rename**: allowed (same behavior as create — no uniqueness enforced at DB level)
- **Fixed category rename**: not supported — the name span is static for recurring-linked rows
- **Sync with no bank data**: button is hidden; no error state needed
- **Sync button mid-month**: always overwrites `actual` with the current bank total. User understands this is a bulk replace.
- **Left to spend negative**: shows negative color (red), label changes to "Over budget" to match home page hero
