# Rov Plan 2 — Plaid, Accounts, Spending Trends & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Plaid bank connectivity, the full Accounts page (live balances + categorized transaction feed), spending trend charts on the Budget page, and PWA installability.

**Architecture:** Server-side Plaid Node SDK with all `access_token`s stored in Supabase and never returned to the client. Plaid Link UI via `react-plaid-link`. Transaction sync is on-demand (triggered when user visits Accounts). Merchant-rule resolution extracted as a pure function for unit testing. PWA via `@ducanh2912/next-pwa` wrapping the Next.js config. Budget page gains a "from bank" hint (sum of categorized non-pending transactions) and a collapsible spending trends section per category.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + RLS via `@supabase/ssr`), `plaid` Node SDK (v29+), `react-plaid-link`, `recharts`, `@ducanh2912/next-pwa`.

---

## File map

**New files:**
```
lib/plaid/client.ts                          # Plaid Node SDK singleton (server-side only)
lib/plaid/categorize.ts                      # Pure fn: resolveCategoryId
lib/plaid/categorize.test.ts                 # Unit tests for resolveCategoryId

lib/queries/accounts.ts                      # Supabase queries: transactions, merchant_rules, bank hints

app/api/plaid/link-token/route.ts            # POST — create Plaid Link token
app/api/plaid/exchange/route.ts              # POST — exchange public_token, store item + accounts
app/api/plaid/accounts/route.ts              # GET  — fetch live balances (no tokens in response)
app/api/plaid/transactions/route.ts          # GET  — sync transactions, apply merchant rules

components/accounts/PlaidLinkButton.tsx      # Fetch token → open Plaid Link → call exchange
components/accounts/AccountCard.tsx          # Display one bank account (name, balance, type)
components/accounts/TransactionRow.tsx       # One transaction + inline category picker
components/accounts/TransactionList.tsx      # List: loading skeletons, empty state, rows

components/budget/SpendingTrendChart.tsx     # Recharts bar chart: actual spend per month

public/manifest.json                         # PWA manifest
public/icon.svg                              # PWA icon (SVG; replace with PNG for production)
```

**Modified files:**
```
types/index.ts            # Add PlaidItem, PlaidAccount, Transaction, MerchantRule, AccountWithBalance
lib/utils.ts              # Add getPastMonths helper
lib/utils.test.ts         # Add tests for getPastMonths
next.config.ts            # Wrap with withPWA; add Plaid domains to CSP
app/accounts/page.tsx     # Replace placeholder with full Accounts page
app/budget/page.tsx       # Add spending trends section + "from bank" hint
```

---

## Task 1: Install dependencies and configure env vars

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install plaid react-plaid-link recharts @ducanh2912/next-pwa
```

- [ ] **Step 2: Add Plaid env vars to `.env.local`**

Open `.env.local` (project root) and add these three lines:

```
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_development_secret_here
PLAID_ENV=development
```

Get `PLAID_CLIENT_ID` and `PLAID_SECRET` from [Plaid Dashboard](https://dashboard.plaid.com/) → Team Settings → Keys. Use the **Development** secret (not Sandbox or Production).

- [ ] **Step 3: Verify build is still clean**

```bash
npm run build 2>&1 | grep -c "error" || true
```

Expected: same error count as before (no regressions from installing packages).

---

## Task 2: Plaid database schema

**Files:** SQL only — run in Supabase Dashboard → SQL Editor (or use the `mcp__plugin_supabase_supabase__apply_migration` MCP tool).

- [ ] **Step 1: Create the four Plaid tables**

```sql
-- Plaid connected bank items (one row per bank connection per household)
create table plaid_items (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references households(id) on delete cascade,
  item_id              text not null unique,
  access_token         text not null,
  institution_id       text not null,
  institution_name     text not null,
  transactions_cursor  text,            -- null on first sync; updated after each transactionsSync
  created_at           timestamptz default now()
);

-- Individual bank accounts within an item
create table plaid_accounts (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references plaid_items(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  account_id   text not null unique,    -- Plaid's account identifier
  name         text not null,
  type         text not null,           -- depository, credit, loan, investment, other
  subtype      text not null,           -- checking, savings, credit card, etc.
  mask         text not null default '' -- last 4 digits
);

-- Transactions synced from Plaid
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  account_id     uuid not null references plaid_accounts(id) on delete cascade,
  transaction_id text not null unique,  -- Plaid's transaction identifier
  merchant_name  text,                  -- null for ATM withdrawals, transfers, etc.
  name           text not null,         -- Plaid's raw transaction name (always present)
  amount         numeric not null,      -- positive = debit (expense), negative = credit (income)
  date           date not null,
  category_id    uuid references budget_categories(id) on delete set null,
  is_pending     boolean not null default false,
  created_at     timestamptz default now()
);

