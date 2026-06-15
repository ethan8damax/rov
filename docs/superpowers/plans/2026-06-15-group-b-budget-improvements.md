# Group B — Budget Improvements: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline category renaming, a "left to spend" metric card alongside "unallocated", a one-click "Sync from bank" button for actuals, and fix the ±$1 rounding bug — all inside `app/budget/page.tsx`.

**Architecture:** Everything is in one file. `BudgetCategoryRow` (defined at the bottom of the page file) gains rename state. `handleUpdateField` in `BudgetPage` widens to accept `'name'`. The `bankSum` prop on `BudgetCategoryRow` is removed — the per-row hint is deleted and replaced by a single sync button whose visibility is derived from `bankSums` in the parent. Metrics use `Math.round` before sign/color checks.

**Tech Stack:** Next.js 14 App Router, TypeScript, React (`useState`, `useEffect`, `useRef`, `useMemo`), Supabase via `updateBudgetCategory` (already imported)

---

## File map

| File | Action | What changes |
|---|---|---|
| `app/budget/page.tsx` | Modify | All four features: rounding fix, two-card layout, inline rename, sync actuals button |

---

### Task 1: Rounding fix + `leftToSpend` computation

**Files:**
- Modify: `app/budget/page.tsx` (~lines 107–111)

- [ ] **Step 1: Replace the `leftover` computation and add `leftToSpend` + `leftToSpendColor`**

Find the block that starts `const totalIncome = useMemo(...)`. Currently looks like:

```ts
const totalIncome   = useMemo(() => incomes.reduce((s, i) => s + i.expected, 0), [incomes])
const totalBudgeted = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
const totalActual   = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
const leftover      = totalIncome - totalBudgeted
```

Replace with:

```ts
const totalIncome   = useMemo(() => incomes.reduce((s, i) => s + i.expected, 0), [incomes])
const totalBudgeted = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
const totalActual   = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
const leftover      = Math.round(totalIncome - totalBudgeted)
const leftToSpend   = Math.round(totalIncome - totalActual)
```

- [ ] **Step 2: Add `leftToSpendColor` alongside `leftoverColor`**

Find the `leftoverColor` declaration. Currently:

```ts
const leftoverColor = leftover < 0
  ? 'var(--color-negative)'
  : leftover === 0 && totalIncome > 0
    ? 'var(--color-positive)'
    : totalIncome > 0
      ? 'var(--color-warning)'
      : 'var(--color-foreground)'
```

Add `leftToSpendColor` immediately after it:

```ts
const leftToSpendColor = leftToSpend < 0 && totalIncome > 0
  ? 'var(--color-negative)'
  : totalIncome > 0
    ? 'var(--color-positive)'
    : 'var(--color-foreground)'
```

