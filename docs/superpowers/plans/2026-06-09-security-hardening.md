# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified security vulnerabilities in Rov — from missing route protection through to invite race conditions and information leakage.

**Architecture:** Restore middleware for session refresh + route guarding, harden auth checks to verify JWTs server-side, move invite redemption to a server action backed by a Postgres function for atomicity, and add hygiene fixes (CSP headers, remove log leakage).

**Tech Stack:** Next.js 14 App Router, Supabase SSR (`@supabase/ssr`), TypeScript, Tailwind CSS, Supabase MCP for migrations.

---

## Files Touched

| File | Action | Reason |
|---|---|---|
| `middleware.ts` | Create | Was deleted — restores session refresh + route protection |
| `lib/queries/households.ts` | Modify | Replace `getSession()` with `getUser()` on all auth checks |
| `app/actions/invites.ts` | Create | Server action for atomic invite redemption + rate-limit check |
| `app/join/page.tsx` | Modify | Call server action instead of client-side `redeemInvite` |
| `next.config.ts` | Modify | Add Content Security Policy headers |

---

## Task 1: Restore middleware.ts

**Files:**
- Create: `middleware.ts` (project root)

The middleware must: refresh the Supabase session cookie on every request, and redirect unauthenticated users away from protected routes.

- [ ] **Step 1: Create middleware.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/join']

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

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith('/api/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)'],
}
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```

Expected: Server starts, no TypeScript errors in terminal. Visiting `http://localhost:3000/budget` while logged out should redirect to `/login`.

- [ ] **Step 3: Run build to catch type errors**

```bash
npm run build
```

