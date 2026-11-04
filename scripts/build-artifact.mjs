// Packs the production build into ONE self-contained HTML file for hosting as
// a claude.ai artifact.
//
// A complete document: the artifact host serves it as-is, so it carries its
// own doctype, charset and viewport meta (viewport-fit=cover is safe because
// the page pads itself with env(safe-area-inset-*)). The script is inlined.
// Run via `npm run build:artifact`; the output lands in dist/time-locker.html.
//
// Fails loudly rather than emitting a broken page if Vite's output ever stops
// matching what this expects.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const OUT = join(DIST, 'time-locker.html');

function need(match, what) {
  if (match === null) {
    console.error(`build-artifact: could not find ${what} in ${DIST}/index.html`);
    process.exit(1);
  }
  return match;
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

const viewport = need(
  html.match(/<meta\s+name="viewport"[\s\S]*?\/?>/),
  'the viewport <meta>',
)[0];
const title = need(html.match(/<title>[\s\S]*?<\/title>/), '<title>')[0];
const style = need(html.match(/<style>[\s\S]*?<\/style>/), '<style>')[0];
const src = need(
  html.match(/<script type="module"[^>]*\ssrc="\.\/([^"]+\.js)"[^>]*><\/script>/),
  'the module <script>',
)[1];

let js = readFileSync(join(DIST, src), 'utf8');
// An inline script ends at the first `</script`, wherever it appears - even
// inside a string. Escaping it keeps the code identical to the JS engine.
js = js.replaceAll('</script', '<\\/script');

const page = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8" />',
  viewport,
  title,
  style,
  '</head>',
  '<body>',
  '<canvas id="stage"></canvas>',
  `<script type="module">\n${js}\n</script>`,
  '</body>',
  '</html>',
  '',
].join('\n');

writeFileSync(OUT, page);
console.log(`build-artifact: wrote ${OUT} (${(page.length / 1024).toFixed(1)} KB)`);