- [ ] **Step 3: Run type check**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Generating" | head -10
```

Expected: `✓ Generating static pages` — no errors.

- [ ] **Step 4: Commit**

```bash
git add app/budget/page.tsx
git commit -m "fix: round leftover + leftToSpend to nearest dollar to prevent ±\$1 display bug"
```

---

### Task 2: Two-card metrics layout

**Files:**
- Modify: `app/budget/page.tsx` (the "Leftover banner" section, ~lines 188–210)

- [ ] **Step 1: Replace the single "Unallocated" card with two side-by-side cards + detail row**

Find the comment `{/* Leftover banner */}` and the `<div>` block beneath it. The entire block currently looks like:

```tsx
          {/* Leftover banner */}
          <div className="rounded-xl px-5 py-4 mb-5" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
            <p className="text-[12px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>Unallocated this month</p>
            <p className="text-[28px] font-medium tabular-nums" style={{ color: leftoverColor }}>
              {leftover < 0 ? '−' : ''}{fmtWhole(Math.abs(leftover))}
            </p>
            {leftover === 0 && totalIncome > 0 && (
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-positive)' }}>Every dollar allocated</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[12px]" style={{ color: 'var(--color-muted)' }}>
              <span>Income: {fmtWhole(totalIncome)}</span>
              <span>·</span>
              <span>Budgeted: {fmtWhole(totalBudgeted)}</span>
              {totalActual > 0 && <><span>·</span><span>Spent: {fmtWhole(totalActual)}</span></>}
            </div>
            {totalIncome > 0 && (
              <div className="mt-3">
                <ProgressBar value={Math.min(100, (totalBudgeted / totalIncome) * 100)} intent="primary" />
              </div>
            )}
          </div>
```

Replace with:

```tsx
          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>Unallocated</p>
              <p className="text-[22px] font-medium tabular-nums" style={{ color: leftoverColor }}>
                {leftover < 0 ? '−' : ''}{fmtWhole(Math.abs(leftover))}
              </p>
              {leftover === 0 && totalIncome > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-positive)' }}>Every dollar allocated</p>
              )}
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>
                {leftToSpend < 0 && totalIncome > 0 ? 'Over budget' : 'Left to spend'}
              </p>
              <p className="text-[22px] font-medium tabular-nums" style={{ color: leftToSpendColor }}>
                {leftToSpend < 0 && totalIncome > 0 ? '−' : ''}{fmtWhole(Math.abs(leftToSpend))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
            <span>Income: {fmtWhole(totalIncome)}</span>
            <span>·</span>
            <span>Budgeted: {fmtWhole(totalBudgeted)}</span>
            {totalActual > 0 && <><span>·</span><span>Spent: {fmtWhole(totalActual)}</span></>}
          </div>
          {totalIncome > 0 && (
            <div className="mb-5">
              <ProgressBar value={Math.min(100, (totalBudgeted / totalIncome) * 100)} intent="primary" />
            </div>
          )}
```

- [ ] **Step 2: Run type check**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Generating" | head -10
```

Expected: `✓ Generating static pages` — no errors.

- [ ] **Step 3: Commit**

```bash
git add app/budget/page.tsx
git commit -m "feat: add left to spend card alongside unallocated on budget page"
```

---

### Task 3: Inline rename — `BudgetCategoryRow` component

**Files:**
- Modify: `app/budget/page.tsx` (`BudgetCategoryRow` function, ~lines 352–470)

- [ ] **Step 1: Add rename state and ref to `BudgetCategoryRow`**

Find the `BudgetCategoryRow` function. Its state declarations currently include `exp`, `act`, `savingField`, `savedField`, `confirmDelete`. Add three new ones immediately after `confirmDelete`:

```ts
  const [editingName,  setEditingName]  = useState(false)
  const [draftName,    setDraftName]    = useState(category.name)
  const nameInputRef = useRef<HTMLInputElement>(null)
```

Then add a `useEffect` to keep `draftName` in sync with the prop (add after the existing `useEffect` calls for `exp` and `act`):

```ts
  useEffect(() => { setDraftName(category.name) }, [category.name])
```

- [ ] **Step 2: Add `handleNameSave` function**

After the existing `handleSave` function in `BudgetCategoryRow`, add:

```ts
  async function handleNameSave() {
    const trimmed = draftName.trim()
    setEditingName(false)
    if (!trimmed || trimmed === category.name) return
    await onUpdate(category.id, 'name', trimmed)
  }
```

- [ ] **Step 3: Replace the name `<span>` with clickable/editable element**

Find the name span inside `BudgetCategoryRow`'s return. Currently:

```tsx
        <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>
          {category.name}
        </span>
```

Replace with:

```tsx
        {!fixed && editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setDraftName(category.name); setEditingName(false) }
            }}
            className="flex-1 text-[13px] bg-transparent border-b outline-none min-w-0"
            style={{ color: 'var(--color-foreground)', borderColor: 'var(--color-primary)', fontSize: '16px' }}
          />
        ) : (
          <span
            className="flex-1 text-[13px] truncate"
            style={{ color: 'var(--color-foreground)', cursor: fixed ? 'default' : 'pointer' }}
            onClick={fixed ? undefined : () => {
              setEditingName(true)
              setTimeout(() => nameInputRef.current?.select(), 0)
            }}
          >
            {category.name}
          </span>
        )}
```

- [ ] **Step 4: Run type check**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Generating" | head -10
```

Expected: TypeScript error about `onUpdate` not accepting `'name'` — fixed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add app/budget/page.tsx
git commit -m "feat: BudgetCategoryRow — inline rename state, input, and save handler"
```

---

### Task 4: Inline rename — widen `onUpdate` prop type and `handleUpdateField`

**Files:**
- Modify: `app/budget/page.tsx` (`BudgetCategoryRow` prop types + `handleUpdateField` in `BudgetPage`)

- [ ] **Step 1: Widen the `onUpdate` prop type on `BudgetCategoryRow`**

Find the prop type definition inside `BudgetCategoryRow`. Currently:

```ts
  onUpdate: (id: string, field: 'expected' | 'actual', raw: string) => Promise<void>
```

Replace with:

```ts
  onUpdate: (id: string, field: 'expected' | 'actual' | 'name', raw: string) => Promise<void>
```

- [ ] **Step 2: Extend `handleUpdateField` in `BudgetPage` to handle `'name'`**

Find `handleUpdateField` in the `BudgetPage` component. Currently:

```ts
  async function handleUpdateField(id: string, field: 'expected' | 'actual', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateBudgetCategory(id, { [field]: val })
    setCategories(prev => prev.map(c => c.id === id ? updated : c))
  }
```

Replace with:

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

- [ ] **Step 3: Run type check — should be clean**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Generating" | head -10
```

Expected: `✓ Generating static pages` — no errors.

- [ ] **Step 4: Commit**

```bash
git add app/budget/page.tsx
git commit -m "feat: extend handleUpdateField to support category rename"
```

---

### Task 5: Sync actuals button + remove per-row bank hint

**Files:**
- Modify: `app/budget/page.tsx` (BudgetPage state + BudgetCategoryRow prop/render)

- [ ] **Step 1: Add `syncing` state and `hasBankSums` derived value in `BudgetPage`**

In `BudgetPage`, add `syncing` state alongside the other state declarations:

```ts
  const [syncing, setSyncing] = useState(false)
```

After the `const fixed = useMemo(...)` line, add:

```ts
  const hasBankSums = bankSums.some(b => b.total > 0 && flexible.some(f => f.id === b.category_id))
```

- [ ] **Step 2: Add `handleSyncActuals` function in `BudgetPage`**

Add after `handleDelete`:

```ts
  async function handleSyncActuals() {
    setSyncing(true)
    try {
      const toSync = flexible.filter(c => (bankSums.find(b => b.category_id === c.id)?.total ?? 0) > 0)
      const updated = await Promise.all(
        toSync.map(c => updateBudgetCategory(c.id, { actual: bankSums.find(b => b.category_id === c.id)!.total }))
      )
      setCategories(prev => prev.map(c => updated.find(u => u.id === c.id) ?? c))
      toast(`Updated ${updated.length} ${updated.length === 1 ? 'category' : 'categories'} from bank`, 'success')
    } catch {
      toast('Failed to sync — please try again', 'error')
    } finally {
      setSyncing(false)
    }
  }
```

- [ ] **Step 3: Replace the "Budget categories" title `<p>` with a flex row containing the sync button**

Find inside the Spending tab:

```tsx
                <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>
                  Budget categories
                </p>
```

Replace with:

```tsx
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
                    Budget categories
                  </p>
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
```

- [ ] **Step 4: Remove `bankSum` prop from `BudgetCategoryRow` and its call sites**

**4a.** In `BudgetCategoryRow`'s prop type definition, remove:
```ts
  bankSum: number | null
```

**4b.** In `BudgetCategoryRow`'s function signature (destructuring), remove `bankSum`. The destructuring should become:

```ts
function BudgetCategoryRow({
  category, onUpdate, onDelete, fixed = false,
}: { ... })
```

**4c.** Delete the entire per-row bank hint block inside `BudgetCategoryRow`. Find and remove:

```tsx
      {bankSum !== null && bankSum > 0 && (
        <div className="flex items-center gap-2 pb-1">
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {fmtWhole(bankSum)} from bank
          </span>
          <button
            type="button"
            className="text-[11px]"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => handleSave('actual', String(bankSum))}
          >
            set as actual
          </button>
        </div>
      )}
