# Rov — budgeting app design

**Date:** 2026-06-08
**Status:** Approved

## Overview

Rov (Hebrew: רוב — plenty/abundance) is a standalone household budgeting app for a two-person household. It is split off from the Life OS project's finance feature and built as a fully independent product with its own Supabase project, its own domain, and a fresh Next.js codebase.

Core philosophy: zero-based monthly budgeting with live bank data, savings goal tracking, and net worth visibility — all in a clean, minimal interface that works as a PWA on both partners' phones.

## What we're building

### Features (v1)

1. **Monthly budget** — budget categories with expected vs actual amounts per month, with a visual over/under indicator per category and a household-level leftover banner
2. **Month-to-month carryover** — one-click "copy last month" to pre-fill budget categories and income sources for the new month (see carryover behavior below)
3. **Spending trends** — bar charts per category showing spend over the past 6 months, rendered with Recharts
4. **Plaid bank connectivity** — connect Navy Federal, Chase, and Discover accounts; live balance display; transaction feed
5. **Smart transaction categorization** — transactions auto-assign to budget categories based on merchant memory; unknown merchants show as uncategorized; user manually assigns → rule is saved for future transactions
6. **Savings pods** — named savings buckets with a goal amount and allotted amount; progress bars; totals vs savings account balance
7. **Net worth tracking** — assets, debts, monthly net worth snapshots, sparkline history chart (hand-rolled SVG, same as Life OS)
8. **Income sources** — per-person income tracking (expected vs actual) scoped to the month
9. **Recurring payments** — fixed monthly bills listed for reference in the budget
10. **Dashboard home** — at-a-glance financial health: net worth, budget status, savings snapshot, top spending categories this month
11. **PWA** — installable on iOS and Android via "Add to Home Screen"; full-screen, no browser chrome
12. **Dark/light mode** — dark navy default with a warm light mode toggle

### Out of scope for v1

- CSV transaction import (Plaid covers this need)
- Auto-categorization via Plaid's own category taxonomy (too unreliable; merchant memory is better)
- Push notifications or bill reminders
- Multiple households or more than two users
- Background transaction sync / webhooks (transactions sync on demand when user visits Accounts)

## Pages & navigation

Five sections, accessed via a bottom tab bar on mobile and a sidebar on desktop.

| Tab | Route | Contents |
|---|---|---|
| Home | `/` | Net worth metric, budget health, savings snapshot, top spending categories |
| Budget | `/budget` | Month nav, income vs budgeted banner, category rows, carryover button, spending trend charts |
| Accounts | `/accounts` | Plaid-connected accounts with balances, transaction feed with categorization UI |
| Wealth | `/wealth` | Net worth timeline chart, savings pods, assets list, debts list |
| Settings | `/settings` | Income sources, recurring payments, Plaid connection manager, invite partner |

Auth routes: `/login`, `/signup`, `/join` (invite link handler).

## Architecture

### Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL) — fresh project, not shared with Life OS
- **Auth**: Supabase Auth (email/password) + household model
- **Bank connectivity**: Plaid Development tier (free, real bank data, up to 100 items)
- **Styling**: Tailwind CSS + CSS custom properties (`app/tokens.css`)
- **Charts**: Recharts (spending trends bar chart; net worth sparkline stays hand-rolled SVG)
- **PWA**: `@ducanh2912/next-pwa` — the maintained fork, compatible with Next.js 14 App Router

### File structure

```
app/
  layout.tsx
  page.tsx                      # Home
  budget/page.tsx
  accounts/page.tsx
  wealth/page.tsx
  settings/page.tsx
  login/ signup/ join/
  api/
    plaid/
      link-token/route.ts       # POST — create Link token (server only)
      exchange/route.ts         # POST — exchange public_token → access_token, store item
      accounts/route.ts         # GET — fetch balances
      transactions/route.ts     # GET — sync new transactions into DB

components/
  layout/
    AppShell.tsx
    Sidebar.tsx
    MobileNav.tsx               # Bottom tabs
    ThemeProvider.tsx
  ui/                           # Button, Card, Badge, ProgressBar, MetricCard
  dashboard/                    # NetWorthCard, BudgetHealthCard, SavingsSnapshot, TopSpending
  budget/                       # CategoryRow, MonthNav, CarryoverButton, SpendingTrendChart
  accounts/                     # AccountCard, TransactionList, TransactionRow, PlaidLinkButton
  wealth/                       # NetWorthChart, SavingsPodRow, AssetRow, DebtRow

lib/
  supabase/client.ts
  supabase/server.ts
  context/auth.tsx              # useAuth() — displayName, householdId, signOut
  plaid/client.ts               # Plaid Node SDK (server-side only)
  queries/
    finance.ts                  # Budget categories, income sources, recurring payments
    wealth.ts                   # Savings pods, assets, debts, net worth snapshots
    accounts.ts                 # Plaid items, plaid_accounts, transactions, merchant_rules
    households.ts               # Household + member management

types/index.ts
middleware.ts
public/
  manifest.json
```

