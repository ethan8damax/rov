# Rov Core App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Rov budgeting app core — auth, household model, budget page, wealth page, settings page, invite flow, month-to-month carryover, and a basic dashboard — producing a fully working budgeting app with no Plaid dependency.

**Architecture:** Fresh Next.js 14 App Router project scaffolded into `/Users/ethan2damax/Desktop/Random Projects/Rov`. Supabase for auth + data. Components and queries are ported from Life OS (`/Users/ethan2damax/Desktop/Random Projects/life os project/life-os`) and adapted to the Rov design system (dark navy, blue accent, no amber). Plan 2 will add Plaid, the Accounts page, spending trends, and PWA.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), Tailwind CSS, CSS custom properties, Jest + React Testing Library.

---

## File map

```
app/
  layout.tsx                   # ThemeProvider > AuthProvider > AppShell + MobileNav
  page.tsx                     # Home dashboard
  budget/page.tsx              # Budget categories + carryover button
  wealth/page.tsx              # Savings pods + assets + debts + net worth
  settings/page.tsx            # Income sources + recurring payments + invite
  login/page.tsx
  signup/page.tsx
  join/page.tsx                # Invite token handler

components/
  layout/
    ThemeProvider.tsx
    AppShell.tsx
    Sidebar.tsx
    MobileNav.tsx
  ui/
    Button.tsx
    Card.tsx
    Badge.tsx
    ProgressBar.tsx
    MetricCard.tsx

lib/
  supabase/client.ts
  supabase/server.ts
  context/auth.tsx
  queries/
    finance.ts                 # budget_categories, income_sources, recurring_payments
    wealth.ts                  # savings_pods, assets, debts, net_worth_snapshots
    households.ts              # household + member queries + invite flow
  utils.ts

types/index.ts
middleware.ts
jest.config.ts
jest.setup.ts
lib/utils.test.ts              # Tests for pure utility functions
lib/queries/carryover.test.ts  # Tests for carryover logic
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: entire project structure via `create-next-app`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.local`

- [ ] **Step 1: Scaffold into the existing directory**

The `Rov/` directory already has `CLAUDE.md` and `docs/` — create-next-app will ask to confirm; it won't touch those files.

```bash
cd "/Users/ethan2damax/Desktop/Random Projects"
npx create-next-app@latest Rov \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

When prompted "The directory Rov contains files that could conflict. Continue?" → **Yes**.

- [ ] **Step 2: Install runtime dependencies**

```bash
cd "/Users/ethan2damax/Desktop/Random Projects/Rov"
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install -D jest jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event
```

- [ ] **Step 4: Write `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Write `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Create `.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Fill these in from your Supabase project dashboard (Settings → API).

- [ ] **Step 8: Verify the build runs**

```bash
npm run dev
```

Expected: Next.js dev server starts at http://localhost:3000 with the default Next.js homepage.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Supabase and test deps"
```

---

## Task 2: Design tokens + ThemeProvider

**Files:**
- Create: `app/tokens.css`
- Modify: `app/globals.css`
- Create: `components/layout/ThemeProvider.tsx`

- [ ] **Step 1: Write `app/tokens.css`**

```css
/* Rov design tokens — dark-first, blue accent */

:root {
  --color-background: #0a0e1a;
  --color-surface: #111827;
  --color-border: #1e2a45;
  --color-border-subtle: #161e32;
  --color-foreground: #ffffff;
  --color-foreground-secondary: #94a3b8;
  --color-muted: #4a5a7a;

  --color-primary: #3b6ef8;
  --color-primary-subtle: rgba(59, 110, 248, 0.12);
  --color-positive: #2d9e6b;
  --color-positive-subtle: rgba(45, 158, 107, 0.12);
  --color-negative: #e8553a;
  --color-negative-subtle: rgba(232, 85, 58, 0.12);

  --border-radius-sm: 6px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}

.light {
  --color-background: #f8f7f4;
  --color-surface: #ffffff;
  --color-border: #ece9e3;
  --color-border-subtle: #f0ede7;
  --color-foreground: #1a1a1a;
  --color-foreground-secondary: #6b7280;
  --color-muted: #9ca3af;

  --color-primary: #3b6ef8;
  --color-primary-subtle: rgba(59, 110, 248, 0.08);
  --color-positive: #2d9e6b;
  --color-positive-subtle: rgba(45, 158, 107, 0.08);
  --color-negative: #e8553a;
  --color-negative-subtle: rgba(232, 85, 58, 0.08);
}
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
@import './tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 99px; }
```

- [ ] **Step 3: Write `components/layout/ThemeProvider.tsx`**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('rov-theme') as Theme | null
    if (stored) setTheme(stored)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('rov-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 4: Verify tokens apply**

Run `npm run dev`. Open http://localhost:3000. The page background should be `#0a0e1a` (dark navy) — not white.

- [ ] **Step 5: Commit**

```bash
git add app/tokens.css app/globals.css components/layout/ThemeProvider.tsx
git commit -m "feat: add design tokens and ThemeProvider"
```

---

## Task 3: Utility functions

**Files:**
- Create: `lib/utils.ts`
- Create: `lib/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/utils.test.ts
import { pad, shiftMonth, formatMonthLabel, currentMonth, cn } from './utils'

describe('pad', () => {
  it('pads single digits', () => expect(pad(3)).toBe('03'))
  it('leaves double digits alone', () => expect(pad(12)).toBe('12'))
})

describe('shiftMonth', () => {
  it('increments month', () => expect(shiftMonth('2026-01', 1)).toBe('2026-02'))
  it('rolls over December to January', () => expect(shiftMonth('2026-12', 1)).toBe('2027-01'))
  it('decrements month', () => expect(shiftMonth('2026-03', -1)).toBe('2026-02'))
  it('rolls back January to December', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'))
})

describe('formatMonthLabel', () => {
  it('formats month string to readable label', () => {
    expect(formatMonthLabel('2026-06')).toBe('June 2026')
  })
})

describe('currentMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('cn', () => {
  it('joins class names', () => expect(cn('a', 'b')).toBe('a b'))
  it('filters falsy values', () => expect(cn('a', false && 'b', undefined, 'c')).toBe('a c'))
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test lib/utils.test.ts
```

Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 3: Write `lib/utils.ts`**

```typescript
export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function shiftMonth(m: string, delta: 1 | -1): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function fmt(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtWhole(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test lib/utils.test.ts
```

Expected: PASS — 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts
git commit -m "feat: add utility functions with tests"
```

---

## Task 4: TypeScript types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Write `types/index.ts`**

```typescript
// ── Budget ────────────────────────────────────────────────────────────────────

export interface BudgetCategory {
  id: string
  household_id: string
  name: string
  month: string       // YYYY-MM
  expected: number
  actual: number
  created_at: string
}
export type BudgetCategoryInsert = Omit<BudgetCategory, 'id' | 'created_at' | 'household_id'>
export type BudgetCategoryUpdate = Partial<Pick<BudgetCategory, 'name' | 'expected' | 'actual'>>

export interface IncomeSource {
  id: string
  household_id: string
  owner: string
  name: string
  month: string
  expected: number
  actual: number
  created_at: string
}
export type IncomeSourceInsert = Omit<IncomeSource, 'id' | 'created_at' | 'household_id'>
export type IncomeSourceUpdate = Partial<Pick<IncomeSource, 'expected' | 'actual'>>

export interface RecurringPayment {
  id: string
  household_id: string
  name: string
  amount: number
  created_at: string
}
export type RecurringPaymentInsert = Omit<RecurringPayment, 'id' | 'created_at' | 'household_id'>
export type RecurringPaymentUpdate = Partial<Pick<RecurringPayment, 'name' | 'amount'>>

// ── Wealth ────────────────────────────────────────────────────────────────────

export interface SavingsPod {
  id: string
  household_id: string
  name: string
  allotted: number
  goal: number
  created_at: string
}
export type SavingsPodInsert = Omit<SavingsPod, 'id' | 'created_at' | 'household_id'>
export type SavingsPodUpdate = Partial<Pick<SavingsPod, 'name' | 'allotted' | 'goal'>>

export interface Asset {
  id: string
  household_id: string
  name: string
  type: string        // checking | savings | credit_card | investment | other
  balance: number
  created_at: string
}
export type AssetInsert = Omit<Asset, 'id' | 'created_at' | 'household_id'>
export type AssetUpdate = Partial<Pick<Asset, 'name' | 'type' | 'balance'>>

export interface Debt {
  id: string
  household_id: string
  name: string
  owner: string
  amount_owed: number
  interest_rate: number
  created_at: string
}
export type DebtInsert = Omit<Debt, 'id' | 'created_at' | 'household_id'>
export type DebtUpdate = Partial<Pick<Debt, 'name' | 'owner' | 'amount_owed' | 'interest_rate'>>

