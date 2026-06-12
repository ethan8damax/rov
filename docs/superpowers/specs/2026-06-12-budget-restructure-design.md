# Batch 1: Budget restructure & wealth cleanup — design

**Status:** approved in brainstorming, 2026-06-12
**Scope:** Budget page tabs with income + recurring relocated from Settings, recurring payments as auto-seeded fixed categories, automatic carryover with undo, Wealth page inline add buttons, pods explainer copy, slim Settings, manifest shortcuts.

## Goals

- Income and recurring payments live where budgeting happens, not in Settings.
- The budget math accounts for fixed bills without manual mirroring.
- A new month starts itself: categories and income carry over automatically, reversibly.
- The Wealth page stops dedicating permanent screen space to add-forms.

## 1. Budget page: three tabs

The page keeps its current structure above the fold on every tab:

- Month nav (← June 2026 →)
- Summary header: "Left to budget" figure, Income · Budgeted · Spent line, allocation progress bar

Below the header, a tab row: **Spending · Income · Recurring**. Tabs are client-side state (no routes), styled like the join page's mode toggle (text + active underline in `--color-primary`, sentence case).

- **Spending** (default tab): the existing category list, split into two groups:
  - Flexible categories (everything without a `recurring_payment_id`), current UI unchanged.
  - A muted "Fixed bills" divider, then the auto-seeded recurring categories.
  - The spending trend chart stays at the bottom of this tab.
- **Income**: the income sources UI moves from Settings as-is (owner, name, expected, actual; add/edit/delete; month-scoped — follows the month nav like Spending).
- **Recurring**: the recurring payments list moves from Settings as-is (name, amount; add/edit/delete). Recurring payments are not month-scoped; this tab shows the same list regardless of the month nav, with a muted note "Applies to every month" so the mismatch is explicit.

## 2. Recurring payments become fixed categories

**Schema change** (Supabase migration):

```sql
alter table budget_categories
  add column recurring_payment_id uuid references recurring_payments(id) on delete set null;
```

**Seeding rule** — runs on Budget page load, after carryover (section 3), idempotent:

> For each recurring payment R with no category where `recurring_payment_id = R.id` in the viewed month:
> 1. If the month has a flexible category whose name matches R.name (case-insensitive), **adopt it**: set its `recurring_payment_id = R.id` and leave its values alone. This is also the migration path — households that manually mirrored their bills as categories get them linked, not duplicated, the first month this ships.
> 2. Otherwise insert: `{ name: R.name, month, expected: R.amount, actual: 0, recurring_payment_id: R.id }`.

Seeding only applies to the current real-world month and future months; navigating to past months never inserts or adopts rows.

**Behavior of fixed rows in the Spending tab:**

- Expected is read-only (edited via the Recurring tab); actual stays editable with the existing "from bank" hint.
- They participate in all math (`totalBudgeted`, leftover, over-budget detection) and in transaction categorization + merchant rules, because they are ordinary `budget_categories` rows.
- No inline delete on the fixed rows; they're managed from the Recurring tab.
- Sorted alphabetically within the "Fixed bills" group.

**Edit/delete semantics (Recurring tab → propagate to the current real-world month and any future months already seeded; past months immutable):**

- Rename R → rename linked categories in current + future months.
- Change R.amount → update `expected` on linked categories in current + future months.
- Delete R → in current + future months, delete each linked category that has no categorized transactions; any linked row with transactions stays and becomes a normal flexible category (`recurring_payment_id` nulled). Past months' rows are nulled by the FK (`on delete set null`) and remain as historical records.
- Add R mid-month → seeded on next Budget page load (same rule as above).

**Carryover interaction:** carryover copies only flexible categories (rows where `recurring_payment_id is null`). Fixed rows are excluded because seeding regenerates them from the source of truth; copying them too would duplicate.

## 3. Automatic carryover with undo

The "Copy from last month" button is removed. On Budget page load for the current month:

1. If the month has zero **flexible** categories (rows where `recurring_payment_id is null`) AND zero income sources, and the previous month has at least one of either → run the existing `carryoverBudget` logic (flexible categories + income sources, name-conflict skip preserved). Counting only flexible rows matters: a future month seeded early would otherwise look "non-empty" and never receive its carryover.
2. Then run fixed-bill seeding (section 2).
3. If step 1 copied anything, show a toast — **"Copied N categories and M income sources from <Month> · Undo"** — visible ~8 seconds. Wording adapts when one count is zero ("Copied 3 income sources from May · Undo").
4. Undo deletes exactly the rows inserted in step 1 (by captured ids). Seeded fixed rows are not deleted (they regenerate anyway).

Notes:

- The Toast component gains an optional action button (label + callback) if it doesn't already support one.
- Both partners loading simultaneously is safe: the emptiness check plus the existing name-conflict skip make double-copy a no-op, and seeding is idempotent by `recurring_payment_id`.
- A brand-new household (no prior month data) sees the existing empty state; no toast.
- Carryover fires only when viewing the current real-world month, not when browsing past or future months.

## 4. Wealth page cleanup + pods copy

- Assets, debts, and savings pods cards each replace their always-visible add form with a quiet text button at the bottom of the card: **"+ Add asset"**, **"+ Add debt"**, **"+ New pod"** (muted color, 13px, sentence case).
- Tapping expands the existing form inline within the card (no modal); a cancel affordance collapses it. Form markup and submit logic are unchanged, only visibility is gated.
- The "Savings pods" section header gains a muted subtitle: *"Every dollar saved has a home."* — tying to the brand lore. The "pods" name stays.

## 5. Settings slims down

Settings keeps: appearance (theme toggle), household & members, invite partner, Plaid connection manager. The income sources and recurring payments sections are removed (relocated, not duplicated — no code left behind).

## 6. Manifest app shortcuts

`public/manifest.json` gains:

```json
"shortcuts": [
  { "name": "Budget", "url": "/budget", "icons": [{ "src": "/logo.svg", "sizes": "any" }] },
  { "name": "Accounts", "url": "/accounts", "icons": [{ "src": "/logo.svg", "sizes": "any" }] }
]
```

## Error handling

- Carryover/seeding failures fail silently to the console and leave the page usable (the month just looks empty / missing fixed rows; reload retries). No blocking error UI for background mutations.
- Undo failure surfaces the existing error toast pattern.
- All new queries go through `lib/queries/finance.ts` and respect household RLS scoping like existing code.

## Testing & verification

No test framework exists in this repo. Verification is:

- `npm run build` (type safety) and `npm run lint` after each task.
- Browser walkthrough: new-month carryover + undo, fixed-bill seeding, recurring rename/amount/delete propagation, tab navigation, Wealth add-button expand/collapse, Settings reduced, in dark + light and mobile + desktop.

## Out of scope (batch 2 parking lot)

Captured user direction for the next batch:

- Auto-sync transactions on app open; pull-to-refresh on mobile.
- "N to categorize" nudge that opens a dedicated uncategorized review view (not the raw feed) — possibly a pinned section above the transaction list or a triage page.
- Home dashboard upgrade: circle progress per pod, spent/saved this month, mirrored savings-vs-debt graph; "left to spend" stays primary with safe-to-spend-per-day secondary.
- Automatic monthly net-worth snapshots (no manual button).