### Code reuse from Life OS

The following files are ported with minimal changes:
- `lib/supabase/client.ts` and `server.ts`
- `lib/context/auth.tsx`
- `lib/queries/finance.ts` (budget categories, income sources, recurring payments)
- `lib/queries/households.ts`
- `components/ui/` (Button, Card, Badge, ProgressBar)
- `components/layout/AppShell.tsx`, `Sidebar.tsx`, `MobileNav.tsx`
- `middleware.ts`
- `types/index.ts` (finance-relevant types only)

## Database schema

### Ported from Life OS

```sql
households            (id uuid pk, name text)
household_members     (id, household_id fk, user_id fk, display_name text)
budget_categories     (id, household_id, name, month text, expected numeric, actual numeric)
income_sources        (id, household_id, owner text, name, month text, expected numeric, actual numeric)
recurring_payments    (id, household_id, name, amount numeric)
savings_pods          (id, household_id, name, allotted numeric, goal numeric)
assets                (id, household_id, name, type text, balance numeric)
debts                 (id, household_id, name, owner text, amount_owed numeric, interest_rate numeric)
net_worth_snapshots   (id, household_id, month text, total_assets numeric, total_debt numeric, net_worth numeric)
```

`month` is always a `YYYY-MM` string (e.g. `'2026-06'`).

### New in Rov

```sql
plaid_items (
  id uuid pk,
  household_id uuid fk,
  item_id text unique,           -- Plaid's item identifier
  access_token text,             -- never returned to client
  institution_id text,
  institution_name text,
  created_at timestamptz
)

plaid_accounts (
  id uuid pk,
  item_id uuid fk → plaid_items,
  household_id uuid fk,
  account_id text unique,        -- Plaid's account identifier
  name text,
  type text,                     -- depository, credit, loan, etc.
  subtype text,                  -- checking, savings, credit card, etc.
  mask text                      -- last 4 digits
)

transactions (
  id uuid pk,
  household_id uuid fk,
  account_id uuid fk → plaid_accounts,
  transaction_id text unique,    -- Plaid's transaction identifier
  merchant_name text,
  amount numeric,                -- positive = debit, negative = credit
  date date,
  category_id uuid fk → budget_categories nullable,
  is_pending boolean,
  created_at timestamptz
)

merchant_rules (
  id uuid pk,
  household_id uuid fk,
  merchant_name text,            -- plain text, NOT a FK — category names are matched by name within the current month
  category_name text,            -- e.g. "Groceries"
  unique(household_id, merchant_name)
)

household_invites (
  id uuid pk,
  household_id uuid fk,
  token text unique,
  expires_at timestamptz,
  used_at timestamptz nullable   -- set when the invite is claimed; prevents reuse
)
```

**Why `merchant_rules.category_name` is text, not a FK:** budget categories are per-month rows with different UUIDs each month. A rule like "Trader Joe's → Groceries" must survive across months. At categorization time, the rule's `category_name` is resolved against the current month's `budget_categories` rows by name match. If no matching category exists in the current month, the transaction stays uncategorized.

**RLS:** Row-level security must be enabled on all tables. Every table is scoped to `household_id`. Policies ensure users can only read/write rows belonging to their own household. `plaid_items.access_token` additionally should never appear in any client-facing query or API response.

## Plaid integration

### Flow

1. User clicks "Connect a bank" → client calls `/api/plaid/link-token` → server creates a Link token → returned to client
2. `PlaidLink` component opens the Plaid Link modal using the token
3. On success, client receives a `public_token` → sends to `/api/plaid/exchange`
4. Server exchanges `public_token` for `access_token` via Plaid SDK → stores in `plaid_items` → never returned to client
5. Accounts page loads → client calls `/api/plaid/accounts` → server fetches balances using stored `access_token` → returns safe account data (no tokens)
6. Transaction sync → client calls `/api/plaid/transactions` → server fetches new transactions → upserts into `transactions` table, resolving `merchant_rules` by name to set `category_id`

Transaction sync is on-demand only — triggered when the user visits the Accounts page. No webhooks or background sync in v1.

### Transaction categorization logic

```
when syncing transactions from Plaid:
  for each transaction:
    if merchant_name is null → category_id = null (skip rules; show as uncategorized)
    else:
      look up merchant_rules where household_id matches AND merchant_name matches
      if rule found:
        find budget_categories where household_id matches AND name = rule.category_name AND month = transaction month
        if found → set category_id
        if not found → category_id = null (rule exists but no matching category this month)
      if no rule → category_id = null (appears as "uncategorized")

when user manually assigns a transaction to a category:
  update transactions.category_id to the selected budget_categories.id
  upsert into merchant_rules (household_id, merchant_name, category_name)
  → future transactions from this merchant will auto-assign to this category name
  note: if merchant_name is null, do not save a rule — only update the single transaction
```

