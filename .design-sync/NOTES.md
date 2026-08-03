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

- **Brand fonts (DM Sans, DM Serif Display)** are self-hosted by
  `next/font/google` with content-hashed filenames under
  `.next/static/media/`. Copied into `.ds-sync/fonts/` under their ORIGINAL
  hashed basenames (font matching is by basename, not family name) and
  wired via `cfg.extraFonts`. **Re-sync risk:** if the font config in
  `app/layout.tsx` changes, the hash changes — re-grab the new files from
  `.next/static/media/` after `npm run build` and update the two
  `extraFonts` paths (and the copied filenames) to match.

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