-- Merchant → category name rules (text, not FK — survives month boundaries)
create table merchant_rules (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  merchant_name text not null,
  category_name text not null,
  created_at    timestamptz default now(),
  unique(household_id, merchant_name)
);
```

- [ ] **Step 2: Enable RLS and add policies**

```sql
alter table plaid_items    enable row level security;
alter table plaid_accounts enable row level security;
alter table transactions   enable row level security;
alter table merchant_rules enable row level security;

-- plaid_items
create policy "plaid_items: household access" on plaid_items
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- plaid_accounts
create policy "plaid_accounts: household access" on plaid_accounts
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- transactions
create policy "transactions: household access" on transactions
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- merchant_rules
create policy "merchant_rules: household access" on merchant_rules
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());
```

- [ ] **Step 3: Verify tables exist**

In Supabase → Table Editor confirm `plaid_items`, `plaid_accounts`, `transactions`, and `merchant_rules` all appear.

---

## Task 3: TypeScript types for Plaid entities

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Append Plaid types to `types/index.ts`**

Open `types/index.ts` and add the following block at the very end:

```typescript
// ── Plaid ─────────────────────────────────────────────────────────────────────

export interface PlaidItem {
  id: string
  household_id: string
  item_id: string
  access_token: string          // server-side only — never return to client
  institution_id: string
  institution_name: string
  transactions_cursor: string | null
  created_at: string
}

export interface PlaidAccount {
  id: string
  item_id: string
  household_id: string
  account_id: string            // Plaid's account ID (text)
  name: string
  type: string
  subtype: string
  mask: string
}

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
  created_at: string
}

export interface MerchantRule {
  id: string
  household_id: string
  merchant_name: string
  category_name: string
  created_at: string
}

// Safe account data returned from /api/plaid/accounts (no access_token)
export interface AccountWithBalance {
  account_id: string            // Plaid's ID (text)
  name: string
  type: string
  subtype: string
  mask: string
  institution_name: string
  balances: {
    current: number | null
    available: number | null
    iso_currency_code: string | null
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npm run build 2>&1 | grep "types/index" | head -5
```

Expected: no type errors from `types/index.ts`.

---

## Task 4: Plaid server client

**Files:**
- Create: `lib/plaid/client.ts`

- [ ] **Step 1: Create `lib/plaid/client.ts`**

```typescript
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

const env = (process.env.PLAID_ENV ?? 'development') as keyof typeof PlaidEnvironments

export const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET':    process.env.PLAID_SECRET,
      },
    },
  }),
)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "lib/plaid/client" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/plaid/client.ts types/index.ts
git commit -m "feat: add Plaid server client and TypeScript types"
```

---

## Task 5: Merchant rule resolution — pure function + unit tests

**Files:**
- Create: `lib/plaid/categorize.ts`
- Create: `lib/plaid/categorize.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/plaid/categorize.test.ts
import { resolveCategoryId } from './categorize'

const rules = [
  { merchant_name: "Trader Joe's", category_name: 'Groceries' },
  { merchant_name: 'Starbucks',    category_name: 'Coffee' },
]

const categories = [
  { id: 'cat-g-jun', name: 'Groceries', month: '2026-06' },
  { id: 'cat-c-jun', name: 'Coffee',    month: '2026-06' },
  { id: 'cat-g-may', name: 'Groceries', month: '2026-05' },
]