### The `actual` field

`budget_categories.actual` remains a **manually editable field**, consistent with Life OS. Plaid transactions do not automatically write to `actual`.

Instead, the budget category row UI shows a "from bank" hint: the sum of all categorized non-pending transactions for that category in the current month, computed at query time. A small "use $487" tap target lets the user copy that sum into the `actual` field with one tap.

This model is simpler, avoids double-counting, and works correctly before Plaid is connected.

### Net worth and Plaid account balances

Net worth snapshots use **manually-entered assets and debts only** (the `assets` and `debts` tables), consistent with Life OS. Plaid account balances are shown on the Accounts page but do not auto-feed into the `assets` table or net worth calculations in v1.

Reason: auto-syncing Plaid balances into `assets` would create duplicate entries for users who already have manual asset rows, and would silently overwrite values if Plaid momentarily shows a pending state. Manual control is safer for a financial source of truth. This can be revisited in v2.

## Carryover behavior

Triggered by a "Copy from last month" button on the Budget page, visible when the current month has zero budget categories.

**What gets copied:**
- `budget_categories`: copy `name` and `expected` from last month; insert new rows for the current month with `actual = 0`
- `income_sources`: copy `owner`, `name`, and `expected` from last month; insert new rows with `actual = 0`
- `recurring_payments`: no carryover needed — these are not month-scoped

**Conflict handling:** if the current month already has some categories (e.g., the user added a few manually before clicking carryover), skip any category whose `name` already exists in the current month. Do not overwrite.

**When to show the button:** always show it on the Budget page whenever the previous month has at least one budget category, regardless of whether the current month is empty. Hiding it only for empty months would prevent users from adding a forgotten category via carryover mid-month.

## Invite flow

1. The first user signs up normally → a new `household` is created and they are added to `household_members`
2. In Settings → "Invite your partner": generates a single-use invite token stored in a `household_invites` table `(id, household_id, token, expires_at, used_at)`
3. A shareable URL is displayed: `https://rov.app/join?token=<token>` — user copies and sends to their partner
4. Partner opens the link → `/join` page → they sign up (or log in if they already have an account) → the token is validated and they are added to the same household
5. Token is marked used; expires after 7 days

**Additional table:**
```sql
household_invites (id uuid pk, household_id uuid fk, token text unique, expires_at timestamptz, used_at timestamptz nullable)
```

## Design system

### Theme

Dark navy default, warm off-white light mode. Toggle stored in `localStorage` and applied as a class on `<html>`.

**Dark mode tokens:**
```css
--color-background: #0a0e1a;
--color-surface:    #111827;
--color-border:     #1e2a45;
--color-foreground: #ffffff;
--color-muted:      #4a5a7a;
```

**Light mode tokens:**
```css
--color-background: #f8f7f4;
--color-surface:    #ffffff;
--color-border:     #ece9e3;
--color-foreground: #1a1a1a;
--color-muted:      #888888;
```

**Semantic colors (same in both modes):**
```css
--color-primary:  #3b6ef8;   /* blue — brand, interactive */
--color-positive: #2d9e6b;   /* green — growth, savings, positive values */
--color-negative: #e8553a;   /* red — over budget, debt, negative values */
```

### Rules

- Font weights: 400 and 500 only — never 600 or 700
- Sentence case always — never title case or ALL CAPS
- Input `font-size`: 16px minimum (prevents iOS Safari zoom on PWA)
- Standard card: surface background, `0.5px` border, `12px` radius, `1rem` padding
- Metric card: surface background, no border, `8px` radius
- Progress bars: `6px` tall, `99px` border-radius
- Spacing: `rem` for layout, `px` for internals (8 / 12 / 16px)
- No gradients, shadows, or blur anywhere

## PWA configuration

- `@ducanh2912/next-pwa` wraps `next.config.mjs` — use this fork, not the unmaintained `next-pwa`, for App Router compatibility
- `public/manifest.json`: `name: "Rov"`, `short_name: "Rov"`, `theme_color: "#3b6ef8"`, `background_color: "#0a0e1a"`, `display: "standalone"`, `start_url: "/"`
- Service worker caches the app shell for offline navigation; financial data (Supabase + Plaid) is never cached — always fetched fresh
- Android: browser prompts "Add to Home Screen" automatically
- iOS: user taps Share → "Add to Home Screen" in Safari

## Open questions

- Deployment URL / custom domain (Vercel recommended)
- Logo/wordmark for v1 or text-only
