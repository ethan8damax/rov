# design-sync notes for Rov

Rov is a Next.js app, not a published component-library package — there's no
`dist/`, no `main`/`module`/`exports` in `package.json`, and no `.d.ts`
exports. This sync runs entirely in the converter's synth-entry mode against
`components/*.tsx` directly.

## Gotchas found during the first sync (2026-08-03)

- **Self-repo `node_modules/<pkg>` symlink required.** With no dist and no
  workspace, `package-build.mjs` needs `node_modules/rov` to resolve to the
  repo root for `PKG_DIR`. Fixed via `ln -sfn .. node_modules/rov` (repo
  root). This is gitignored (node_modules is) — **recreate it on every fresh
  clone / after `npm ci`** before re-running the converter:
  `ln -sfn .. node_modules/rov`. Do NOT pass `--entry` to work around this —
  `--entry` makes `resolveDistEntry` treat that path as a real dist entry
  (breaks synth-entry component discovery entirely).

- **`srcDir` must be explicit.** Auto-detection tries `src/`, `lib/`,
  `components/` in that order. This repo has a `lib/` dir (utilities, not
  components) that exists and comes first, so it silently won the auto-pick
  over `components/`. `cfg.srcDir: "components"` fixes it.

- **All components are default exports** (`export default function Name()`),
  not named. The bundled converter's synth-entry only emits
  `export * from "<file>"`, which — per ES module semantics — never forwards
  a default binding. Every component was silently absent from
  `window.Rov` ([BUNDLE_EXPORT] failing 21/21). Forked
  `.design-sync/overrides/source-kit.mjs` to also emit
  `export { default as <Name> } from "<file>"` per file (name recovered via
  the same ts-morph default-export detection the bundled lib already uses
  for discovery).

- **`Sidebar`, `MobileNav`, `AppShell` are excluded from this sync entirely**
  (`componentSrcMap: {"Sidebar": null, "MobileNav": null, "AppShell": null}`,
  extended in the source-kit.mjs fork to also drop the *file* from the synth
  entry, not just the discovered name). These three import `next/link` /
  `next/navigation`, which read `process.env.__NEXT_*` flags at module
  top-level — fine inside a real Next.js runtime, fatal in a standalone
  esbuild IIFE (`ReferenceError: process is not defined`). Because all 18
  components share ONE bundle file, this crashed `window.Rov` for
  *every* component, not just these three — file-level exclusion was the
  only fix. **Re-sync risk:** if any *other* component starts importing
  `next/link`/`next/navigation` in the future, it will reproduce this same
  whole-bundle crash and need the same exclusion treatment.

- **`AuthProvider` is deliberately NOT in `cfg.provider`.** It calls
  `createClient()` (Supabase) inside an effect on mount, which reads
  `process.env.NEXT_PUBLIC_SUPABASE_URL` — same bare-`process` crash as
  above, but this one fired because `cfg.provider` wraps *every* preview.
  Since `AuthProvider`/`useAuth` are only needed by `Sidebar` (already
  excluded above), the provider chain is just `ThemeProvider > ToastProvider`.

- **6 Tailwind-internal custom properties need `@kind other` annotations**
  for the claude.ai/design token classifier (`--tw-border-style`,
  `--animate-pulse`, `--default-transition-duration`,
  `--default-transition-timing-function`, `--tw-blur`, `--tw-outline-style`).
  These are Tailwind v4's own reset/utility plumbing, not real declarations
  in `app/tokens.css`/`app/globals.css` — there's no source line to comment.
  Fixed via a durable, committed override file
  (`.design-sync/tokens/kind-overrides.css`) that re-declares them with the
  comment, appended to the end of the compiled CSS copy step below (append,
  not `@import` — `@import` must be the first rule in a stylesheet, so
  appending raw declarations is the reliable way to inject this every
  re-sync without depending on ordering). **Re-sync risk:** if Tailwind's
  own default values for these properties ever change, the hardcoded
  values in `kind-overrides.css` go stale — harmless (they're inert
  internal plumbing, not visually consumed), but worth a glance on a
  Tailwind major-version bump.

- **Tailwind v4 CSS is compiled, not raw.** `app/globals.css` is
  `@import "tailwindcss"` + `@import "./tokens.css"` — compiled at Next.js
  build time, not real CSS on disk. `cfg.cssEntry` points at a copy of the
  compiled stylesheet pulled from `.next/static/css/*.css` after running
  `npm run build`. **Re-sync risk:** this copy goes stale the moment Tailwind
  classes change anywhere in the app. Re-run `npm run build` and re-copy
  `.next/static/css/*.css` → `.ds-sync/compiled-tailwind.css` before every
  re-sync (do this before running the converter).