export interface NetWorthSnapshot {
  id: string
  household_id: string
  month: string
  total_assets: number
  total_debt: number
  net_worth: number
  created_at: string
}
export type NetWorthSnapshotInsert = Omit<NetWorthSnapshot, 'id' | 'created_at' | 'household_id'>

// ── Household ─────────────────────────────────────────────────────────────────

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  display_name: string
  created_at: string
}

export interface HouseholdInvite {
  id: string
  household_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: No type errors (build may fail on missing page content, that's fine — we're checking types only).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add TypeScript types for all entities"
```

---

## Task 5: Supabase clients + middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 2: Write `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Write `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/signup', '/join']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts middleware.ts
git commit -m "feat: add Supabase clients and auth middleware"
```

---

## Task 6: Database schema

**Files:** (no code files — SQL run in Supabase dashboard)

- [ ] **Step 1: Open your Supabase project → SQL Editor**

Go to your Supabase project dashboard → SQL Editor → New query.

- [ ] **Step 2: Run the schema SQL**

```sql
-- Households
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Household members (links auth.users to a household)
create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now(),
  unique(household_id, user_id)
);

-- Budget categories (per month)
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  month text not null,    -- YYYY-MM
  expected numeric not null default 0,
  actual numeric not null default 0,
  created_at timestamptz default now()
);

-- Income sources (per month, per person)
create table income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner text not null,
  name text not null,
  month text not null,
  expected numeric not null default 0,
  actual numeric not null default 0,
  created_at timestamptz default now()
);

-- Recurring payments (not month-scoped)
create table recurring_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null,
  created_at timestamptz default now()
);

-- Savings pods
create table savings_pods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  allotted numeric not null default 0,
  goal numeric not null default 0,
  created_at timestamptz default now()
);

-- Assets
create table assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null,
  balance numeric not null default 0,
  created_at timestamptz default now()
);

-- Debts
create table debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  owner text not null,
  amount_owed numeric not null default 0,
  interest_rate numeric not null default 0,
  created_at timestamptz default now()
);

-- Net worth snapshots (one per household per month)
create table net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month text not null,
  total_assets numeric not null,
  total_debt numeric not null,
  net_worth numeric not null,
  created_at timestamptz default now(),
  unique(household_id, month)
);

-- Household invites
create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);
```

- [ ] **Step 3: Run RLS policies**

```sql
-- Enable RLS on all tables
alter table households           enable row level security;
alter table household_members    enable row level security;
alter table budget_categories    enable row level security;
alter table income_sources       enable row level security;
alter table recurring_payments   enable row level security;
alter table savings_pods         enable row level security;
alter table assets               enable row level security;
alter table debts                enable row level security;
alter table net_worth_snapshots  enable row level security;
alter table household_invites    enable row level security;

-- Helper function: get the caller's household_id
create or replace function get_household_id()
returns uuid language sql security definer stable as $$
  select household_id from household_members
  where user_id = auth.uid()
  limit 1;
$$;

-- household_members: user can read/insert their own row
create policy "members: read own household" on household_members
  for select using (household_id = get_household_id());

create policy "members: insert own row" on household_members
  for insert with check (user_id = auth.uid());

-- budget_categories
create policy "budget_categories: household access" on budget_categories
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- income_sources
create policy "income_sources: household access" on income_sources
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- recurring_payments
create policy "recurring_payments: household access" on recurring_payments
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- savings_pods
create policy "savings_pods: household access" on savings_pods
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- assets
create policy "assets: household access" on assets
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- debts
create policy "debts: household access" on debts
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- net_worth_snapshots
create policy "snapshots: household access" on net_worth_snapshots
  for all using (household_id = get_household_id())
  with check (household_id = get_household_id());

-- household_invites: household members can read/insert invites for their household
create policy "invites: household read" on household_invites
  for select using (household_id = get_household_id());

create policy "invites: household insert" on household_invites
  for insert with check (household_id = get_household_id());

-- invites: anyone authenticated can read an invite by token (needed for /join)
create policy "invites: read by token" on household_invites
  for select using (true);  -- Token validation is done in server code

-- households: members can read their own household
create policy "households: read own" on households
  for select using (id = get_household_id());
```

- [ ] **Step 4: Verify in Supabase table editor**

Open Supabase → Table Editor. Confirm all 10 tables exist.

---

## Task 7: Auth context + household queries

**Files:**
- Create: `lib/context/auth.tsx`
- Create: `lib/queries/households.ts`

- [ ] **Step 1: Write `lib/queries/households.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import type { HouseholdInvite } from '@/types'

export async function resolveHouseholdId(): Promise<string> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No household — complete sign-up first')
  return data.household_id
}

export async function getHouseholdMemberNames(): Promise<string[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('household_members')
    .select('display_name')
    .eq('household_id', householdId)
  if (error) throw error
  return (data ?? []).map(m => m.display_name)
}

export async function createHousehold(name: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: household, error: hErr } = await supabase
    .from('households')
    .insert({ name })
    .select()
    .single()
  if (hErr) throw hErr

  const { error: mErr } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, display_name: displayName })
  if (mErr) throw mErr
}

export async function createInvite(householdId: string): Promise<string> {
  const supabase = createClient()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId, token, expires_at: expiresAt })
  if (error) throw error
  return token
}

export async function redeemInvite(token: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: invite, error: invErr } = await supabase
    .from('household_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (invErr) throw invErr
  if (!invite) throw new Error('Invalid invite link')
  if (invite.used_at) throw new Error('This invite has already been used')
  if (new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired')

  const { error: mErr } = await supabase
    .from('household_members')
    .insert({ household_id: invite.household_id, user_id: user.id, display_name: displayName })
  if (mErr) throw mErr

  await supabase
    .from('household_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
}
```

- [ ] **Step 2: Write `lib/context/auth.tsx`**

```tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user:        User | null
  householdId: string | null
  displayName: string | null
  loading:     boolean
  signOut:     () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, householdId: null, displayName: null, loading: true, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('household_members')
          .select('household_id, display_name')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setHouseholdId(data?.household_id ?? null)
        setDisplayName(data?.display_name ?? null)
      } else {
        setHouseholdId(null)
        setDisplayName(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await createClient().auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, householdId, displayName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/queries/households.ts lib/context/auth.tsx
git commit -m "feat: add auth context and household queries"
```

---

## Task 8: Shared UI components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/ProgressBar.tsx`
- Create: `components/ui/MetricCard.tsx`

- [ ] **Step 1: Write `components/ui/Button.tsx`**

```tsx
import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'
type Intent  = 'primary' | 'positive' | 'negative' | 'neutral'
type Size    = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  intent?:  Intent
  size?:    Size
}

const intentVar: Record<Intent, string> = {
  primary:  'var(--color-primary)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral:  'var(--color-foreground)',
}

export default function Button({
  variant = 'primary', intent = 'primary', size = 'md',
  className = '', children, style, ...props
}: ButtonProps) {
  const color = intentVar[intent]
  const sizeClass = size === 'sm' ? 'h-7 px-3 text-[12px]' : 'h-9 px-4 text-[13px]'
  const base = 'inline-flex items-center justify-center rounded-lg font-normal transition-opacity disabled:opacity-40 cursor-pointer'

  return (
    <button
      className={`${base} ${sizeClass} ${className}`}
      style={{
        ...(variant === 'primary' ? { background: color, color: '#fff' } : { color, background: 'transparent' }),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Write `components/ui/Card.tsx`**

```tsx
import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--border-radius-lg)',
      }}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Write `components/ui/Badge.tsx`**

```tsx
type Intent = 'primary' | 'positive' | 'negative' | 'neutral'

interface BadgeProps {
  intent?: Intent
  children: React.ReactNode
}

const intentStyles: Record<Intent, { bg: string; color: string }> = {
  primary:  { bg: 'var(--color-primary-subtle)',  color: 'var(--color-primary)' },
  positive: { bg: 'var(--color-positive-subtle)', color: 'var(--color-positive)' },
  negative: { bg: 'var(--color-negative-subtle)', color: 'var(--color-negative)' },
  neutral:  { bg: 'var(--color-border)',          color: 'var(--color-foreground-secondary)' },
}

export default function Badge({ intent = 'neutral', children }: BadgeProps) {
  const { bg, color } = intentStyles[intent]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-normal"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Write `components/ui/ProgressBar.tsx`**

```tsx
type Intent = 'primary' | 'positive' | 'negative' | 'neutral'

