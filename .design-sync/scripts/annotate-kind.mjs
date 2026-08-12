import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = process.argv[2];
let css = readFileSync(path, 'utf8');

// This script used to ALSO regex-annotate every inline occurrence of the 6
// Tailwind-internal properties throughout the compiled CSS (reset block,
// .blur{}/.border-none{}/.outline-none{} utilities). That was wrong: every
// one of those occurrences sits under a non-token-scope selector (the
// universal reset `*,::before,::after,::backdrop`, or a utility class) —
// the claude.ai/design classifier only attaches @kind to declarations under
// a real token scope (:root, a theme class, [data-*]), so annotating those
// occurrences did nothing but add noise, confirmed by the classifier
// directly naming the duplicate reset-block declaration as the unresolvable
// one. The ONLY valid annotation site is the hand-written :root block below.
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
