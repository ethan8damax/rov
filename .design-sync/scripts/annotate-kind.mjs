import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = process.argv[2];
const props = [
  'tw-border-style', 'animate-pulse', 'default-transition-duration',
  'default-transition-timing-function', 'tw-blur', 'tw-outline-style',
];

let css = readFileSync(path, 'utf8');
let total = 0;
for (const p of props) {
  // Two declaration shapes: `--prop:value;` (semicolon-terminated — the
  // common case) and `--prop:value}` (the LAST declaration in a rule block,
  // no trailing semicolon — e.g. Tailwind's `.blur{--tw-blur:blur(8px)}`).
  // Neither matches `@property --prop{...}` (no colon right after the name).
  // Semicolon form: append right after the `;`.
  const reSemi = new RegExp(`(--${p}:[^;]+;)(?!\\s*/\\* @kind other \\*/)`, 'g');
  const beforeSemi = css;
  css = css.replace(reSemi, '$1/* @kind other */');
  const semiCount = (beforeSemi.match(reSemi) ?? []).length;
  // Brace form: value has no `;` before the closing `}` — add one, then the
  // comment. Naturally idempotent: once rewritten, the value is followed by
  // `;` not `}`, so this pattern no longer matches on a re-run.
  const reBrace = new RegExp(`--${p}:([^;{}]+)\\}`, 'g');
  const beforeBrace = css;
  css = css.replace(reBrace, `--${p}:$1;/* @kind other */}`);
  const braceCount = (beforeBrace.match(reBrace) ?? []).length;
  const count = semiCount + braceCount;
  total += count;
  console.error(`  ${p}: annotated ${count} occurrence(s)${braceCount ? ` (${braceCount} brace-terminated)` : ''}`);
}
writeFileSync(path, css);
console.error(`total: ${total} annotations added`);

// kind-overrides.css: durable :root fallback for tokens with no literal
// declaration in Rov's own source. Nothing in the converter appends this —
// it's a manual step this script now owns so a rebuild can't silently drop
// it (it did, once: the Aug 2026 rebuild that overwrote compiled-tailwind.css
// from a fresh `npm run build` shipped without it, since no script re-added
// it). Idempotent: skipped if already appended.
const overridesPath = '.design-sync/tokens/kind-overrides.css';
if (existsSync(overridesPath)) {
  const overrides = readFileSync(overridesPath, 'utf8');
  if (!css.includes(overrides.trim())) {
    css = css + '\n' + overrides;
    writeFileSync(path, css);
    console.error(`  appended ${overridesPath}`);
  } else {
    console.error(`  ${overridesPath}: already appended`);
  }
}
