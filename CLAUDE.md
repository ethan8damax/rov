# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project overview

Rov (Hebrew: רוב — plenty/abundance) is a standalone household budgeting app for two people. Built with **Next.js (App Router)**, **TypeScript**, **Supabase** (PostgreSQL), and **Plaid** for live bank connectivity. Features a monthly zero-based budget, savings pods, net worth tracking, and a smart transaction feed that auto-categorizes by merchant with manual override and memory. PWA-enabled for mobile use without an app store.

## Stack

- **Framework**: Next.js 14 (App Router, `app/` directory)
- **Database**: Supabase (PostgreSQL) — fresh project, separate from Life OS
- **Auth**: Supabase Auth — email/password, household model (two members)
- **Bank connectivity**: Plaid (Development tier — free, covers Navy Federal, Chase, Discover)
- **Styling**: Tailwind CSS + CSS custom properties (`app/tokens.css`)
- **Language**: TypeScript
- **Charts**: Recharts (spending trends); net worth sparkline is hand-rolled SVG
- **PWA**: `@ducanh2912/next-pwa` — use this fork, not `next-pwa`, for App Router compatibility
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=development`

## Dev commands

```bash
npm run dev       # start local dev server (http://localhost:3000)
npm run build     # production build — run to catch TypeScript errors
npm run lint      # ESLint
```

## Pages

| Route | Purpose |
|---|---|
| `/` | Home dashboard — net worth, budget health, savings snapshot, top spending |
| `/budget` | Tabs: Spending (categories + fixed bills), Income, Recurring. Month nav, automatic carryover with undo, spending trends |
| `/accounts` | Plaid-connected accounts, live balances, transaction feed with categorization |
| `/wealth` | Net worth timeline, savings pods, assets, debts |
| `/settings` | Merchant rules, household members, invite partner |
| `/login` `/signup` `/join` | Auth flows |

## Architecture

```
app/
  layout.tsx            # Root: ThemeProvider > AuthProvider > AppShell + MobileNav
  page.tsx              # Home dashboard
  budget/page.tsx
  accounts/page.tsx
  wealth/page.tsx
  settings/page.tsx
  login/ signup/ join/
  api/
    plaid/
      link-token/route.ts     # POST — create Plaid Link token (server only)
      exchange/route.ts       # POST — exchange public token → access token, store item
      accounts/route.ts       # GET — fetch balances from Plaid
      transactions/route.ts   # GET — sync new transactions into DB

components/
  layout/
    AppShell.tsx        # Sidebar on desktop, wraps page content
    Sidebar.tsx         # Desktop nav: Home, Budget, Accounts, Wealth, Settings
    MobileNav.tsx       # Fixed bottom tab bar (5 items, mobile only)
    ThemeProvider.tsx   # Dark/light mode via CSS class on <html>
  ui/                   # Button, Card, Badge, ProgressBar, MetricCard (ported from Life OS)
  dashboard/            # NetWorthCard, BudgetHealthCard, SavingsSnapshot, TopSpending
  budget/               # IncomeTab, RecurringTab, SpendingTrendChart
  accounts/             # AccountCard, TransactionList, TransactionRow, PlaidLinkButton
  wealth/               # NetWorthChart, SavingsPodRow, AssetRow, DebtRow

lib/
  supabase/
    client.ts           # Browser Supabase client
    server.ts           # Server Supabase client
  context/
    auth.tsx            # useAuth() — displayName, householdId, signOut
  plaid/
    client.ts           # Plaid Node SDK setup (server-side only)
  queries/
    finance.ts          # Budget categories, income sources, recurring payments (ported from Life OS)
    wealth.ts           # Savings pods, assets, debts, net worth snapshots (ported from Life OS)
    accounts.ts         # Plaid items, plaid_accounts, transactions, merchant_rules (new)
    households.ts       # Household + member management (ported from Life OS)
  utils.ts              # cn(), pad(), date helpers

types/index.ts          # All TypeScript interfaces
middleware.ts           # Supabase Auth session refresh + route protection
public/
  manifest.json         # PWA — name: Rov, theme: #3b6ef8, display: standalone