- **`fonts/fonts.css` vs `_ds_bundle.css` shipped conflicting `@font-face` src
  paths (found 2026-08-11).** `cfg.cssEntry` is a raw copy of Next's compiled
  CSS, so its `@font-face` rules use next/font's absolute src
  (`/_next/static/media/<hash>.woff2`). The converter's `extractFonts()`
  resolves `url()`s via `path.resolve(srcDir, u)` — an **absolute** `u` makes
  `resolve()` ignore `srcDir` entirely, so it can never find the file under
  `.ds-sync/fonts/` and never copies or rewrites it; the rule still ships
  verbatim (dead src) into `fonts/fonts.css`. Separately, `_ds_bundle.css`
  gets a *different* code path: `cfg.extraFonts` copies the same 4 files into
  `fonts/`, then `rewriteBundleFontFaces()` patches `_ds_bundle.css`'s
  `@font-face` blocks to `./fonts/<hash>` once those files exist. Net result:
  two shipped stylesheets declare `@font-face` for the same family/weight
  with two different (one dead) `src` values — flagged by claude.ai/design as
  a conflict. Fixed via `.design-sync/scripts/rewrite-font-paths.mjs`, which
  rewrites `/_next/static/media/<hash>` → `./fonts/<hash>` in
  `.ds-sync/compiled-tailwind.css` *before* the converter runs, so
  `extractFonts()` can resolve+copy it the same way `_ds_bundle.css` does —
  both files end up with identical, working `./fonts/...` src. Run order:
  after the `npm run build` + CSS copy step, before `annotate-kind.mjs` (order
  between those two doesn't matter, both must run before `package-build.mjs`):
  `node .design-sync/scripts/rewrite-font-paths.mjs .ds-sync/compiled-tailwind.css`.

- **Brand fonts (DM Sans, DM Serif Display) — 4 files, not 2.** Next.js's
  `next/font/google` splits EACH family/weight into two `@font-face` rules
  by `unicode-range`: an extended-Latin subset (accented/special chars) and
  a `.p.woff2` basic-Latin subset (plain a-z, the one that actually covers
  ordinary English text). The first sync only grabbed the extended-Latin
  files and missed the `.p.` ones — `package-validate.mjs` silently dropped
  those 3 `@font-face` rules (`[FONT_DANGLING]`/`@ds-font-face-dropped`
  comments in `_ds_bundle.css`), so every preview was silently rendering
  plain text in the Arial/Times fallback, not DM Sans/DM Serif Display.
  Fixed 2026-08-06 by also grabbing the `.p.woff2` files. All 4 are copied
  into `.ds-sync/fonts/` under their ORIGINAL hashed basenames (font
  matching is by basename, not family name) and wired via `cfg.extraFonts`.
  **Re-sync risk:** if the font config in `app/layout.tsx` changes, all 4
  hashes change — re-grab ALL FOUR files from `.next/static/media/` after
  `npm run build` (search for both the plain `-s.woff2` and `-s.p.woff2`
  variants per family) and update all 4 `extraFonts` paths + copied
  filenames to match. Verify with `grep ds-font-face-dropped
  ds-bundle/_ds_bundle.css` after every rebuild — it must be empty.

- **`@kind other` placement: the classifier has given contradictory
  diagnoses across rounds (as of 2026-08-12) — annotate everywhere, don't
  chase a single theory further.** The 6 Tailwind-internal properties
  (`--tw-border-style`, `--animate-pulse`, `--default-transition-duration`,
  `--default-transition-timing-function`, `--tw-blur`, `--tw-outline-style`)
  are declared many times throughout the compiled CSS: once under
  Tailwind's own `@layer theme{:host,:root{...}}` block, and several more
  times under the universal reset (`@layer properties{...{*,::backdrop,
  :after,:before{...}}}`) and utility classes (`.border-none`, `.blur`,
  `.outline-none`, `.focus\:outline-none:focus`). Round 1 (`274b614`):
  classifier said one `:root` declaration wasn't enough, annotate every
  occurrence → added a regex pass that inline-annotated everything,
  including the reset block. Round 2: classifier said the reset-block/
  utility-class copies can NEVER attach regardless of formatting because
  the selector isn't a token scope, named the reset-block duplicate as
  the specific unresolvable one, said to strip inline annotations entirely
  and keep only the hand-written `:root` block → removed the inline pass.
  Round 3: classifier said the reset-block declaration (`--tw-border-style`
  at position 349, `--tw-blur` at 553, `--tw-outline-style` at 15143/15423)
  is STILL un-annotated and is "the true reset declaration the classifier
  likely keys off" — add `@kind other` there specifically, same line, after
  the `;`. This directly contradicts round 2 about the exact same lines.
  **Given two consecutive, mutually exclusive diagnoses from the same tool,
  stop trying to infer which single location it actually reads.**
  `annotate-kind.mjs` now annotates the property EVERYWHERE it's declared —
  reset block, utility classes (both semicolon- and brace-terminated
  forms), and the hand-written `:root` block via `kind-overrides.css` —
  so it doesn't matter which occurrence is being read. If a future round
  says this is *still* wrong, treat it as evidence the checker itself has a
  limitation here rather than attempting a fourth source-repo theory —
  it's reasonable to stop and accept this as a known, documented exception.
  Run after the `npm run build` copy and before `package-build.mjs`:
  `node .design-sync/scripts/annotate-kind.mjs .ds-sync/compiled-tailwind.css`.

  **The `kind-overrides.css` append was never actually scripted before
  2026-08-12 — it silently dropped on the 2026-08-11 rebuild.** NOTES.md
  described appending `.design-sync/tokens/kind-overrides.css` to
  `.ds-sync/compiled-tailwind.css` as a build step, but no script ever did
  it — someone did it by hand once (visible in the very first synced
  bundle), and it was lost the moment `compiled-tailwind.css` got
  regenerated from a fresh `npm run build` in a later session, with nothing
  to reproduce the append. `annotate-kind.mjs` now owns this step so it
  can't be silently skipped again.

- **3 custom properties on component selectors — 2 moved to `:root`, 1
  deliberately left (resolved 2026-08-12).** `.focus\:outline-none:focus`'s
  `--tw-outline-style` stays: it's Tailwind v4's own per-utility scoping,
  and moving it to `:root` would make outline-none apply unconditionally
  instead of only under `:focus` — a real behavior change, not a
  cosmetic one. `.__variable_ccfcb5`/`.__variable_0e4539` (next/font's
  generated classes, applied to `<html>` in `app/layout.tsx` via
  `dmSans.variable`/`dmSerif.variable`) scope `--font-dm-sans`/
  `--font-dm-serif` — unlike the Tailwind-internal 6, these ARE real design
  tokens (the brand typefaces, referenced by `--font-sans`/`--font-serif` in
  the `@theme` block), so they're now also re-declared at `:root` in
  `kind-overrides.css`, values copied verbatim from the compiled
  `.__variable_*` classes. **Re-sync risk:** if `app/layout.tsx`'s font
  config changes, next/font's generated `Fallback` name changes too —
  re-copy the values from the fresh build's `.__variable_*` classes.

## Preview scope (this sync)

User chose "core UI primitives only" for authored previews: `Button`,
`Badge`, `Card`, `MetricCard`, `ProgressBar`, `ToastProvider`, `RovWordmark`
(7 components). Everything else ships fully functional but floor-card only
for now — authorable incrementally on any later re-sync.

## Preview authoring gotcha: fixed-position overlays need real height

`ToastProvider`'s toast renders `position: fixed; bottom: 20 (80px)`. The
capture harness wraps each card in a div with `transform: translateZ(0)`,
which (per CSS spec) makes THAT div the containing block for any
`position: fixed` descendant — so `bottom-20` computes against the card
div's own height, not the viewport. If the preview's visible content is
just one line of text, the card div shrinks to ~20px tall and the toast's
`bottom: 80px` renders off-screen (invisible, not just misplaced). Fix:
give the trigger element real height (e.g. `minHeight: '260px'`) so the
transformed containing block is tall enough for `bottom-20` to land inside
the visible capture. Any future authored preview for a `position: fixed`
component (dialogs, tooltips, toasts) will hit this — same fix applies.

## Re-sync risks (forward-looking)

- The `node_modules/rov` self-symlink and `.design-sync/node_modules` fork
  symlink are both gitignored — recreate both after a fresh clone or `npm
  ci` (commands above and in Troubleshooting).
- The compiled Tailwind CSS and the two font files are copied snapshots of
  build output, not sourced live — see the two bullets above. A re-sync that
  skips the `npm run build` + re-copy step will upload a stale visual
  snapshot that silently diverges from the real app.
- If Sidebar/MobileNav/AppShell's `next/link` usage is ever needed in a
  future sync (e.g. user wants them included), the real fix is authoring a
  small provider/shim that defines `process.env.__NEXT_*` as empty strings
  for the esbuild bundle — not attempted here since these three were out of
  scope anyway.