Expected: Compiled successfully, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "fix: restore middleware for session refresh and route protection"
```

---

## Task 2: Replace getSession with getUser in households.ts

**Files:**
- Modify: `lib/queries/households.ts`

`getSession()` trusts the local JWT without server verification. `getUser()` validates against Supabase servers. Three callsites need updating: `resolveHouseholdId`, `createHousehold`, and `redeemInvite`.

Also strip the `console.log` calls from `resolveHouseholdId` — they leak truncated user IDs to anyone with DevTools open.

- [ ] **Step 1: Update resolveHouseholdId — replace getSession with getUser, remove console.logs**

Replace the entire `resolveHouseholdId` function (lines 3–21):

```ts
export async function resolveHouseholdId(): Promise<string> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  const { data, error: dbErr } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (dbErr) throw dbErr
  if (!data) throw new Error('No household — complete sign-up first')
  return data.household_id
}
```

- [ ] **Step 2: Update createHousehold — replace getSession with getUser**

Replace lines 35–37 in `createHousehold`:

```ts
export async function createHousehold(name: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  // ... rest of function unchanged
```

- [ ] **Step 3: Update redeemInvite — replace getSession with getUser**

Replace lines 65–68 in `redeemInvite`:

```ts
export async function redeemInvite(token: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  // ... rest of function unchanged
```

- [ ] **Step 4: Run build to confirm no type errors**

```bash
npm run build
```

Expected: Compiled successfully.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/households.ts
git commit -m "fix: replace getSession with getUser for server-verified auth checks, strip debug logs"
```

---

## Task 3: Atomic invite redemption via Postgres function + server action

**Files:**
- Create: `app/actions/invites.ts`
- Modify: `app/join/page.tsx` (call server action instead of `redeemInvite`)

**Why this matters:**
- Current `redeemInvite` runs client-side with the anon key — meaning the RLS on `household_invites` must allow public SELECT by token, which is a data exposure risk.
- Two users hitting redeem simultaneously can both pass the `used_at IS NULL` check before either writes, adding the same person (or two people) to a household.
- A Postgres function with `FOR UPDATE` row lock + `SECURITY DEFINER` solves both issues atomically.

- [ ] **Step 1: Apply the Postgres migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with this SQL. You'll need the project ID first — use `mcp__plugin_supabase_supabase__list_projects` to find it.

```sql
CREATE OR REPLACE FUNCTION redeem_household_invite(
  p_token       text,
  p_user_id     uuid,
  p_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite household_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM household_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;

  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'You are already a member of a household';
  END IF;

  UPDATE household_invites SET used_at = NOW() WHERE id = v_invite.id;

  INSERT INTO household_members (household_id, user_id, display_name)
  VALUES (v_invite.household_id, p_user_id, p_display_name);
END;
$$;
```

- [ ] **Step 2: Create app/actions/invites.ts**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function redeemInviteAction(token: string, displayName: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) throw new Error('Not authenticated')

  const { error } = await supabase.rpc('redeem_household_invite', {
    p_token: token,
    p_user_id: user.id,
    p_display_name: displayName,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 3: Update app/join/page.tsx to call the server action**

Replace the import at the top of `app/join/page.tsx`:

```ts
// Remove:
import { redeemInvite } from '@/lib/queries/households'

// Add:
import { redeemInviteAction } from '@/app/actions/invites'
```

Replace the call inside `handleSubmit` (line 44):

```ts
// Remove:
await redeemInvite(token, displayName || email.split('@')[0])

// Add:
await redeemInviteAction(token, displayName || email.split('@')[0])
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: Compiled successfully. The `'use server'` directive in `app/actions/invites.ts` will cause a build error if the file imports browser-only code — build passing confirms server/client boundary is correct.

- [ ] **Step 5: Commit**

```bash
git add app/actions/invites.ts app/join/page.tsx
git commit -m "fix: move invite redemption to server action with atomic postgres function"
```

---

## Task 4: Rate-limit invite creation (max 1 active invite per household)

**Files:**
- Modify: `lib/queries/households.ts` — add check before insert in `createInvite`

Without this, a member can generate thousands of invite tokens, filling the `household_invites` table.

- [ ] **Step 1: Update createInvite to check for existing active invite**

Replace the `createInvite` function (lines 53–62):

```ts
export async function createInvite(householdId: string): Promise<string> {
  const supabase = createClient()

  const { count } = await supabase
    .from('household_invites')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())

  if ((count ?? 0) >= 1) {
    throw new Error('An active invite already exists. Wait for it to expire or be used before generating a new one.')
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId, token, expires_at: expiresAt })
  if (error) throw error
  return token
}
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/households.ts
git commit -m "fix: rate-limit invite creation to 1 active invite per household"
```

---

## Task 5: Add Content Security Policy headers

**Files:**
- Modify: `next.config.ts`

CSP limits what scripts, styles, and connections the browser allows — reduces XSS blast radius significantly for a financial app.

- [ ] **Step 1: Update next.config.ts with CSP headers**

Replace the entire file:

```ts
import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const csp = [
  "default-src 'self'",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
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
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
```

Note: `unsafe-inline` and `unsafe-eval` on `script-src` are required by Next.js 14 App Router's hydration mechanism. A nonce-based approach is the stricter alternative but requires significant Next.js plumbing — this is the practical baseline.

Also note: `reactStrictMode` changed from `false` to `true` here. If this causes double-renders that break something visible, revert it to `false` and leave a comment — but try `true` first.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Compiled successfully.

- [ ] **Step 3: Test CSP in browser**

```bash
npm run dev
```

Open `http://localhost:3000`, open DevTools → Console. There should be no CSP violation errors. Check Network tab → any request, look for the `content-security-policy` response header.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "fix: add Content-Security-Policy and security headers"
```

---

## Task 6: Verify everything works end-to-end

- [ ] **Step 1: Run the full build one final time**

```bash
npm run build
```

Expected: Compiled successfully with no errors or warnings.

- [ ] **Step 2: Start dev server and manually test route protection**

```bash
npm run dev
```

1. While logged out, navigate to `http://localhost:3000/budget` → should redirect to `/login`
2. While logged out, navigate to `http://localhost:3000/wealth` → should redirect to `/login`
3. Navigate to `http://localhost:3000/join?token=fake-token` → should load the join page (public route)
4. Log in → should land on home dashboard without redirect loops

- [ ] **Step 3: Confirm no console.log output**

Open DevTools → Console while loading any page as a logged-in user. There should be no `[resolveHousehold]` log lines.