describe('resolveCategoryId', () => {
  it('returns null when merchant_name is null', () => {
    expect(resolveCategoryId(null, rules, categories, '2026-06')).toBeNull()
  })

  it('returns null when no rule matches the merchant', () => {
    expect(resolveCategoryId('Amazon', rules, categories, '2026-06')).toBeNull()
  })

  it('resolves merchant to category_id in the correct month', () => {
    expect(resolveCategoryId("Trader Joe's", rules, categories, '2026-06')).toBe('cat-g-jun')
  })

  it('returns null when rule exists but no matching category this month', () => {
    expect(resolveCategoryId('Starbucks', rules, categories, '2026-07')).toBeNull()
  })

  it('resolves to the correct month when multiple months share the same category name', () => {
    expect(resolveCategoryId("Trader Joe's", rules, categories, '2026-05')).toBe('cat-g-may')
  })

  it('is case-insensitive when matching category_name to rule category_name', () => {
    const mixedRules = [{ merchant_name: 'Shell', category_name: 'gas' }]
    const mixedCats  = [{ id: 'cat-gas', name: 'Gas', month: '2026-06' }]
    expect(resolveCategoryId('Shell', mixedRules, mixedCats, '2026-06')).toBe('cat-gas')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test lib/plaid/categorize.test.ts
```

Expected: FAIL — `Cannot find module './categorize'`

- [ ] **Step 3: Write `lib/plaid/categorize.ts`**

```typescript
export function resolveCategoryId(
  merchantName: string | null,
  rules: { merchant_name: string; category_name: string }[],
  categories: { id: string; name: string; month: string }[],
  transactionMonth: string,
): string | null {
  if (!merchantName) return null
  const rule = rules.find(r => r.merchant_name === merchantName)
  if (!rule) return null
  const category = categories.find(
    c =>
      c.name.toLowerCase() === rule.category_name.toLowerCase() &&
      c.month === transactionMonth,
  )
  return category?.id ?? null
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test lib/plaid/categorize.test.ts
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/plaid/categorize.ts lib/plaid/categorize.test.ts
git commit -m "feat: add merchant rule resolution with unit tests"
```

---

## Task 6: `getPastMonths` utility + tests

**Files:**
- Modify: `lib/utils.ts`
- Modify: `lib/utils.test.ts`

This helper is needed by the spending trends section on the Budget page.

- [ ] **Step 1: Write the failing tests for `getPastMonths`**

Open `lib/utils.test.ts` and append:

```typescript
import { getPastMonths } from './utils'

describe('getPastMonths', () => {
  it('returns a single-element array when count is 1', () => {
    expect(getPastMonths('2026-06', 1)).toEqual(['2026-06'])
  })

  it('returns 3 months ending in the given month, oldest first', () => {
    expect(getPastMonths('2026-06', 3)).toEqual(['2026-04', '2026-05', '2026-06'])
  })

  it('rolls back correctly across a year boundary', () => {
    expect(getPastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test lib/utils.test.ts
```

Expected: FAIL — `getPastMonths is not a function`

- [ ] **Step 3: Add `getPastMonths` to `lib/utils.ts`**

Open `lib/utils.ts` and append:

```typescript
export function getPastMonths(currentMonth: string, count: number): string[] {
  const months: string[] = []
  let [y, mo] = currentMonth.split('-').map(Number)
  for (let i = 0; i < count; i++) {
    months.unshift(`${y}-${pad(mo)}`)
    mo -= 1
    if (mo === 0) { mo = 12; y -= 1 }
  }
  return months
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test lib/utils.test.ts
```

Expected: PASS — all existing tests plus the 3 new `getPastMonths` tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts
git commit -m "feat: add getPastMonths utility with tests"
```

---

## Task 7: Accounts queries

**Files:**
- Create: `lib/queries/accounts.ts`

Client-side Supabase queries for transactions, category assignment, merchant rules, and the "from bank" hint.

- [ ] **Step 1: Create `lib/queries/accounts.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

export interface TransactionWithCategory {
  id: string
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  is_pending: boolean
  category_id: string | null
  category_name: string | null
}

export async function getTransactions(
  householdId: string,
  limit = 150,
): Promise<TransactionWithCategory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_id, merchant_name, name, amount, date, is_pending, category_id, budget_categories(name)')
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(t => ({
    id:            t.id,
    transaction_id: t.transaction_id,
    merchant_name: t.merchant_name,
    name:          t.name,
    amount:        t.amount,
    date:          t.date,
    is_pending:    t.is_pending,
    category_id:   t.category_id,
    category_name: (t.budget_categories as { name: string } | null)?.name ?? null,
  }))
}

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transactions')
    .update({ category_id: categoryId })
    .eq('id', transactionId)
  if (error) throw error
}

export async function upsertMerchantRule(
  householdId: string,
  merchantName: string,
  categoryName: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('merchant_rules')
    .upsert(
      { household_id: householdId, merchant_name: merchantName, category_name: categoryName },
      { onConflict: 'household_id,merchant_name' },
    )
  if (error) throw error
}

// Returns sum of non-pending transaction amounts grouped by category_id for a given month.
// Used to show "from bank: $X" hints on budget category rows.
export async function getTransactionSumsByCategory(
  householdId: string,
  month: string,
): Promise<{ category_id: string; total: number }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount')
    .eq('household_id', householdId)
    .eq('is_pending', false)
    .not('category_id', 'is', null)
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`)
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const t of data ?? []) {
    if (!t.category_id) continue
    totals[t.category_id] = (totals[t.category_id] ?? 0) + t.amount
  }
  return Object.entries(totals).map(([category_id, total]) => ({ category_id, total }))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "queries/accounts" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/accounts.ts
git commit -m "feat: add accounts queries (transactions, merchant rules, bank hints)"
```

---

## Task 8: Link-token API route

**Files:**
- Create: `app/api/plaid/link-token/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "/Users/ethan2damax/Desktop/Random Projects/Rov/app/api/plaid/link-token"
```

- [ ] **Step 2: Write `app/api/plaid/link-token/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import { CountryCode, Products } from 'plaid'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Rov',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('[link-token]', err)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "link-token" | head -5
```

Expected: no errors.

---

## Task 9: Exchange API route

**Files:**
- Create: `app/api/plaid/exchange/route.ts`

Receives `public_token` + institution metadata from `react-plaid-link`'s `onSuccess` callback, exchanges for `access_token`, stores the item and initial account list.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "/Users/ethan2damax/Desktop/Random Projects/Rov/app/api/plaid/exchange"
```

- [ ] **Step 2: Write `app/api/plaid/exchange/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    public_token: string
    institution: { institution_id: string; name: string }
  }
  if (!body.public_token || !body.institution?.institution_id) {
    return NextResponse.json({ error: 'Missing public_token or institution' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'No household found' }, { status: 400 })
  const { household_id } = member

  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({
      public_token: body.public_token,
    })
    const { access_token, item_id } = exchangeRes.data

    const { data: plaidItem, error: itemErr } = await supabase
      .from('plaid_items')
      .upsert({
        household_id,
        item_id,
        access_token,
        institution_id:   body.institution.institution_id,
        institution_name: body.institution.name,
      }, { onConflict: 'item_id' })
      .select('id')
      .single()
    if (itemErr) throw itemErr

    const accountsRes = await plaidClient.accountsGet({ access_token })
    const rows = accountsRes.data.accounts.map(acct => ({
      item_id:      plaidItem.id,
      household_id,
      account_id:   acct.account_id,
      name:         acct.name,
      type:         acct.type,
      subtype:      acct.subtype ?? '',
      mask:         acct.mask ?? '',
    }))
    if (rows.length > 0) {
      const { error: acctErr } = await supabase
        .from('plaid_accounts')
        .upsert(rows, { onConflict: 'account_id' })
      if (acctErr) throw acctErr
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[exchange]', err)
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "api/plaid/exchange" | head -5
```

Expected: no errors.

---

## Task 10: Accounts balance API route

**Files:**
- Create: `app/api/plaid/accounts/route.ts`

Returns live balances for all connected accounts. The `access_token` is used server-side and never included in the response.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "/Users/ethan2damax/Desktop/Random Projects/Rov/app/api/plaid/accounts"
```

- [ ] **Step 2: Write `app/api/plaid/accounts/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import type { AccountWithBalance } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ accounts: [] })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('access_token, institution_name')
    .eq('household_id', member.household_id)
  if (!items || items.length === 0) return NextResponse.json({ accounts: [] })

  const allAccounts: AccountWithBalance[] = []
  for (const item of items) {
    try {
      const res = await plaidClient.accountsGet({ access_token: item.access_token })
      for (const acct of res.data.accounts) {
        allAccounts.push({
          account_id:       acct.account_id,
          name:             acct.name,
          type:             acct.type,
          subtype:          acct.subtype ?? '',
          mask:             acct.mask ?? '',
          institution_name: item.institution_name,
          balances: {
            current:           acct.balances.current        ?? null,
            available:         acct.balances.available      ?? null,
            iso_currency_code: acct.balances.iso_currency_code ?? null,
          },
        })
      }
    } catch (err) {
      console.error('[accounts] failed to fetch item', err)
    }
  }

  return NextResponse.json({ accounts: allAccounts })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "api/plaid/accounts" | head -5
```

Expected: no errors.

---

## Task 11: Transactions sync API route

**Files:**
- Create: `app/api/plaid/transactions/route.ts`

Syncs new transactions from Plaid using `transactionsSync` (cursor-based), applies merchant rules, and upserts into the `transactions` table.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "/Users/ethan2damax/Desktop/Random Projects/Rov/app/api/plaid/transactions"
```

- [ ] **Step 2: Write `app/api/plaid/transactions/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'
import { resolveCategoryId } from '@/lib/plaid/categorize'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ synced: 0 })
  const { household_id } = member

  const { data: items } = await supabase
    .from('plaid_items')
    .select('id, access_token, transactions_cursor')
    .eq('household_id', household_id)
  if (!items || items.length === 0) return NextResponse.json({ synced: 0 })

  // Build a map from Plaid's account_id (text) → our UUID
  const { data: plaidAccounts } = await supabase
    .from('plaid_accounts')
    .select('id, account_id')
    .eq('household_id', household_id)
  const accountMap: Record<string, string> = Object.fromEntries(
    (plaidAccounts ?? []).map(a => [a.account_id, a.id]),
  )

  // Load merchant rules and all budget categories for rule resolution
  const [{ data: rules }, { data: categories }] = await Promise.all([
    supabase.from('merchant_rules').select('merchant_name, category_name').eq('household_id', household_id),
    supabase.from('budget_categories').select('id, name, month').eq('household_id', household_id),
  ])
  const merchantRules   = rules      ?? []
  const budgetCategories = categories ?? []

  let totalSynced = 0

  for (const item of items) {
    try {
      let cursor:  string | undefined = item.transactions_cursor ?? undefined
      let hasMore: boolean = true

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.access_token,
          ...(cursor ? { cursor } : {}),
        })
        const { added, modified, removed, next_cursor, has_more } = response.data
        cursor  = next_cursor
        hasMore = has_more

        if (removed.length > 0) {
          const removedIds = removed.map(t => t.transaction_id)
          await supabase.from('transactions').delete().in('transaction_id', removedIds)
        }

        const toUpsert = [...added, ...modified].flatMap(t => {
          const ourAccountId = accountMap[t.account_id]
          if (!ourAccountId) return []
          const txMonth  = (t.date as string).slice(0, 7)
          const categoryId = resolveCategoryId(
            t.merchant_name ?? null,
            merchantRules,
            budgetCategories,
            txMonth,
          )
          return [{
            household_id,
            account_id:     ourAccountId,
            transaction_id: t.transaction_id,
            merchant_name:  t.merchant_name ?? null,
            name:           t.name,
            amount:         t.amount,
            date:           t.date,
            category_id:    categoryId,
            is_pending:     t.pending,
          }]
        })

        if (toUpsert.length > 0) {
          const { error: upsertErr } = await supabase
            .from('transactions')
            .upsert(toUpsert, { onConflict: 'transaction_id' })
          if (upsertErr) throw upsertErr
          totalSynced += toUpsert.length
        }
      }

      await supabase
        .from('plaid_items')
        .update({ transactions_cursor: cursor })
        .eq('id', item.id)
    } catch (err) {
      console.error('[transactions] error syncing item', item.id, err)
    }
  }

  return NextResponse.json({ synced: totalSynced })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "api/plaid/transactions" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit all API routes**

```bash
git add app/api/
git commit -m "feat: add Plaid API routes (link-token, exchange, accounts, transactions)"
```

---

## Task 12: PlaidLinkButton component

**Files:**
- Create: `components/accounts/PlaidLinkButton.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "/Users/ethan2damax/Desktop/Random Projects/Rov/components/accounts"
```

- [ ] **Step 2: Write `components/accounts/PlaidLinkButton.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Button from '@/components/ui/Button'

interface PlaidLinkButtonProps {
  onConnected: () => void
}

export default function PlaidLinkButton({ onConnected }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetching,  setFetching]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const onSuccess = useCallback(async (publicToken: string, metadata: { institution: { institution_id: string; name: string } | null }) => {
    if (!metadata.institution) return
    try {
      const res = await fetch('/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          institution:  metadata.institution,
        }),
      })
      if (!res.ok) throw new Error('Failed to connect bank')
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [onConnected])

  const { open, ready } = usePlaidLink({
    token:     linkToken ?? '',
    onSuccess,
    onExit:    useCallback(() => setLinkToken(null), []),
  })

  // Auto-open once we have a token and the SDK is ready
  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function handleClick() {
    setFetching(true)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/link-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.link_token) throw new Error(data.error ?? 'Failed to get link token')
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
      setFetching(false)
    }
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={fetching} size="sm">
        {fetching ? 'Loading…' : 'Connect a bank'}
      </Button>
      {error && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "PlaidLinkButton" | head -5
```

Expected: no errors.

---

## Task 13: AccountCard component

**Files:**
- Create: `components/accounts/AccountCard.tsx`

- [ ] **Step 1: Write `components/accounts/AccountCard.tsx`**

```tsx
import type { AccountWithBalance } from '@/types'
import { fmt } from '@/lib/utils'

interface AccountCardProps {
  account: AccountWithBalance
}

function typeLabel(type: string, subtype: string): string {
  const label = subtype || type
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ')
}

export default function AccountCard({ account }: AccountCardProps) {
  const balance  = account.balances.current ?? account.balances.available
  const isCredit = account.type === 'credit'

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background:   'var(--color-surface)',
        border:       '0.5px solid var(--color-border)',
        borderRadius: '12px',
      }}
    >
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          {account.name}
          {account.mask && (
            <span style={{ color: 'var(--color-muted)' }}> ···{account.mask}</span>
          )}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {account.institution_name} · {typeLabel(account.type, account.subtype)}
        </p>
      </div>

      <div className="text-right">
        {balance != null ? (
          <p
            className="text-[15px] font-medium tabular-nums"
            style={{ color: isCredit ? 'var(--color-negative)' : 'var(--color-foreground)' }}
          >
            {isCredit && balance > 0 ? '−' : ''}{fmt(Math.abs(balance))}
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>—</p>
        )}
        {!isCredit && account.balances.available != null && (
          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {fmt(account.balances.available)} available
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "AccountCard" | head -5
```

Expected: no errors.

---

## Task 14: TransactionRow + TransactionList components

**Files:**
- Create: `components/accounts/TransactionRow.tsx`
- Create: `components/accounts/TransactionList.tsx`

- [ ] **Step 1: Write `components/accounts/TransactionRow.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { BudgetCategory } from '@/types'
import { fmt } from '@/lib/utils'
import { updateTransactionCategory, upsertMerchantRule } from '@/lib/queries/accounts'

interface TransactionRowProps {
  id:            string
  merchantName:  string | null
  name:          string
  amount:        number
  date:          string
  isPending:     boolean
  categoryId:    string | null
  categoryName:  string | null
  categories:    BudgetCategory[]
  householdId:   string
}

export default function TransactionRow({
  id, merchantName, name, amount, date, isPending,
  categoryId, categoryName, categories, householdId,
}: TransactionRowProps) {
  const [currentCatId,   setCurrentCatId]   = useState(categoryId)
  const [currentCatName, setCurrentCatName] = useState(categoryName)
  const [saving, setSaving] = useState(false)

  async function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCatId = e.target.value || null
    const newCat   = categories.find(c => c.id === newCatId) ?? null
    setSaving(true)
    try {
      await updateTransactionCategory(id, newCatId)
      if (newCat && merchantName) {
        await upsertMerchantRule(householdId, merchantName, newCat.name)
      }
      setCurrentCatId(newCatId)
      setCurrentCatName(newCat?.name ?? null)
    } catch (err) {
      console.error('Failed to update category', err)
    } finally {
      setSaving(false)
    }
  }

  const displayName    = merchantName ?? name
  const isExpense      = amount > 0
  const formattedDate  = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      <span
        className="text-[11px] w-11 flex-shrink-0 tabular-nums"
        style={{ color: 'var(--color-muted)' }}
      >
        {formattedDate}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>
          {displayName}
          {isPending && (
            <span className="ml-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>pending</span>
          )}
        </p>
        <select
          value={currentCatId ?? ''}
          onChange={handleCategoryChange}
          disabled={saving}
          className="mt-0.5 text-[11px] bg-transparent border-none outline-none cursor-pointer"
          style={{ color: currentCatName ? 'var(--color-primary)' : 'var(--color-muted)' }}
        >
          <option value="">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <span
        className="text-[13px] font-medium tabular-nums flex-shrink-0"
        style={{ color: isExpense ? 'var(--color-foreground)' : 'var(--color-positive)' }}
      >
        {!isExpense && '+'}{fmt(Math.abs(amount))}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/accounts/TransactionList.tsx`**

```tsx
import type { BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import TransactionRow from './TransactionRow'

interface TransactionListProps {
  transactions: TransactionWithCategory[]
  categories:   BudgetCategory[]
  householdId:  string
  loading?:     boolean
}

function Skeleton() {
  return (
    <div className="flex gap-3 py-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="w-11 h-4 rounded animate-pulse" style={{ background: 'var(--color-surface)' }} />
      <div className="flex-1">
        <div className="h-4 w-40 rounded animate-pulse mb-1.5" style={{ background: 'var(--color-surface)' }} />
        <div className="h-3 w-20 rounded animate-pulse"        style={{ background: 'var(--color-surface)' }} />
      </div>
      <div className="w-14 h-4 rounded animate-pulse" style={{ background: 'var(--color-surface)' }} />
    </div>
  )
}

export default function TransactionList({ transactions, categories, householdId, loading }: TransactionListProps) {
  if (loading) {
    return <div>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>
  }

  if (transactions.length === 0) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: 'var(--color-muted)' }}>
        No transactions yet. Click Sync to load from your connected banks.
      </p>
    )
  }

  return (
    <div>
      {transactions.map(t => (
        <TransactionRow
          key={t.id}
          id={t.id}
          merchantName={t.merchant_name}
          name={t.name}
          amount={t.amount}
          date={t.date}
          isPending={t.is_pending}
          categoryId={t.category_id}
          categoryName={t.category_name}
          categories={categories}
          householdId={householdId}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "TransactionRow|TransactionList" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/accounts/
git commit -m "feat: add Plaid accounts components (PlaidLinkButton, AccountCard, TransactionRow, TransactionList)"
```

---

## Task 15: Accounts page

**Files:**
- Modify: `app/accounts/page.tsx`

Replaces the placeholder with the full Accounts page: connected bank accounts with live balances, sync button, and categorized transaction feed.

- [ ] **Step 1: Replace `app/accounts/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/context/auth'
import { getTransactions } from '@/lib/queries/accounts'
import { getBudgetCategories } from '@/lib/queries/finance'
import { currentMonth } from '@/lib/utils'
import type { AccountWithBalance, BudgetCategory } from '@/types'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PlaidLinkButton from '@/components/accounts/PlaidLinkButton'
import AccountCard from '@/components/accounts/AccountCard'
import TransactionList from '@/components/accounts/TransactionList'

export default function AccountsPage() {
  const { householdId } = useAuth()
  const [accounts,     setAccounts]     = useState<AccountWithBalance[]>([])
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([])
  const [categories,   setCategories]   = useState<BudgetCategory[]>([])
  const [loadingAcct,  setLoadingAcct]  = useState(true)
  const [loadingTx,    setLoadingTx]    = useState(true)
  const [syncing,      setSyncing]      = useState(false)
  const [syncMsg,      setSyncMsg]      = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const month = currentMonth()

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
        getTransactions(householdId),
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

  useEffect(() => {
    loadAccounts()
    loadTransactions()
  }, [loadAccounts, loadTransactions])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/transactions')
      const data = await res.json()
      setSyncMsg(`Synced ${data.synced ?? 0} new transactions`)
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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
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
      {syncMsg && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-positive)' }}>{syncMsg}</p>
      )}

      {/* Connected accounts */}
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
        <div className="flex flex-col gap-2 mb-6">
          {accounts.map(acct => (
            <AccountCard key={acct.account_id} account={acct} />
          ))}
        </div>
      )}

      {/* Transaction feed */}
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>
        Transactions
      </h2>
      {householdId && (
        <TransactionList
          transactions={transactions}
          categories={categories}
          householdId={householdId}
          loading={loadingTx}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "accounts/page" | head -5
```

Expected: no errors.

- [ ] **Step 3: Manual test — full Plaid flow**

```
1. npm run dev → open http://localhost:3000/accounts
2. Click "Connect a bank" → Plaid Link modal opens
3. In Development mode: use "First Platypus Bank" (test institution) 
   username: user_good, password: pass_good
4. Complete the flow → modal closes, account cards appear with balances
5. Click "Sync" → "Synced X new transactions" message appears
6. Transactions appear in the feed; known merchants may have categories pre-filled
7. Tap the category dropdown on an uncategorized transaction → pick a category
8. The dropdown updates; if the transaction has a merchant_name, future transactions
   from that merchant will auto-categorize
```

- [ ] **Step 4: Commit**

```bash
git add app/accounts/page.tsx
git commit -m "feat: implement full Accounts page with live balances and transaction feed"
```

---

## Task 16: Spending trends on the Budget page

**Files:**
- Create: `components/budget/SpendingTrendChart.tsx`
- Modify: `app/budget/page.tsx`

A collapsible "Spending trends" section appears at the bottom of the budget page. Each category gets a small bar chart showing its `actual` spend for the past 6 months.

- [ ] **Step 1: Create `components/budget/SpendingTrendChart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface TrendPoint {
  month: string
  label: string
  actual: number
}

interface SpendingTrendChartProps {
  data: TrendPoint[]
  currentMonth: string
}

export function buildTrendPoints(
  categoryName: string,
  months: string[],
  allCategories: { name: string; month: string; actual: number }[],
): TrendPoint[] {
  return months.map(m => {
    const row = allCategories.find(
      c => c.month === m && c.name.toLowerCase() === categoryName.toLowerCase(),
    )
    const [y, mo] = m.split('-').map(Number)
    const label = new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' })
    return { month: m, label, actual: row?.actual ?? 0 }
  })
}

export default function SpendingTrendChart({ data, currentMonth }: SpendingTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          cursor={false}
          contentStyle={{
            background:   'var(--color-surface)',
            border:       '0.5px solid var(--color-border)',
            borderRadius: '8px',
            fontSize:     '12px',
            color:        'var(--color-foreground)',
          }}
          formatter={(value: number) => [`$${value.toFixed(0)}`, 'Spent']}
        />
        <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
          {data.map(entry => (
            <Cell
              key={entry.month}
              fill={entry.month === currentMonth
                ? 'var(--color-primary)'
                : 'var(--color-border)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Update imports at the top of `app/budget/page.tsx`**

At the top of `app/budget/page.tsx`, after the existing imports, add:

```typescript
import { getBudgetCategoriesPastMonths } from '@/lib/queries/finance'
import { getTransactionSumsByCategory } from '@/lib/queries/accounts'
import SpendingTrendChart, { buildTrendPoints } from '@/components/budget/SpendingTrendChart'
import { getPastMonths } from '@/lib/utils'
import { useAuth } from '@/lib/context/auth'
```

- [ ] **Step 3: Add state for trends + bank hints inside `BudgetPage`**

After the existing state declarations in `BudgetPage`, add:

```typescript
const { householdId } = useAuth()
const [pastCategories, setPastCategories] = useState<BudgetCategory[]>([])
const [bankSums,       setBankSums]       = useState<{ category_id: string; total: number }[]>([])
const [showTrends,     setShowTrends]     = useState(false)
```

- [ ] **Step 4: Extend the `load` function to also fetch trends and bank hints**

Inside the `load` callback, after `setCategories(cats)` and `setTotalIncome(...)`, add:

```typescript
// Fetch past 6 months for trend charts
const trendMonths = getPastMonths(month, 6)
const [pastCats, bankSumsData] = await Promise.all([
  getBudgetCategoriesPastMonths(trendMonths),
  householdId ? getTransactionSumsByCategory(householdId, month) : Promise.resolve([]),
])
setPastCategories(pastCats)
setBankSums(bankSumsData)
```

- [ ] **Step 5: Add "from bank" hint to each category row in the JSX**

Find the section in `app/budget/page.tsx` where each category is rendered. Locate the `actual` input field for a category. After the `actual` input, add the bank hint:

```tsx
{/* After the actual input field in each category row: */}
{(() => {
  const bankSum = bankSums.find(b => b.category_id === c.id)
  if (!bankSum || bankSum.total === 0) return null
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        from bank: {fmtWhole(bankSum.total)}
      </span>
      <button
        className="text-[11px]"
        style={{ color: 'var(--color-primary)' }}
        onClick={() => handleUpdateField(c.id, 'actual', String(bankSum.total))}
      >
        use this
      </button>
    </div>
  )
})()}
```

**Where to insert:** Look for the block that renders `c.actual` — it will be near an `<input>` with `onChange` calling `handleUpdateField(c.id, 'actual', ...)`. Place the bank hint block immediately after that input.

- [ ] **Step 6: Add spending trends section at the bottom of the page JSX**

At the very end of the returned JSX in `BudgetPage`, before the closing `</>` or `</div>`, add:

```tsx
{/* Spending trends */}
{categories.length > 0 && (
  <div className="mt-8">
    <button
      className="flex items-center gap-2 text-[13px] mb-4"
      style={{ color: 'var(--color-foreground-secondary)' }}
      onClick={() => setShowTrends(t => !t)}
    >
      <span>{showTrends ? '▾' : '▸'}</span>
      Spending trends
    </button>
    {showTrends && (
      <div className="flex flex-col gap-6">
        {categories
          .filter(c => c.expected > 0)
          .map(c => {
            const trendMonths = getPastMonths(month, 6)
            const data = buildTrendPoints(c.name, trendMonths, pastCategories)
            const hasAnyData = data.some(d => d.actual > 0)
            if (!hasAnyData) return null
            return (
              <div key={c.id}>
                <p className="text-[12px] mb-2" style={{ color: 'var(--color-muted)' }}>{c.name}</p>
                <SpendingTrendChart data={data} currentMonth={month} />
              </div>
            )
          })
          .filter(Boolean)}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "budget/page|SpendingTrendChart" | head -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/budget/SpendingTrendChart.tsx app/budget/page.tsx
git commit -m "feat: add spending trend charts and bank hints to Budget page"
```

---

## Task 17: PWA setup + update CSP for Plaid

**Files:**
- Create: `public/manifest.json`
- Create: `public/icon.svg`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "Rov",
  "short_name": "Rov",
  "description": "Household budgeting",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e1a",
  "theme_color": "#3b6ef8",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#3b6ef8"/>
  <text x="96" y="130" font-family="-apple-system, BlinkMacSystemFont, sans-serif"
        font-size="100" font-weight="500" fill="white" text-anchor="middle">ר</text>
</svg>
```

- [ ] **Step 3: Update `next.config.ts` — wrap with PWA and add Plaid to CSP**

Read the current `next.config.ts` first, then replace it entirely with:

```typescript
import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const csp = [
  "default-src 'self'",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://development.plaid.com https://production.plaid.com`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "frame-src 'self' https://cdn.plaid.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: csp },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

const withPWAConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
})

export default withPWAConfig(nextConfig)
```

- [ ] **Step 4: Add the PWA link tag to `app/layout.tsx`**

Open `app/layout.tsx`. In the `<head>` section (or add one if missing), add the manifest link. Find the `<html>` tag and add inside the `<head>`:

```tsx
export const metadata: Metadata = {
  title: 'Rov',
  description: 'Household budgeting',
  manifest: '/manifest.json',
  themeColor: '#3b6ef8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rov',
  },
}
```

Replace the existing `metadata` export in `app/layout.tsx` with the above.

- [ ] **Step 5: Verify build completes**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes. `@ducanh2912/next-pwa` may print messages about service worker generation — that's normal. No TypeScript errors.

- [ ] **Step 6: Manual PWA test**

```
1. npm run build && npm start
2. Open http://localhost:3000 in Chrome
3. Open DevTools → Application → Manifest → confirm name: "Rov", theme_color: "#3b6ef8"
4. Application → Service Workers → confirm a service worker is registered
5. On mobile (or Chrome DevTools device emulation):
   - Android: browser prompts "Add to Home Screen" 
   - iOS Safari: tap Share → "Add to Home Screen" → Rov icon appears
```

- [ ] **Step 7: Commit**

```bash
git add public/manifest.json public/icon.svg next.config.ts app/layout.tsx
git commit -m "feat: add PWA support and update CSP for Plaid"
```

---

## Self-review: spec coverage check

| Spec requirement | Implemented in |
|---|---|
| Plaid link token creation | Task 8 |
| Plaid token exchange + item storage | Task 9 |
| Live account balances | Task 10 |
| Transaction sync (on-demand, cursor-based) | Task 11 |
| Merchant rule resolution (auto-categorization) | Task 5 |
| Manual category assignment + rule save | Task 14 |
| `access_token` never returned to client | Tasks 10, 11 (server routes only) |
| Accounts page: connected accounts display | Task 15 |
| Accounts page: transaction feed with category picker | Tasks 14, 15 |
| "From bank" hint on budget categories | Task 16 |
| Spending trends bar charts per category | Task 16 |
| PWA manifest + service worker | Task 17 |
| Plaid domains in CSP | Task 17 |
| RLS on all new tables | Task 2 |
| TypeScript types for all new entities | Task 3 |

All spec requirements are covered. The `actual` field remains manually editable (Plaid transactions only feed the "from bank" hint, not `actual` directly) — consistent with the spec.