```

## Database schema

`month` is always a `YYYY-MM` string (e.g. `'2026-06'`). All tables are household-scoped with RLS enabled.

### Ported from Life OS

```sql
households            (id uuid pk, name text)
household_members     (id, household_id fk, user_id fk, display_name text)
budget_categories     (id, household_id, name, month text, expected numeric, actual numeric, recurring_payment_id uuid nullable fk → recurring_payments)
income_sources        (id, household_id, owner text, name, month text, expected numeric, actual numeric)
recurring_payments    (id, household_id, name, amount numeric)
savings_pods          (id, household_id, name, allotted numeric, goal numeric)
assets                (id, household_id, name, type text, balance numeric)
debts                 (id, household_id, name, owner text, amount_owed numeric, interest_rate numeric)
net_worth_snapshots   (id, household_id, month text, total_assets numeric, total_debt numeric, net_worth numeric)
```

### New for Rov

```sql
plaid_items           (id, household_id, item_id, access_token, institution_id, institution_name, created_at)
plaid_accounts        (id, item_id, household_id, account_id, name, type, subtype, mask)
transactions          (id, household_id, account_id, transaction_id, merchant_name, amount, date, category_id nullable, is_pending, created_at)
merchant_rules        (id, household_id, merchant_name text, category_name text, unique(household_id, merchant_name))
household_invites     (id, household_id, token text unique, expires_at timestamptz, used_at nullable)
```

**`merchant_rules` uses `category_name text`, not a UUID FK.** Budget categories are per-month rows — a FK would break across months. At categorization time, `category_name` is matched against the current month's `budget_categories` by name.

**`actual` field:** `budget_categories.actual` is manually editable, like in Life OS. Transactions do NOT auto-write to `actual`. Instead, the UI shows a "from bank: $X" hint (sum of categorized non-pending transactions for that category/month) with a "use this amount" tap target. This avoids double-counting and works before Plaid is connected.

**`access_token`:** Never returned to the client in any API response. All Plaid SDK calls are server-side only.

## Transaction categorization flow

1. User visits Accounts → sync is triggered (`/api/plaid/transactions`)
2. For each new transaction: if `merchant_name` is null (ATM, transfers, etc.) → mark uncategorized immediately, skip rules lookup
3. Otherwise check `merchant_rules` by `merchant_name`; if rule found, resolve `category_name` against current month's `budget_categories`
4. If no rule → `category_id = null` (shown as "uncategorized" in the feed)
5. User taps an uncategorized transaction → picks a category → `transactions.category_id` is updated → if `merchant_name` is not null, rule is saved to `merchant_rules` for future transactions

**Net worth vs Plaid:** net worth snapshots use manually-entered `assets` and `debts` only — Plaid balances are reference data on the Accounts page, not auto-synced into assets. This avoids duplicate entries and accidental overwrites from pending states.

## Carryover & fixed bills

Carryover is automatic. On Budget page load for the current month: if the month has no flexible categories and no income sources, both are copied from the prior month (names + expected, actual = 0, name conflicts skipped) and a toast offers undo. Undo deletes exactly the inserted rows and sets a localStorage flag (`rov-skip-carryover-<month>`) so that device doesn't re-copy.

Recurring payments seed "fixed" budget categories each month (current + future months, never past): a category linked via `recurring_payment_id` with expected = the payment amount. If a flexible category with the same name exists, it's adopted (linked) instead of duplicated. Fixed rows have read-only expected in the Spending tab and are edited/deleted from the Recurring tab; edits propagate to current + future months. Deleting a recurring payment deletes linked categories without transactions; rows with transactions become flexible categories. Carryover copies flexible categories only — seeding regenerates fixed ones.

## Invite flow

1. First user signs up → new `household` created, added to `household_members`
2. Settings → "Invite your partner" → generates a token stored in `household_invites` (expires in 7 days)
3. Shareable URL displayed: `https://[domain]/join?token=<token>`
4. Partner opens link → `/join` page → signs up or logs in → validated and added to the household
5. Token marked as used

## Design system

Rov uses a dark-first design with a light mode toggle. All colors via CSS variables in `app/tokens.css`.

**Dark mode**
- Background: `#0a0e1a` · Surface: `#111827` · Border: `#1e2a45` · Foreground: `#fff` · Muted: `#4a5a7a`

**Light mode**
- Background: `#f8f7f4` · Surface: `#fff` · Border: `#ece9e3` · Foreground: `#1a1a1a` · Muted: `#888`

**Semantic colors (both modes)**
- `--color-primary: #3b6ef8` — blue, brand, interactive
- `--color-positive: #2d9e6b` — green, savings, growth
- `--color-negative: #e8553a` — red, over budget, debt

**Rules**
- Font weights: 400 and 500 only — never 600 or 700
- Sentence case always — never title case or ALL CAPS
- Input `font-size`: 16px minimum (prevents iOS Safari zoom)
- Standard card: surface bg, `0.5px` border, `12px` radius, `1rem` padding
- Metric card: surface bg, no border, `8px` radius
- Progress bars: `6px` tall, `99px` border-radius
- No gradients, shadows, or blur anywhere

## Plaid integration notes

- Server: `plaid-node` · Client: `react-plaid-link`
- Environment: `development` (free, real bank data, up to 100 items)
- All Plaid API calls happen in `app/api/plaid/` routes — never client-side
- Transaction sync is on-demand only (user visits Accounts page); no webhooks in v1

## PWA setup

- `@ducanh2912/next-pwa` wraps `next.config.mjs`
- `public/manifest.json`: name "Rov", theme `#3b6ef8`, background `#0a0e1a`, display standalone
- Service worker caches app shell only; financial data is never cached
- Android: auto install prompt · iOS: Share → "Add to Home Screen" in Safari
