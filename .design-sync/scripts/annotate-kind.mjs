import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
const props = [
  'tw-border-style', 'animate-pulse', 'default-transition-duration',
  'default-transition-timing-function', 'tw-blur', 'tw-outline-style',
];

let css = readFileSync(path, 'utf8');
let total = 0;
for (const p of props) {
  // Matches `--prop:value;` declarations (not the `@property --prop{...}` at-rule,
  // which has no colon right after the name). Skips ones already annotated.
  const re = new RegExp(`(--${p}:[^;]+;)(?!\\s*/\\* @kind other \\*/)`, 'g');
  const before = css;
  css = css.replace(re, '$1/* @kind other */');
  const count = (before.match(re) ?? []).length;
  total += count;
  console.error(`  ${p}: annotated ${count} occurrence(s)`);
}
writeFileSync(path, css);
console.error(`total: ${total} annotations added`);
