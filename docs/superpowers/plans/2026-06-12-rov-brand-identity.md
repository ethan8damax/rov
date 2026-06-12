# Rov Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Rov brand identity — DM Serif Display + DM Sans typography, a `--color-harvest` gold token, a path-based ר (Resh) logo mark, and slogan + brand lore copy on the auth pages.

**Architecture:** Fonts load via `next/font/google` in `app/layout.tsx` and are exposed as CSS variables wired into Tailwind v4's `@theme inline` so the `font-serif` utility maps to DM Serif Display and body text defaults to DM Sans. The logo mark is a font-independent SVG path (not a `<text>` glyph, which depends on installed fonts). Shared brand UI (wordmark header, slogan + lore block) lives in two small components under `components/brand/` reused by login/signup/join.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4 (CSS-first config via `@theme`), `next/font/google`, hand-written SVG.

**Verification:** This repo has no test suite. Each task is verified with `npm run build` (catches TypeScript errors) and the final state visually. Commit after every task.

**Notes / constraints from the design system (CLAUDE.md):**
- Font weights 400 and 500 only. DM Serif Display only ships weight 400 — compliant by construction.
- Sentence case always. No gradients, shadows, or blur.
- DM Serif Display has no Hebrew glyphs; the ר and רוב characters in UI copy will render via system font fallback. That is acceptable. The logo SVG uses a path so it never depends on fonts.

---

### Task 1: Load DM Sans + DM Serif Display and wire them into Tailwind

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add fonts in `app/layout.tsx`**

Replace the full file with:

