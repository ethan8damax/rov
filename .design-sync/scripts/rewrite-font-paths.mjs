import { readFileSync, writeFileSync } from 'node:fs';

// next/font/google emits @font-face src as an absolute path
// (/_next/static/media/<hash>.woff2). The converter's extractFonts()
// resolves url()s via path.resolve(srcDir, u) — an absolute 2nd arg makes
// resolve() ignore srcDir entirely, so it never finds the file under
// .ds-sync/fonts/ and never copies or rewrites it. That dead rule still
// gets emitted verbatim into fonts/fonts.css, while _ds_bundle.css gets a
// separately-patched working ./fonts/<hash> version (via cfg.extraFonts +
// rewriteBundleFontFaces) — two files declaring the same font with two
// different src values. Rewriting to a package-relative path here lets
// extractFonts resolve + copy it the same way for both outputs, so they agree.
const path = process.argv[2];
let css = readFileSync(path, 'utf8');
let count = 0;
css = css.replace(/url\(\/_next\/static\/media\/([^)'"]+\.(?:woff2?|ttf|otf))\)/g, (_, file) => {
  count++;
  return `url(./fonts/${file})`;
});
writeFileSync(path, css);
console.error(`  font paths: rewrote ${count} /_next/static/media/ url(s) to ./fonts/`);