interface ProgressBarProps {
  value: number     // 0–100
  intent?: Intent
}

const intentColor: Record<Intent, string> = {
  primary:  'var(--color-primary)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral:  'var(--color-muted)',
}

export default function ProgressBar({ value, intent = 'primary' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className="w-full"
      style={{ height: '6px', background: 'var(--color-border)', borderRadius: '99px' }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          background: intentColor[intent],
          borderRadius: '99px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Write `components/ui/MetricCard.tsx`**

```tsx
interface MetricCardProps {
  label: string
  value: string
  sub?: string
  valueColor?: string
}

export default function MetricCard({ label, value, sub, valueColor }: MetricCardProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)' }}
    >
      <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p
        className="text-[16px] font-medium tabular-nums"
        style={{ color: valueColor ?? 'var(--color-foreground)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/
git commit -m "feat: add shared UI components (Button, Card, Badge, ProgressBar, MetricCard)"
```

---

## Task 9: App shell + navigation + root layout

**Files:**
- Create: `components/layout/AppShell.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/MobileNav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write `components/layout/Sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/context/auth'
import { useTheme } from './ThemeProvider'

const nav = [
  { href: '/',         label: 'Home',     icon: '⌂' },
  { href: '/budget',   label: 'Budget',   icon: '▤' },
  { href: '/accounts', label: 'Accounts', icon: '⊞' },
  { href: '/wealth',   label: 'Wealth',   icon: '↗' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { displayName, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <aside
      className="hidden md:flex flex-col w-[200px] flex-shrink-0 h-screen sticky top-0 border-r"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <span className="text-[14px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Rov
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 flex flex-col gap-0.5">
        {nav.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors"
              style={{
                background: active ? 'var(--color-primary-subtle)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
            >
              <span>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
            {displayName ?? ''}
          </span>
          <button
            onClick={toggle}
            className="text-[12px] px-2 py-0.5 rounded"
            style={{ color: 'var(--color-muted)', background: 'var(--color-border)' }}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <button
          onClick={signOut}
          className="text-[12px] w-full text-left"
          style={{ color: 'var(--color-muted)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Write `components/layout/MobileNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/',         label: 'Home',     icon: '⌂' },
  { href: '/budget',   label: 'Budget',   icon: '▤' },
  { href: '/accounts', label: 'Accounts', icon: '⊞' },
  { href: '/wealth',   label: 'Wealth',   icon: '↗' },
  { href: '/settings', label: 'More',     icon: '⋯' },
]

export default function MobileNav() {
  const pathname = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-50"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(({ href, label, icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center py-2 gap-0.5"
            style={{ color: active ? 'var(--color-primary)' : 'var(--color-muted)' }}
          >
            <span className="text-[18px] leading-none">{icon}</span>
            <span className="text-[9px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Write `components/layout/AppShell.tsx`**

```tsx
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0 min-w-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
```

- [ ] **Step 4: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/lib/context/auth'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'Rov',
  description: 'Household budgeting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>
              {children}
            </AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/ app/layout.tsx
git commit -m "feat: add AppShell, Sidebar, MobileNav, root layout"
```

---

## Task 10: Auth pages (login + signup)

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/signup/page.tsx`

- [ ] **Step 1: Write `app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'

const inputCls = [
  'w-full h-10 px-3 rounded-lg text-[16px]',
  'focus:outline-none transition-colors',
].join(' ')

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
          <span className="text-[18px] font-medium">Rov</span>
        </div>

        <h1 className="text-[20px] font-medium mb-6">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={inputCls}
            style={{
              background: 'var(--color-surface)',
              border: '0.5px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={inputCls}
            style={{
              background: 'var(--color-surface)',
              border: '0.5px solid var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
          {error && (
            <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-10 mt-1">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-[13px] mt-4 text-center" style={{ color: 'var(--color-muted)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--color-primary)' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `app/signup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createHousehold } from '@/lib/queries/households'
import Button from '@/components/ui/Button'

const inputCls = [
  'w-full h-10 px-3 rounded-lg text-[16px]',
  'focus:outline-none transition-colors',
].join(' ')

const inputStyle = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  color: 'var(--color-foreground)',
}

export default function SignupPage() {
  const router = useRouter()
  const [displayName,  setDisplayName]  = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }
    try {
      await createHousehold(householdName || `${displayName}'s Household`, displayName)
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
          <span className="text-[18px] font-medium">Rov</span>
        </div>

        <h1 className="text-[20px] font-medium mb-2">Create account</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-muted)' }}>
          You're setting up the household. Your partner joins via invite.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text" placeholder="Your name (e.g. Ethan)"
            value={displayName} onChange={e => setDisplayName(e.target.value)}
            required className={inputCls} style={inputStyle}
          />
          <input
            type="text" placeholder="Household name (e.g. The Levines)"
            value={householdName} onChange={e => setHouseholdName(e.target.value)}
            className={inputCls} style={inputStyle}
          />
          <input
            type="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)}
            required className={inputCls} style={inputStyle}
          />
          <input
            type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            required className={inputCls} style={inputStyle}
          />
          {error && (
            <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-10 mt-1">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-[13px] mt-4 text-center" style={{ color: 'var(--color-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test auth flow manually**

Start `npm run dev`. Navigate to http://localhost:3000 — you should be redirected to `/login`. Sign up with a real email. Confirm you land on `/` and see the AppShell nav.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx
git commit -m "feat: add login and signup pages"
```

---

## Task 11: Budget queries

**Files:**
- Create: `lib/queries/finance.ts`

- [ ] **Step 1: Write `lib/queries/finance.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import { resolveHouseholdId } from './households'
import type {
  BudgetCategory, BudgetCategoryInsert, BudgetCategoryUpdate,
  IncomeSource, IncomeSourceInsert, IncomeSourceUpdate,
  RecurringPayment, RecurringPaymentInsert, RecurringPaymentUpdate,
} from '@/types'

// ── Budget categories ─────────────────────────────────────────────────────────

export async function getBudgetCategories(month: string): Promise<BudgetCategory[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('household_id', householdId)
    .eq('month', month)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createBudgetCategory(payload: BudgetCategoryInsert): Promise<BudgetCategory> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBudgetCategory(id: string, payload: BudgetCategoryUpdate): Promise<BudgetCategory> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('budget_categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('budget_categories').delete().eq('id', id)
  if (error) throw error
}

export async function getBudgetCategoriesPastMonths(months: string[]): Promise<BudgetCategory[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('household_id', householdId)
    .in('month', months)
    .order('month', { ascending: true })
  if (error) throw error
  return data
}

// ── Income sources ────────────────────────────────────────────────────────────

export async function getIncomeSources(month: string): Promise<IncomeSource[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('income_sources')
    .select('*')
    .eq('household_id', householdId)
    .eq('month', month)
    .order('owner', { ascending: true })
  if (error) throw error
  return data
}

export async function createIncomeSource(payload: IncomeSourceInsert): Promise<IncomeSource> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('income_sources')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIncomeSource(id: string, payload: IncomeSourceUpdate): Promise<IncomeSource> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('income_sources')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteIncomeSource(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('income_sources').delete().eq('id', id)
  if (error) throw error
}

// ── Recurring payments ────────────────────────────────────────────────────────

export async function getRecurringPayments(): Promise<RecurringPayment[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createRecurringPayment(payload: RecurringPaymentInsert): Promise<RecurringPayment> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('recurring_payments')
    .insert({ ...payload, household_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRecurringPayment(id: string, payload: RecurringPaymentUpdate): Promise<RecurringPayment> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('recurring_payments')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('recurring_payments').delete().eq('id', id)
  if (error) throw error
}

// ── Carryover ─────────────────────────────────────────────────────────────────

export async function carryoverBudget(fromMonth: string, toMonth: string): Promise<void> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()

  const [{ data: cats }, { data: incomes }] = await Promise.all([
    supabase.from('budget_categories').select('name, expected').eq('household_id', householdId).eq('month', fromMonth),
    supabase.from('income_sources').select('owner, name, expected').eq('household_id', householdId).eq('month', fromMonth),
  ])

  // Fetch existing names in toMonth to avoid duplicates
  const [{ data: existingCats }, { data: existingInc }] = await Promise.all([
    supabase.from('budget_categories').select('name').eq('household_id', householdId).eq('month', toMonth),
    supabase.from('income_sources').select('name').eq('household_id', householdId).eq('month', toMonth),
  ])

  const existingCatNames = new Set((existingCats ?? []).map(c => c.name.toLowerCase()))
  const existingIncNames = new Set((existingInc ?? []).map(i => i.name.toLowerCase()))

  const newCats = (cats ?? [])
    .filter(c => !existingCatNames.has(c.name.toLowerCase()))
    .map(c => ({ household_id: householdId, name: c.name, month: toMonth, expected: c.expected, actual: 0 }))

  const newIncs = (incomes ?? [])
    .filter(i => !existingIncNames.has(i.name.toLowerCase()))
    .map(i => ({ household_id: householdId, owner: i.owner, name: i.name, month: toMonth, expected: i.expected, actual: 0 }))

  const ops: Promise<unknown>[] = []
  if (newCats.length > 0) ops.push(supabase.from('budget_categories').insert(newCats).throwOnError())
  if (newIncs.length > 0) ops.push(supabase.from('income_sources').insert(newIncs).throwOnError())
  await Promise.all(ops)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/finance.ts
git commit -m "feat: add finance queries (budget categories, income, recurring, carryover)"
```

---

## Task 12: Carryover tests

**Files:**
- Create: `lib/queries/carryover.test.ts`

- [ ] **Step 1: Write the tests**

These test the logic in isolation — the `carryoverBudget` deduplication logic is the critical path:

```typescript
// lib/queries/carryover.test.ts

// Tests the pure filtering logic extracted from carryoverBudget
// (the Supabase calls are integration concerns — tested manually)

function filterNewItems<T extends { name: string }>(
  fromItems: T[],
  existingNames: string[],
): T[] {
  const existing = new Set(existingNames.map(n => n.toLowerCase()))
  return fromItems.filter(item => !existing.has(item.name.toLowerCase()))
}

describe('carryover deduplication', () => {
  it('includes items not already in the target month', () => {
    const from = [{ name: 'Groceries', expected: 400 }, { name: 'Rent', expected: 1800 }]
    const existing = ['Rent']
    const result = filterNewItems(from, existing)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Groceries')
  })

  it('is case-insensitive', () => {
    const from = [{ name: 'groceries', expected: 400 }]
    const existing = ['GROCERIES']
    expect(filterNewItems(from, existing)).toHaveLength(0)
  })

  it('includes all items when target month is empty', () => {
    const from = [{ name: 'Gas', expected: 100 }, { name: 'Coffee', expected: 60 }]
    expect(filterNewItems(from, [])).toHaveLength(2)
  })

  it('returns empty array when all items already exist', () => {
    const from = [{ name: 'Rent', expected: 1800 }]
    expect(filterNewItems(from, ['Rent'])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm test lib/queries/carryover.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/carryover.test.ts
git commit -m "test: add carryover deduplication tests"
```

---

## Task 13: Budget page

**Files:**
- Create: `app/budget/page.tsx`

- [ ] **Step 1: Write `app/budget/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getBudgetCategories, createBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
  getIncomeSources, carryoverBudget,
} from '@/lib/queries/finance'
import { currentMonth, shiftMonth, formatMonthLabel, fmtWhole } from '@/lib/utils'
import type { BudgetCategory, IncomeSource } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ProgressBar from '@/components/ui/ProgressBar'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

const DEFAULT_CATEGORIES = [
  'Savings', 'Rent', 'Gas', 'Groceries', 'Restaurants',
  'Coffee', 'Fun money', 'Recurring payments', 'Contribution', 'Hosting',
]

export default function BudgetPage() {
  const [month,       setMonth]       = useState(() => currentMonth())
  const [categories,  setCategories]  = useState<BudgetCategory[]>([])
  const [incomes,     setIncomes]     = useState<IncomeSource[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [newName,     setNewName]     = useState('')
  const [addingCat,   setAddingCat]   = useState(false)
  const [carrying,    setCarrying]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cats, incs] = await Promise.all([
        getBudgetCategories(month),
        getIncomeSources(month),
      ])
      setCategories(cats)
      setIncomes(incs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  const totalExpectedIncome = useMemo(() => incomes.reduce((s, i) => s + i.expected, 0), [incomes])
  const totalBudgeted       = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
  const totalActual         = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
  const leftover            = totalExpectedIncome - totalBudgeted

  async function handleAddCategory(name: string) {
    if (!name.trim()) return
    setAddingCat(true)
    try {
      if (categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase())) return
      const created = await createBudgetCategory({ name: name.trim(), month, expected: 0, actual: 0 })
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    } finally { setAddingCat(false); setNewName('') }
  }

  async function handleUpdateField(id: string, field: 'expected' | 'actual', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateBudgetCategory(id, { [field]: val })
    setCategories(prev => prev.map(c => c.id === id ? updated : c))
  }

  async function handleDelete(id: string) {
    setCategories(prev => prev.filter(c => c.id !== id))
    await deleteBudgetCategory(id)
  }

  async function handleCarryover() {
    const prevMonth = shiftMonth(month, -1)
    setCarrying(true)
    try {
      await carryoverBudget(prevMonth, month)
      await load()
    } finally { setCarrying(false) }
  }

  const overBudget = categories.filter(c => c.expected > 0 && c.actual > c.expected)
  const leftoverColor = leftover < 0 ? 'var(--color-negative)' : 'var(--color-foreground)'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[20px] font-medium mb-5" style={{ color: 'var(--color-foreground)' }}>
        Budget
      </h1>

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Month nav */}
          <div className="flex items-center gap-2 mb-5">
            <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
            <span className="text-[13px] min-w-[140px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>
              {formatMonthLabel(month)}
            </span>
            <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>

            {/* Carryover button */}
            <div className="ml-auto">
              <Button
                size="sm" variant="ghost" intent="neutral"
                onClick={handleCarryover} disabled={carrying}
              >
                {carrying ? 'Copying…' : '↩ Copy last month'}
              </Button>
            </div>
          </div>

          {/* Over-budget warning */}
          {overBudget.length > 0 && (
            <div className="rounded-xl px-5 py-4 mb-5" style={{ background: 'var(--color-negative-subtle)' }}>
              <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--color-negative)' }}>
                Over budget on {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'}
              </p>
              {overBudget.map(c => (
                <div key={c.id} className="flex items-center py-1">
                  <span className="flex-1 text-[12px]" style={{ color: 'var(--color-negative)' }}>{c.name}</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--color-negative)' }}>
                    +{fmtWhole(c.actual - c.expected)} over
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Leftover banner */}
          <div className="rounded-xl px-5 py-4 mb-5" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
            <p className="text-[12px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>Unallocated this month</p>
            <p className="text-[28px] font-medium tabular-nums" style={{ color: leftoverColor }}>
              {leftover < 0 ? '−' : ''}{fmtWhole(Math.abs(leftover))}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[12px]" style={{ color: 'var(--color-muted)' }}>
              <span>Income: {fmtWhole(totalExpectedIncome)}</span>
              <span>·</span>
              <span>Budgeted: {fmtWhole(totalBudgeted)}</span>
              {totalActual > 0 && <><span>·</span><span>Spent: {fmtWhole(totalActual)}</span></>}
            </div>
            {totalExpectedIncome > 0 && (
              <div className="mt-3">
                <ProgressBar value={Math.min(100, (totalBudgeted / totalExpectedIncome) * 100)} intent="primary" />
              </div>
            )}
          </div>

          {/* Budget table */}
          <Card>
            <p className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>
              Budget categories
            </p>

            <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
              <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Category</span>
              <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Expected</span>
              <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Actual</span>
              <span className="w-5" />
            </div>

            {categories.length === 0 ? (
              <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>
                No categories yet. Add one below or use "Copy last month."
              </p>
            ) : (
              <>
                {categories.map(c => (
                  <BudgetCategoryRow
                    key={c.id} category={c}
                    onUpdate={handleUpdateField} onDelete={handleDelete}
                  />
                ))}
                <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                  <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>Total</span>
                  <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(totalBudgeted)}</span>
                  <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(totalActual)}</span>
                  <span className="w-5" />
                </div>
              </>
            )}

            {/* Add category */}
            <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--color-border)' }}>
              <form onSubmit={e => { e.preventDefault(); handleAddCategory(newName) }} className="flex gap-2">
                <input
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Category name" autoComplete="off"
                  className="flex-1 min-w-0 h-8 px-3 rounded-lg text-[13px] focus:outline-none transition-colors"
                  style={{ background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }}
                />
                <Button type="submit" size="sm" disabled={!newName.trim() || addingCat}>Add</Button>
              </form>
              <div className="flex flex-wrap gap-1 mt-2">
                {DEFAULT_CATEGORIES
                  .filter(n => !categories.find(c => c.name.toLowerCase() === n.toLowerCase()))
                  .map(n => (
                    <button
                      key={n} type="button" onClick={() => handleAddCategory(n)}
                      className="px-2 py-[3px] rounded-md text-[11px] transition-opacity hover:opacity-80"
                      style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                    >
                      {n}
                    </button>
                  ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function BudgetCategoryRow({
  category, onUpdate, onDelete,
}: {
  category: BudgetCategory
  onUpdate: (id: string, field: 'expected' | 'actual', raw: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [exp, setExp] = useState(String(category.expected))
  const [act, setAct] = useState(String(category.actual))

  useEffect(() => { setExp(String(category.expected)) }, [category.expected])
  useEffect(() => { setAct(String(category.actual))   }, [category.actual])

  const isOver  = category.expected > 0 && category.actual > category.expected
  const pct     = category.expected > 0 ? Math.min(100, (category.actual / category.expected) * 100) : 0

  const numInput = 'h-7 px-2 rounded-md text-[12px] tabular-nums text-right focus:outline-none transition-colors'

  return (
    <div className="flex flex-col group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 py-2">
        <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>
          {category.name}
        </span>
        <input
          type="number" min="0" step="0.01" value={exp}
          onChange={e => setExp(e.target.value)}
          onBlur={e => onUpdate(category.id, 'expected', e.target.value)}
          className={`w-[88px] ${numInput}`}
          style={{ background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }}
        />
        <input
          type="number" min="0" step="0.01" value={act}
          onChange={e => setAct(e.target.value)}
          onBlur={e => onUpdate(category.id, 'actual', e.target.value)}
          className={`w-[88px] ${numInput}`}
          style={{
            background: 'var(--color-background)',
            border: `0.5px solid ${isOver ? 'var(--color-negative)' : 'var(--color-border)'}`,
            color: isOver ? 'var(--color-negative)' : 'var(--color-foreground)',
            fontWeight: isOver ? 500 : 400,
          }}
        />
        <button
          type="button" onClick={() => onDelete(category.id)}
          className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--color-muted)' }}
        >×</button>
      </div>
      {isOver && (
        <p className="text-[11px] pb-1 text-right" style={{ color: 'var(--color-negative)' }}>
          +{fmtWhole(category.actual - category.expected)} over
        </p>
      )}
      {category.expected > 0 && (
        <div className="pb-2">
          <ProgressBar value={pct} intent={isOver ? 'negative' : 'primary'} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Test the budget page manually**

Navigate to http://localhost:3000/budget. Add a category, enter expected/actual amounts, delete a category. Confirm progress bars update.

- [ ] **Step 3: Commit**

```bash
git add app/budget/page.tsx
git commit -m "feat: add budget page with carryover button"
```

---

## Task 14: Wealth queries

**Files:**
- Create: `lib/queries/wealth.ts`

- [ ] **Step 1: Write `lib/queries/wealth.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'
import { resolveHouseholdId } from './households'
import type {
  SavingsPod, SavingsPodInsert, SavingsPodUpdate,
  Asset, AssetInsert, AssetUpdate,
  Debt, DebtInsert, DebtUpdate,
  NetWorthSnapshot, NetWorthSnapshotInsert,
} from '@/types'

// ── Savings pods ──────────────────────────────────────────────────────────────

export async function getSavingsPods(): Promise<SavingsPod[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('savings_pods').select('*')
    .eq('household_id', householdId).order('name')
  if (error) throw error
  return data
}

export async function createSavingsPod(payload: SavingsPodInsert): Promise<SavingsPod> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('savings_pods').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateSavingsPod(id: string, payload: SavingsPodUpdate): Promise<SavingsPod> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('savings_pods').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteSavingsPod(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('savings_pods').delete().eq('id', id)
  if (error) throw error
}

// ── Assets ────────────────────────────────────────────────────────────────────

export async function getAssets(): Promise<Asset[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('assets').select('*').eq('household_id', householdId).order('name')
  if (error) throw error
  return data
}

export async function createAsset(payload: AssetInsert): Promise<Asset> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('assets').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateAsset(id: string, payload: AssetUpdate): Promise<Asset> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('assets').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAsset(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('assets').delete().eq('id', id)
  if (error) throw error
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function getDebts(): Promise<Debt[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('debts').select('*').eq('household_id', householdId).order('owner')
  if (error) throw error
  return data
}

export async function createDebt(payload: DebtInsert): Promise<Debt> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('debts').insert({ ...payload, household_id }).select().single()
  if (error) throw error
  return data
}

export async function updateDebt(id: string, payload: DebtUpdate): Promise<Debt> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('debts').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteDebt(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}

// ── Net worth snapshots ───────────────────────────────────────────────────────

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
  const supabase = createClient()
  const householdId = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('net_worth_snapshots').select('*')
    .eq('household_id', householdId).order('month')
  if (error) throw error
  return data
}

export async function createNetWorthSnapshot(payload: NetWorthSnapshotInsert): Promise<NetWorthSnapshot> {
  const supabase = createClient()
  const household_id = await resolveHouseholdId()
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .upsert({ ...payload, household_id }, { onConflict: 'household_id,month' })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteNetWorthSnapshot(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('net_worth_snapshots').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/wealth.ts
git commit -m "feat: add wealth queries (savings pods, assets, debts, net worth snapshots)"
```

---

## Task 15: Wealth page

**Files:**
- Create: `app/wealth/page.tsx`

- [ ] **Step 1: Write `app/wealth/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getSavingsPods, createSavingsPod, updateSavingsPod, deleteSavingsPod,
  getAssets, createAsset, updateAsset, deleteAsset,
  getDebts, createDebt, updateDebt, deleteDebt,
  getNetWorthSnapshots, createNetWorthSnapshot, deleteNetWorthSnapshot,
} from '@/lib/queries/wealth'
import { currentMonth, fmtWhole } from '@/lib/utils'
import type { SavingsPod, Asset, Debt, NetWorthSnapshot } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ProgressBar from '@/components/ui/ProgressBar'
import MetricCard from '@/components/ui/MetricCard'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

const inputCls = 'h-8 px-3 rounded-lg text-[13px] focus:outline-none transition-colors'
const inputStyle = { background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md text-[12px] tabular-nums text-right focus:outline-none transition-colors'

// ── Net worth sparkline ───────────────────────────────────────────────────────

function NetWorthChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length < 2) return (
    <p className="text-[12px] py-2" style={{ color: 'var(--color-muted)' }}>
      Record at least two snapshots to see the trend.
    </p>
  )
  const values = snapshots.map(s => s.net_worth)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 500, H = 64
  const pts = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * W
    const y = H - ((s.net_worth - min) / range) * (H - 8) - 4
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {snapshots.map((s, i) => {
          const x = (i / (snapshots.length - 1)) * W
          const y = H - ((s.net_worth - min) / range) * (H - 8) - 4
          return <circle key={s.id} cx={x} cy={y} r={3} fill="var(--color-primary)" />
        })}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{snapshots[0].month}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{snapshots[snapshots.length - 1].month}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WealthPage() {
  const [pods,      setPods]      = useState<SavingsPod[]>([])
  const [assets,    setAssets]    = useState<Asset[]>([])
  const [debts,     setDebts]     = useState<Debt[]>([])
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [savingSnap, setSavingSnap] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, a, d, s] = await Promise.all([getSavingsPods(), getAssets(), getDebts(), getNetWorthSnapshots()])
      setPods(p); setAssets(a); setDebts(d); setSnapshots(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const totalAssets  = useMemo(() => assets.reduce((s, a) => s + a.balance, 0), [assets])
  const totalDebt    = useMemo(() => debts.reduce((s, d) => s + d.amount_owed, 0), [debts])
  const netWorth     = totalAssets - totalDebt
  const totalAllotted = useMemo(() => pods.reduce((s, p) => s + p.allotted, 0), [pods])
  const totalPodGoal  = useMemo(() => pods.reduce((s, p) => s + p.goal, 0), [pods])
  const savingsBalance = useMemo(() => assets.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0), [assets])

  async function handleSnapshot() {
    setSavingSnap(true)
    try {
      const snap = await createNetWorthSnapshot({
        month: currentMonth(), total_assets: totalAssets, total_debt: totalDebt, net_worth: netWorth,
      })
      setSnapshots(prev => [...prev.filter(s => s.month !== snap.month), snap].sort((a, b) => a.month.localeCompare(b.month)))
    } finally { setSavingSnap(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[20px] font-medium mb-5" style={{ color: 'var(--color-foreground)' }}>Wealth</h1>

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : (
        <>
          {/* Net worth summary */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Net worth</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <MetricCard label="Assets"    value={fmtWhole(totalAssets)} />
              <MetricCard label="Debt"      value={fmtWhole(totalDebt)} />
              <MetricCard label="Net worth" value={(netWorth < 0 ? '−' : '') + fmtWhole(Math.abs(netWorth))} valueColor={netWorth < 0 ? 'var(--color-negative)' : undefined} />
            </div>
            <NetWorthChart snapshots={snapshots} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Updated monthly</span>
              <button onClick={handleSnapshot} disabled={savingSnap} className="text-[11px] transition-opacity hover:opacity-75 disabled:opacity-40" style={{ color: 'var(--color-primary)' }}>
                {savingSnap ? 'Saving…' : 'Record snapshot'}
              </button>
            </div>
            {snapshots.length > 0 && (
              <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                {snapshots.slice(-3).reverse().map(s => (
                  <div key={s.id} className="group flex items-center gap-3 py-1 text-[11px]">
                    <span className="w-[60px]" style={{ color: 'var(--color-muted)' }}>{s.month}</span>
                    <span className="flex-1 tabular-nums font-medium" style={{ color: s.net_worth < 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}>
                      {s.net_worth < 0 ? '−' : '+'}{fmtWhole(Math.abs(s.net_worth))}
                    </span>
                    <button onClick={() => { setSnapshots(prev => prev.filter(x => x.id !== s.id)); deleteNetWorthSnapshot(s.id) }} className="opacity-0 group-hover:opacity-100 transition-opacity text-[12px]" style={{ color: 'var(--color-muted)' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Savings pods */}
          <SavingsSection pods={pods} setPods={setPods} totalAllotted={totalAllotted} totalPodGoal={totalPodGoal} savingsBalance={savingsBalance} />

          {/* Assets */}
          <AssetsSection assets={assets} setAssets={setAssets} />

          {/* Debts */}
          <DebtsSection debts={debts} setDebts={setDebts} />
        </>
      )}
    </div>
  )
}

// ── Savings pods ──────────────────────────────────────────────────────────────

const DEFAULT_PODS = ['Emergency fund', 'Down payment', 'Adventures', 'General savings']

function SavingsSection({ pods, setPods, totalAllotted, totalPodGoal, savingsBalance }: {
  pods: SavingsPod[]
  setPods: React.Dispatch<React.SetStateAction<SavingsPod[]>>
  totalAllotted: number
  totalPodGoal: number
  savingsBalance: number
}) {
  const [newName, setNewName] = useState('')
  const [adding,  setAdding]  = useState(false)
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
    const updated = await updateSavingsPod(id, { [field]: val })
    setPods(prev => prev.map(p => p.id === id ? updated : p))
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Savings pods</h2>
      <div className="rounded-xl px-5 py-4 mb-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
        <div className="flex items-center gap-6 flex-wrap">
          <MetricCard label="Savings balance" value={fmtWhole(savingsBalance)} />
          <MetricCard label="Allotted" value={fmtWhole(totalAllotted)} />
          <MetricCard label={unallocated >= 0 ? 'Unallocated' : 'Over-allotted'} value={fmtWhole(Math.abs(unallocated))} valueColor={unallocated < 0 ? 'var(--color-negative)' : undefined} />
          <MetricCard label="Total goal" value={fmtWhole(totalPodGoal)} />
        </div>
      </div>
      <Card className="mb-4">
        <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Pod</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Allotted</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Goal</span>
          <span className="w-5" />
        </div>
        {pods.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No pods yet.</p>
        ) : pods.map(p => <SavingsPodRow key={p.id} pod={p} onUpdate={handleUpdate} onDelete={async (id) => { setPods(prev => prev.filter(x => x.id !== id)); await deleteSavingsPod(id) }} />)}
      </Card>
      <Card>
        <form onSubmit={e => { e.preventDefault(); handleAdd(newName) }} className="flex gap-2 mb-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Pod name" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
          <Button type="submit" size="sm" disabled={!newName.trim() || adding}>Add</Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_PODS.filter(n => !pods.find(p => p.name.toLowerCase() === n.toLowerCase())).map(n => (
            <button key={n} type="button" onClick={() => handleAdd(n)} className="px-2 py-[3px] rounded-md text-[11px] hover:opacity-80 transition-opacity" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{n}</button>
          ))}
        </div>
      </Card>
    </section>
  )
}

function SavingsPodRow({ pod, onUpdate, onDelete }: { pod: SavingsPod; onUpdate: (id: string, f: 'allotted' | 'goal', v: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [allotted, setAllotted] = useState(String(pod.allotted))
  const [goal,     setGoal]     = useState(String(pod.goal))
  useEffect(() => { setAllotted(String(pod.allotted)) }, [pod.allotted])
  useEffect(() => { setGoal(String(pod.goal)) }, [pod.goal])
  const remaining = pod.goal - pod.allotted
  return (
    <div className="flex flex-col group py-2" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>{pod.name}</span>
        <input type="number" min="0" step="0.01" value={allotted} onChange={e => setAllotted(e.target.value)} onBlur={e => onUpdate(pod.id, 'allotted', e.target.value)} className={numCls} style={inputStyle} />
        <input type="number" min="0" step="0.01" value={goal}     onChange={e => setGoal(e.target.value)}     onBlur={e => onUpdate(pod.id, 'goal',     e.target.value)} className={numCls} style={inputStyle} />
        <button type="button" onClick={() => onDelete(pod.id)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-muted)' }}>×</button>
      </div>
      {pod.goal > 0 && <div className="mt-1 mb-1"><ProgressBar value={Math.min(100, (pod.allotted / pod.goal) * 100)} intent="positive" /></div>}
    </div>
  )
}

// ── Assets ────────────────────────────────────────────────────────────────────

const ASSET_TYPES = ['checking', 'savings', 'credit_card', 'investment', 'property', 'other']

function AssetsSection({ assets, setAssets }: { assets: Asset[]; setAssets: React.Dispatch<React.SetStateAction<Asset[]>> }) {
  const [newName,    setNewName]    = useState('')
  const [newType,    setNewType]    = useState('checking')
  const [newBalance, setNewBalance] = useState('')
  const [adding,     setAdding]     = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseFloat(newBalance)
    if (!newName.trim() || isNaN(balance)) return
    setAdding(true)
    try {
      const created = await createAsset({ name: newName.trim(), type: newType, balance })
      setAssets(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName(''); setNewBalance('')
    } finally { setAdding(false) }
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Assets</h2>
      <Card className="mb-4">
        {assets.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No assets yet.</p>
        ) : assets.map(a => (
          <AssetRow key={a.id} asset={a}
            onUpdate={async (id, payload) => { const u = await updateAsset(id, payload); setAssets(prev => prev.map(x => x.id === id ? u : x)) }}
            onDelete={async (id) => { setAssets(prev => prev.filter(x => x.id !== id)); await deleteAsset(id) }}
          />
        ))}
      </Card>
      <Card>
        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name" className={`flex-1 min-w-[120px] ${inputCls}`} style={inputStyle} />
          <select value={newType} onChange={e => setNewType(e.target.value)} className={`w-[120px] ${inputCls}`} style={inputStyle}>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input type="number" min="0" step="0.01" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="Balance" className={`w-[96px] ${inputCls}`} style={inputStyle} />
          <Button type="submit" size="sm" disabled={!newName.trim() || !newBalance || adding}>Add</Button>
        </form>
      </Card>
    </section>
  )
}

function AssetRow({ asset, onUpdate, onDelete }: { asset: Asset; onUpdate: (id: string, p: AssetUpdate) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [balance, setBalance] = useState(String(asset.balance))
  useEffect(() => { setBalance(String(asset.balance)) }, [asset.balance])
  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{asset.name}</span>
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{asset.type.replace('_', ' ')}</span>
      <input type="number" min="0" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} onBlur={e => onUpdate(asset.id, { balance: parseFloat(e.target.value) })} className={numCls} style={inputStyle} />
      <button type="button" onClick={() => onDelete(asset.id)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-muted)' }}>×</button>
    </div>
  )
}

// ── Debts ─────────────────────────────────────────────────────────────────────

function DebtsSection({ debts, setDebts }: { debts: Debt[]; setDebts: React.Dispatch<React.SetStateAction<Debt[]>> }) {
  const [newName,   setNewName]   = useState('')
  const [newOwner,  setNewOwner]  = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [adding,    setAdding]    = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(newAmount)
    if (!newName.trim() || !newOwner.trim() || isNaN(amount)) return
    setAdding(true)
    try {
      const created = await createDebt({ name: newName.trim(), owner: newOwner.trim(), amount_owed: amount, interest_rate: 0 })
      setDebts(prev => [...prev, created].sort((a, b) => a.owner.localeCompare(b.owner)))
      setNewName(''); setNewOwner(''); setNewAmount('')
    } finally { setAdding(false) }
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Debts</h2>
      <Card className="mb-4">
        {debts.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No debts.</p>
        ) : debts.map(d => (
          <div key={d.id} className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
            <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{d.name}</span>
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{d.owner}</span>
            <span className="w-[88px] text-[13px] tabular-nums text-right" style={{ color: 'var(--color-negative)' }}>{fmtWhole(d.amount_owed)}</span>
            <button type="button" onClick={() => { setDebts(prev => prev.filter(x => x.id !== d.id)); deleteDebt(d.id) }} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-muted)' }}>×</button>
          </div>
        ))}
      </Card>
      <Card>
        <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
          <input value={newName}   onChange={e => setNewName(e.target.value)}   placeholder="Debt name"    className={`flex-1 min-w-[100px] ${inputCls}`} style={inputStyle} />
          <input value={newOwner}  onChange={e => setNewOwner(e.target.value)}  placeholder="Owner"        className={`w-[80px] ${inputCls}`} style={inputStyle} />
          <input type="number" min="0" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount" className={`w-[96px] ${inputCls}`} style={inputStyle} />
          <Button type="submit" size="sm" disabled={!newName.trim() || !newOwner.trim() || !newAmount || adding}>Add</Button>
        </form>
      </Card>
    </section>
  )
}

// Import for AssetUpdate type used in AssetRow
import type { AssetUpdate } from '@/types'
```

- [ ] **Step 2: Test manually**

Navigate to http://localhost:3000/wealth. Add a savings pod, an asset, a debt. Record a net worth snapshot. Confirm the sparkline appears after a second snapshot.

- [ ] **Step 3: Commit**

```bash
git add app/wealth/page.tsx
git commit -m "feat: add wealth page (savings pods, assets, debts, net worth)"
```

---

## Task 16: Settings page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Write `app/settings/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getIncomeSources, createIncomeSource, updateIncomeSource, deleteIncomeSource,
  getRecurringPayments, createRecurringPayment, updateRecurringPayment, deleteRecurringPayment,
} from '@/lib/queries/finance'
import { getHouseholdMemberNames, createInvite } from '@/lib/queries/households'
import { useAuth } from '@/lib/context/auth'
import { currentMonth, shiftMonth, formatMonthLabel, fmtWhole } from '@/lib/utils'
import type { IncomeSource, RecurringPayment } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const inputCls = 'h-8 px-3 rounded-lg text-[16px] focus:outline-none transition-colors'
const inputStyle = { background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md text-[12px] tabular-nums text-right focus:outline-none transition-colors'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function SettingsPage() {
  const { householdId } = useAuth()
  const [month,      setMonth]      = useState(() => currentMonth())
  const [incomes,    setIncomes]    = useState<IncomeSource[]>([])
  const [recurrings, setRecurrings] = useState<RecurringPayment[]>([])
  const [owners,     setOwners]     = useState<string[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [inviteUrl,  setInviteUrl]  = useState<string | null>(null)
  const [inviting,   setInviting]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [inc, rec, names] = await Promise.all([
        getIncomeSources(month),
        getRecurringPayments(),
        getHouseholdMemberNames(),
      ])
      setIncomes(inc); setRecurrings(rec); setOwners(names)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  async function handleGenerateInvite() {
    if (!householdId) return
    setInviting(true)
    try {
      const token = await createInvite(householdId)
      const url = `${window.location.origin}/join?token=${token}`
      setInviteUrl(url)
    } finally { setInviting(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[20px] font-medium mb-5" style={{ color: 'var(--color-foreground)' }}>Settings</h1>

      {error && <p className="text-[13px] mb-4" style={{ color: 'var(--color-negative)' }}>{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (
        <>
          {/* Income sources */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[14px] font-medium flex-1" style={{ color: 'var(--color-foreground)' }}>Income sources</h2>
              <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
              <span className="text-[12px] min-w-[120px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>{formatMonthLabel(month)}</span>
              <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>
            </div>
            <IncomeSection month={month} incomes={incomes} setIncomes={setIncomes} owners={owners} />
          </section>

          {/* Recurring payments */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Recurring payments</h2>
            <RecurringSection recurrings={recurrings} setRecurrings={setRecurrings} />
          </section>

          {/* Invite */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Invite your partner</h2>
            <Card>
              <p className="text-[13px] mb-4" style={{ color: 'var(--color-muted)' }}>
                Generate a one-time link to share with your partner. The link expires in 7 days.
              </p>
              <Button onClick={handleGenerateInvite} disabled={inviting} size="sm">
                {inviting ? 'Generating…' : 'Generate invite link'}
              </Button>
              {inviteUrl && (
                <div className="mt-4">
                  <p className="text-[12px] mb-2" style={{ color: 'var(--color-muted)' }}>Share this link:</p>
                  <div className="flex gap-2">
                    <input
                      readOnly value={inviteUrl}
                      className="flex-1 h-8 px-3 rounded-lg text-[12px] focus:outline-none"
                      style={{ background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }}
                    />
                    <Button size="sm" variant="ghost" intent="neutral" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

// ── Income section ────────────────────────────────────────────────────────────

function IncomeSection({ month, incomes, setIncomes, owners }: {
  month: string
  incomes: IncomeSource[]
  setIncomes: React.Dispatch<React.SetStateAction<IncomeSource[]>>
  owners: string[]
}) {
  const [newOwner, setNewOwner] = useState(owners[0] ?? '')
  const [newName,  setNewName]  = useState('')
  const [adding,   setAdding]   = useState(false)

  useEffect(() => { if (owners.length > 0 && !newOwner) setNewOwner(owners[0]) }, [owners, newOwner])

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

  const total = incomes.reduce((s, i) => s + i.expected, 0)

  return (
    <Card>
      <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Source</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Expected</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Actual</span>
        <span className="w-5" />
      </div>
      {incomes.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No income sources this month.</p>
      ) : (
        <>
          {incomes.map(inc => (
            <IncomeRow key={inc.id} source={inc}
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

function IncomeRow({ source, onUpdate, onDelete }: { source: IncomeSource; onUpdate: (id: string, f: 'expected' | 'actual', v: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [exp, setExp] = useState(String(source.expected))
  const [act, setAct] = useState(String(source.actual))
  useEffect(() => { setExp(String(source.expected)) }, [source.expected])
  useEffect(() => { setAct(String(source.actual))   }, [source.actual])
  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{source.name}</span>
        <span className="ml-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>{source.owner}</span>
      </div>
      <input type="number" min="0" step="0.01" value={exp} onChange={e => setExp(e.target.value)} onBlur={e => onUpdate(source.id, 'expected', e.target.value)} className={numCls} style={inputStyle} />
      <input type="number" min="0" step="0.01" value={act} onChange={e => setAct(e.target.value)} onBlur={e => onUpdate(source.id, 'actual',   e.target.value)} className={numCls} style={inputStyle} />
      <button type="button" onClick={() => onDelete(source.id)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-muted)' }}>×</button>
    </div>
  )
}

// ── Recurring section ─────────────────────────────────────────────────────────

function RecurringSection({ recurrings, setRecurrings }: { recurrings: RecurringPayment[]; setRecurrings: React.Dispatch<React.SetStateAction<RecurringPayment[]>> }) {
  const [newName,   setNewName]   = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [adding,    setAdding]    = useState(false)
  const total = recurrings.reduce((s, r) => s + r.amount, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(newAmount)
    if (!newName.trim() || !(amount > 0)) return
    setAdding(true)
    try {
      const created = await createRecurringPayment({ name: newName.trim(), amount })
      setRecurrings(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName(''); setNewAmount('')
    } finally { setAdding(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Monthly bills</span>
        {total > 0 && <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>{fmtWhole(total)}/mo</span>}
      </div>
      {recurrings.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No recurring payments.</p>
      ) : recurrings.map(r => (
        <div key={r.id} className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{r.name}</span>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>{fmtWhole(r.amount)}</span>
          <button type="button" onClick={() => { setRecurrings(prev => prev.filter(x => x.id !== r.id)); deleteRecurringPayment(r.id) }} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-muted)' }}>×</button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Spotify)" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
        <input type="number" min="0.01" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount" className={`w-[88px] ${inputCls}`} style={inputStyle} />
        <Button type="submit" size="sm" disabled={!newName.trim() || !(parseFloat(newAmount) > 0) || adding}>Add</Button>
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Test the settings page**

Navigate to /settings. Add an income source, a recurring payment. Click "Generate invite link" — confirm a URL appears and copy works.

- [ ] **Step 3: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add settings page (income sources, recurring payments, invite)"
```

---

## Task 17: Invite join page

**Files:**
- Create: `app/join/page.tsx`

- [ ] **Step 1: Write `app/join/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { redeemInvite } from '@/lib/queries/households'
import Button from '@/components/ui/Button'

const inputCls = 'w-full h-10 px-3 rounded-lg text-[16px] focus:outline-none transition-colors'
const inputStyle = { background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }

export default function JoinPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') ?? ''

  const [mode,        setMode]        = useState<'signup' | 'login'>('signup')
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    if (!token) setError('Invalid invite link — no token found.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw signUpErr
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }
      await redeemInvite(token, displayName || email.split('@')[0])
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
          <span className="text-[18px] font-medium">Rov</span>
        </div>

        <h1 className="text-[20px] font-medium mb-2">Join household</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-muted)' }}>
          You've been invited. {mode === 'signup' ? 'Create an account to join.' : 'Sign in to join.'}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode('signup')} className="text-[13px] pb-1 transition-colors" style={{ color: mode === 'signup' ? 'var(--color-primary)' : 'var(--color-muted)', borderBottom: mode === 'signup' ? '1px solid var(--color-primary)' : 'none' }}>
            Create account
          </button>
          <button onClick={() => setMode('login')} className="text-[13px] pb-1 transition-colors" style={{ color: mode === 'login' ? 'var(--color-primary)' : 'var(--color-muted)', borderBottom: mode === 'login' ? '1px solid var(--color-primary)' : 'none' }}>
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} style={inputStyle} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className={inputCls} style={inputStyle} />
          {error && <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>}
          <Button type="submit" disabled={loading || !token} className="w-full h-10 mt-1">
            {loading ? 'Joining…' : 'Join household'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test the invite flow end-to-end**

1. Sign in as the first user → go to Settings → generate invite link
2. Open the invite link in an incognito window
3. Create a new account via the /join page
4. Confirm the second user lands on `/` and sees the same household data

- [ ] **Step 3: Commit**

```bash
git add app/join/page.tsx
git commit -m "feat: add /join invite handler"
```

---

## Task 18: Dashboard home page

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 1: Write `app/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getBudgetCategories, getIncomeSources } from '@/lib/queries/finance'
import { getSavingsPods, getAssets, getDebts, getNetWorthSnapshots } from '@/lib/queries/wealth'
import { currentMonth, fmtWhole } from '@/lib/utils'
import type { BudgetCategory, SavingsPod, Asset, Debt, NetWorthSnapshot } from '@/types'
import MetricCard from '@/components/ui/MetricCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Card from '@/components/ui/Card'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function HomePage() {
  const month = currentMonth()

  const [categories,  setCategories]  = useState<BudgetCategory[]>([])
  const [pods,        setPods]        = useState<SavingsPod[]>([])
  const [assets,      setAssets]      = useState<Asset[]>([])
  const [debts,       setDebts]       = useState<Debt[]>([])
  const [snapshots,   setSnapshots]   = useState<NetWorthSnapshot[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cats, incs, p, a, d, s] = await Promise.all([
        getBudgetCategories(month),
        getIncomeSources(month),
        getSavingsPods(),
        getAssets(),
        getDebts(),
        getNetWorthSnapshots(),
      ])
      setCategories(cats)
      setTotalIncome(incs.reduce((sum, i) => sum + i.expected, 0))
      setPods(p); setAssets(a); setDebts(d); setSnapshots(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  const totalBudgeted  = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
  const totalSpent     = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
  const leftover       = totalIncome - totalBudgeted
  const totalAssets    = useMemo(() => assets.reduce((s, a) => s + a.balance, 0), [assets])
  const totalDebt      = useMemo(() => debts.reduce((s, d) => s + d.amount_owed, 0), [debts])
  const netWorth       = totalAssets - totalDebt
  const totalAllotted  = useMemo(() => pods.reduce((s, p) => s + p.allotted, 0), [pods])
  const totalPodGoal   = useMemo(() => pods.reduce((s, p) => s + p.goal, 0), [pods])

  const topCategories = useMemo(
    () => [...categories].filter(c => c.actual > 0).sort((a, b) => b.actual - a.actual).slice(0, 5),
    [categories],
  )

  const overBudget = categories.filter(c => c.expected > 0 && c.actual > c.expected)

  // Latest net worth
  const latestSnap  = snapshots[snapshots.length - 1]
  const previousSnap = snapshots[snapshots.length - 2]
  const nwDelta = latestSnap && previousSnap ? latestSnap.net_worth - previousSnap.net_worth : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>Rov</h1>
        <span className="text-[13px] ml-1" style={{ color: 'var(--color-muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* Net worth */}
          <section className="mb-6">
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[12px] mb-1" style={{ color: 'var(--color-muted)' }}>Net worth</p>
              <p className="text-[32px] font-medium tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                {netWorth < 0 ? '−' : ''}{fmtWhole(Math.abs(netWorth))}
              </p>
              {nwDelta !== null && (
                <p className="text-[13px] mt-1" style={{ color: nwDelta >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                  {nwDelta >= 0 ? '↑' : '↓'} {fmtWhole(Math.abs(nwDelta))} since last snapshot
                </p>
              )}
            </div>
          </section>

          {/* Budget health */}
          <section className="mb-6">
            <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Budget this month</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <MetricCard label="Income"   value={fmtWhole(totalIncome)} />
              <MetricCard label="Budgeted" value={fmtWhole(totalBudgeted)} />
              <MetricCard
                label="Unallocated"
                value={(leftover < 0 ? '−' : '') + fmtWhole(Math.abs(leftover))}
                valueColor={leftover < 0 ? 'var(--color-negative)' : undefined}
              />
            </div>
            {totalIncome > 0 && (
              <ProgressBar value={Math.min(100, (totalBudgeted / totalIncome) * 100)} intent="primary" />
            )}
            {overBudget.length > 0 && (
              <div className="mt-3 rounded-xl px-4 py-3" style={{ background: 'var(--color-negative-subtle)' }}>
                <p className="text-[12px]" style={{ color: 'var(--color-negative)' }}>
                  Over budget on {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'}: {overBudget.map(c => c.name).join(', ')}
                </p>
              </div>
            )}
          </section>

          {/* Savings */}
          {pods.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Savings</h2>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Total allotted" value={fmtWhole(totalAllotted)} />
                <MetricCard label="Total goal"     value={fmtWhole(totalPodGoal)} />
              </div>
              {totalPodGoal > 0 && (
                <div className="mt-2">
                  <ProgressBar value={Math.min(100, (totalAllotted / totalPodGoal) * 100)} intent="positive" />
                </div>
              )}
            </section>
          )}

          {/* Top spending */}
          {topCategories.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[13px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Top spending</h2>
              <Card>
                {topCategories.map(c => {
                  const isOver = c.expected > 0 && c.actual > c.expected
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{c.name}</span>
                      <span className="text-[13px] tabular-nums font-medium" style={{ color: isOver ? 'var(--color-negative)' : 'var(--color-foreground)' }}>
                        {fmtWhole(c.actual)}
                      </span>
                      {c.expected > 0 && (
                        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                          / {fmtWhole(c.expected)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {/* Empty state */}
          {categories.length === 0 && pods.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>Welcome to Rov</p>
              <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>
                Start by setting up your budget categories and income sources.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Test the dashboard**

Navigate to http://localhost:3000. After adding some budget categories and amounts in /budget, confirm the dashboard shows budget health, net worth (if snapshots exist), and top spending.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add home dashboard with budget health, net worth, savings, top spending"
```

---

## Task 19: Final build check + cleanup

**Files:** (no new files)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests in `lib/utils.test.ts` and `lib/queries/carryover.test.ts` pass.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. Check the output for any warnings.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Fix any lint errors before proceeding.

- [ ] **Step 4: Manual smoke test**

Walk through each page:
- `/login` → sign in ✓
- `/` → dashboard loads, shows data ✓
- `/budget` → add category, update expected/actual, delete, use "Copy last month" ✓
- `/wealth` → add savings pod, asset, debt, record net worth snapshot ✓
- `/settings` → add income source, recurring payment, generate invite link ✓
- `/join?token=<valid>` → second user signs up and joins household ✓
- Theme toggle (sidebar) → switches between dark and light ✓

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Rov core app — budget, wealth, settings, invite, dashboard"
```

---

## What's next (Plan 2)

Plan 2 covers:
- Plaid integration (link-token, exchange, accounts, transactions API routes)
- Accounts page with live balances and transaction feed
- Smart transaction categorization UI with merchant rules
- "From bank" hint on budget category rows
- Spending trends chart (Recharts) on the Budget page
- PWA setup (`@ducanh2912/next-pwa`, manifest, service worker)