```tsx
import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/lib/context/auth'
import { ToastProvider } from '@/components/ui/Toast'
import AppShell from '@/components/layout/AppShell'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
})

export const metadata: Metadata = {
  title: 'Rov',
  description: 'Budget with purpose. Live in rov.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppShell>
                {children}
              </AppShell>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Wire the variables into Tailwind and the body font in `app/globals.css`**

After the two `@import` lines at the top, insert:

```css
@theme inline {
  --font-sans: var(--font-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-serif: var(--font-dm-serif), Georgia, serif;
}
```

Then change the `body` rule's `font-family` line from:

```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

to:

```css
  font-family: var(--font-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: brand typography — DM Sans body, DM Serif Display via font-serif"
```

---

### Task 2: Add the `--color-harvest` token

**Files:**
- Modify: `app/tokens.css`

- [ ] **Step 1: Add harvest tokens to dark mode (`:root`)**

In the `:root` block, after the `--color-warning-subtle` line, add:

```css
  --color-harvest: #c8a96e;
  --color-harvest-subtle: rgba(200, 169, 110, 0.12);
```

- [ ] **Step 2: Add harvest tokens to light mode (`.light`)**

In the `.light` block, after its `--color-warning-subtle` line, add (darker for contrast on white):

```css
  --color-harvest: #9c7b3c;
  --color-harvest-subtle: rgba(156, 123, 60, 0.10);
```

- [ ] **Step 3: Commit**

```bash
git add app/tokens.css
git commit -m "feat: add --color-harvest token for savings goals and milestones"
```

---

### Task 3: Harvest accent on savings pod progress

**Files:**
- Modify: `components/ui/ProgressBar.tsx`
- Modify: `app/wealth/page.tsx:373`
- Modify: `app/page.tsx:185`

- [ ] **Step 1: Add a `harvest` intent to ProgressBar**

In `components/ui/ProgressBar.tsx`, change:

```ts
type Intent = 'primary' | 'positive' | 'negative' | 'neutral'
```

to:

```ts
type Intent = 'primary' | 'positive' | 'negative' | 'neutral' | 'harvest'
```

and add to the `intentColor` record:

```ts
  harvest:  'var(--color-harvest)',
```

- [ ] **Step 2: Use harvest for pod goal progress on the Wealth page**

In `app/wealth/page.tsx` (inside `SavingsPodRow`, ~line 373), change:

```tsx
      {pod.goal > 0 && <div className="mt-1 mb-1"><ProgressBar value={Math.min(100, (pod.allotted / pod.goal) * 100)} intent="positive" /></div>}
```

to:

```tsx
      {pod.goal > 0 && <div className="mt-1 mb-1"><ProgressBar value={Math.min(100, (pod.allotted / pod.goal) * 100)} intent="harvest" /></div>}
```

- [ ] **Step 3: Use harvest for the savings rollup on the Home page**

In `app/page.tsx` (~line 185), change:

```tsx
                  <ProgressBar value={Math.min(100, (totalAllotted / totalPodGoal) * 100)} intent="positive" />
```

to:

```tsx
                  <ProgressBar value={Math.min(100, (totalAllotted / totalPodGoal) * 100)} intent="harvest" />
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/ui/ProgressBar.tsx app/wealth/page.tsx app/page.tsx
git commit -m "feat: harvest gold accent on savings pod progress"
```

---

### Task 4: ר logo mark — logo.svg, favicon, icon, manifest

The mark is a geometric Resh: a horizontal top stroke curving into a descending right stroke, drawn as a path so it renders identically everywhere (no font dependency). Per the brief: glyph `#3b6ef8` on `#0a0e1a` rounded square, 20px radius at 512.

**Files:**
- Create: `public/logo.svg`
- Modify: `public/favicon.svg` (full overwrite)
- Modify: `public/icon.svg` (full overwrite — keeps any cached references valid)
- Modify: `public/manifest.json`

- [ ] **Step 1: Create `public/logo.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="20" fill="#0a0e1a"/>
  <path d="M155 171h158q44 0 44 44v126" fill="none" stroke="#3b6ef8" stroke-width="52" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Overwrite `public/favicon.svg` with the same mark at 32px**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0a0e1a"/>
  <path d="M9.7 10.7h9.9q2.75 0 2.75 2.75v7.9" fill="none" stroke="#3b6ef8" stroke-width="3.25" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 3: Overwrite `public/icon.svg` with the same artwork as logo.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="20" fill="#0a0e1a"/>
  <path d="M155 171h158q44 0 44 44v126" fill="none" stroke="#3b6ef8" stroke-width="52" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 4: Point `public/manifest.json` at the new logo and slogan**

Replace the full file with:

```json
{
  "name": "Rov",
  "short_name": "Rov",
  "description": "Budget with purpose. Live in rov.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e1a",
  "theme_color": "#3b6ef8",
  "icons": [
    {
      "src": "/logo.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add public/logo.svg public/favicon.svg public/icon.svg public/manifest.json
git commit -m "feat: path-based Resh logo mark for app icon, favicon, manifest"
```

---

### Task 5: Shared brand components — wordmark + lore block

Login, signup, and join all repeat the same dot-plus-text header; replace it with one shared wordmark component, and add one shared slogan/lore block. In-app the mark sits on the page background, so the tile uses `--color-primary-subtle` with a primary glyph (a `#0a0e1a` tile would be invisible in dark mode); the standalone `#0a0e1a` treatment is reserved for the exported icon files.

**Files:**
- Create: `components/brand/RovWordmark.tsx`
- Create: `components/brand/BrandLore.tsx`

- [ ] **Step 1: Create `components/brand/RovWordmark.tsx`**

```tsx
export default function RovWordmark() {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--color-primary-subtle)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 512 512" className="w-4 h-4">
          <path
            d="M155 171h158q44 0 44 44v126"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="font-serif text-[20px]" style={{ color: 'var(--color-foreground)' }}>
        Rov
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/brand/BrandLore.tsx`**

```tsx
export default function BrandLore() {
  return (
    <div className="mt-10 pt-5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
      <p className="font-serif text-[15px] mb-2" style={{ color: 'var(--color-foreground-secondary)' }}>
        Budget with purpose. Live in rov.
      </p>
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        <span style={{ color: 'var(--color-harvest)' }}>רוב</span> (rov) — in ancient Hebrew, an
        overwhelming fullness. Not the anxiety of &ldquo;enough,&rdquo; but the confidence of
        plenty. Zero-based budgeting is an act of abundance thinking: every dollar gets a home,
        nothing is wasted, nothing is forgotten.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds (components are not yet imported anywhere — that's fine).

- [ ] **Step 4: Commit**

```bash
git add components/brand/RovWordmark.tsx components/brand/BrandLore.tsx
git commit -m "feat: shared RovWordmark and BrandLore components"
```

---

### Task 6: Apply branding to login, signup, and join pages

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`
- Modify: `app/join/page.tsx`

- [ ] **Step 1: Login page**

In `app/login/page.tsx`:

Add imports after the `Button` import:

```tsx
import RovWordmark from '@/components/brand/RovWordmark'
import BrandLore from '@/components/brand/BrandLore'
```

Replace the header block:

```tsx
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
          <span className="text-[18px] font-medium">Rov</span>
        </div>
```

with:

```tsx
        <RovWordmark />
```

Change the heading:

```tsx
        <h1 className="text-[20px] font-medium mb-6">Sign in</h1>
```

to:

```tsx
        <h1 className="font-serif text-[24px] mb-6">Sign in</h1>
```

After the closing `</p>` of the "No account?" paragraph (before the closing `</div>` of `max-w-sm`), add:

```tsx
        <BrandLore />
```

- [ ] **Step 2: Signup page**

In `app/signup/page.tsx`, same pattern:

Add the same two imports after the `Button` import.

Replace the header block:

```tsx
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
          <span className="text-[18px] font-medium">Rov</span>
        </div>
```

with:

```tsx
        <RovWordmark />
```

Change:

```tsx
        <h1 className="text-[20px] font-medium mb-2">Create account</h1>
```

to:

```tsx
        <h1 className="font-serif text-[24px] mb-2">Create account</h1>
```

After the closing `</p>` of the "Already have an account?" paragraph, add:

```tsx
        <BrandLore />
```

- [ ] **Step 3: Join page**

In `app/join/page.tsx`:

Add the same two imports after the `Button` import.

Replace the header block inside `JoinForm`:

```tsx
      <div className="flex items-center gap-2 mb-8">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <span className="text-[18px] font-medium">Rov</span>
      </div>
```

with:

```tsx
      <RovWordmark />
```

Change:

```tsx
      <h1 className="text-[20px] font-medium mb-2">Join household</h1>
```

to:

```tsx
      <h1 className="font-serif text-[24px] mb-2">Join household</h1>
```

After the closing `</form>` tag (before the closing `</div>` of `max-w-sm`), add:

```tsx
      <BrandLore />
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx app/join/page.tsx
git commit -m "feat: brand wordmark, serif headings, slogan and lore on auth pages"
```

---

### Task 7: Sidebar wordmark + serif empty-state headings

**Files:**
- Modify: `components/layout/Sidebar.tsx:33-38`
- Modify: `app/page.tsx:218`

- [ ] **Step 1: Sidebar logo**

In `components/layout/Sidebar.tsx`, replace:

```tsx
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <span className="text-[14px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Rov
        </span>
      </div>
```

with:

```tsx
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <svg viewBox="0 0 512 512" className="w-3.5 h-3.5" aria-hidden="true">
          <path
            d="M155 171h158q44 0 44 44v126"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-serif text-[16px]" style={{ color: 'var(--color-foreground)' }}>
          Rov
        </span>
      </div>
```

- [ ] **Step 2: Home empty state gets a serif heading**

In `app/page.tsx` (~line 218), change:

```tsx
              <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>Nothing set up yet</p>
```

to:

```tsx
              <p className="font-serif text-[20px] mb-2" style={{ color: 'var(--color-foreground)' }}>Nothing set up yet</p>
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx app/page.tsx
git commit -m "feat: Resh mark in sidebar, serif empty-state heading on home"
```

---

## Spec coverage check

- DM Serif Display + DM Sans via `next/font/google` → Task 1
- `--color-harvest: #c8a96e` token (+ light-mode variant) → Task 2; applied to savings pod goals → Task 3
- `public/logo.svg` ר mark, `#3b6ef8` on `#0a0e1a` rounded square (rx 20 @ 512) → Task 4
- Manifest icons updated, favicon uses ר mark → Task 4
- Slogan + brand lore on login/signup/join → Tasks 5–6
- Serif headings on onboarding/auth + empty states → Tasks 6–7
