import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = process.argv[2];
const props = [
  'tw-border-style', 'animate-pulse', 'default-transition-duration',
  'default-transition-timing-function', 'tw-blur', 'tw-outline-style',
];

// The claude.ai/design classifier's diagnosis of WHERE @kind needs to
// attach has flip-flopped across rounds: first "annotate every inline
// occurrence" (274b614), then "the classifier can't attach it under a
// non-root selector like the reset block or a utility class — strip those,
// keep only the hand-written :root copy" (this repo's own prior fix), then
// "found it at the reset block, un-annotated — add it there specifically,
// same line, after the semicolon" (contradicts the previous round). Given
// two consecutive, mutually exclusive diagnoses from the same tool, this
// annotates EVERY occurrence — reset block, utility classes, AND the
// hand-written :root block — so it doesn't matter which one it's actually
// reading. If this still doesn't resolve, treat it as a checker limitation
// rather than chasing a fourth theory.
let css = readFileSync(path, 'utf8');
let total = 0;
for (const p of props) {
  // Semicolon-terminated: `--prop:value;` → append the comment right after.
  const reSemi = new RegExp(`(--${p}:[^;]+;)(?!\\s*/\\* @kind other \\*/)`, 'g');
  const beforeSemi = css;
  css = css.replace(reSemi, '$1/* @kind other */');
  const semiCount = (beforeSemi.match(reSemi) ?? []).length;
  // Brace-terminated (last declaration in a rule, no trailing `;`, e.g.
  // `.blur{--tw-blur:blur(8px)}`): add a `;` then the comment before `}`.
  // Idempotent — the rewritten form ends in `;`, so it won't re-match.
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
// declaration in Rov's own source (and, per the above, belt-and-suspenders
// alongside the inline annotations). Nothing in the converter appends this
// on its own — it's a manual step this script owns so a rebuild can't
// silently drop it. Idempotent: skipped if already present.
const overridesPath = '.design-sync/tokens/kind-overrides.css';
if (existsSync(overridesPath)) {
  const overrides = readFileSync(overridesPath, 'utf8');
  if (!css.includes(overrides.trim())) {
    css = css + '\n' + overrides;
    writeFileSync(path, css);
    console.error(`  appended ${overridesPath}`);
  } else {
    console.error(`  ${overridesPath}: already appended (no-op)`);
  }
} else {
  console.error(`  ! ${overridesPath} not found — nothing to append`);
}