```

**4d.** In `BudgetPage`'s JSX, find all `<BudgetCategoryRow ... bankSum={...} ...>` usages and remove the `bankSum` prop from each. There are two call sites — one for flexible categories and one for fixed:

```tsx
                      {flexible.map(c => (
                        <BudgetCategoryRow
                          key={c.id} category={c}
                          onUpdate={handleUpdateField} onDelete={handleDelete}
                        />
                      ))}
```

and:

```tsx
                        {fixed.map(c => (
                          <BudgetCategoryRow
                            key={c.id} category={c} fixed
                            onUpdate={handleUpdateField} onDelete={handleDelete}
                          />
                        ))}
```

- [ ] **Step 5: Run type check**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Generating" | head -10
```

Expected: `✓ Generating static pages` — no errors.

- [ ] **Step 6: Commit**

```bash
git add app/budget/page.tsx
git commit -m "feat: sync actuals from bank button, remove per-row bank hint"
```

---

### Task 6: Browser smoke test

**Files:**
- No code changes — verification only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Navigate to http://localhost:3000/budget

- [ ] **Step 2: Verify two-card metrics row**

Check that "Unallocated" and "Left to spend" appear as two side-by-side cards. Confirm "Income · Budgeted · Spent" detail line appears below both cards. Confirm the progress bar still appears below the detail line.

- [ ] **Step 3: Verify rounding fix**

If unallocated is near zero, confirm it shows $0 (not −$1 or $1). If you have categories that sum to a few cents off from income, adjust one category expected by 1 cent to confirm the display shows $0 and the "Every dollar allocated" message (or appropriate color) appears.

- [ ] **Step 4: Verify inline rename**

Click a flexible category name — it should become an editable input. Type a new name → Enter → confirm the name updates in the row and in the Total row. Click a category name → type → Escape → confirm the name reverts. Click a fixed bill name — confirm it does NOT become editable.

- [ ] **Step 5: Verify sync from bank**

If Plaid is connected and bank sums exist, "Sync from bank" appears in the "Budget categories" title row. Click it — confirm actuals update across all categories with bank data and a toast confirms "Updated N categories from bank". Confirm the per-row "$X from bank / set as actual" hint is gone from all rows.

- [ ] **Step 6: Final build check**

```bash
npm run build
```

Expected: exit code 0, zero TypeScript errors.

- [ ] **Step 7: Push**

```bash
git push origin main
```
