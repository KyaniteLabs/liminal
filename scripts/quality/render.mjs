// Render real generated artifacts to PNG via headless Chrome, so quality/beauty
// can be judged by looking — not by reading code. Captures page console errors to
// distinguish a real render from a broken one.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { HTMLWrapper } from '../../dist/utils/htmlWrapper.js';
import { findRevideoArtifact, renderRevideoStill } from './revideo-render.mjs';

const SRC = '.omx/proof/live-creative-domains';
const OUT = '.quality/renders';
fs.mkdirSync(OUT, { recursive: true });

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf-8');
// Text art (ascii/textgen) used to render corner-pinned and tiny on a vast
// empty canvas (audit F17). Center it and scale the type to the content: short
// pieces get large glyphs, long ones stay readable, judged as a composition.
const wrapPre = (txt) => {
  const lines = txt.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  // Fit ~90% of the 900x600 frame in BOTH axes (monospace glyph ≈ 0.6em wide,
  // line-height 1.25), clamped so short poems don't become billboards.
  const fitWidth = (900 * 0.9) / (longest * 0.6);
  const fitHeight = (600 * 0.9) / (lines.length * 1.25);
  const fontPx = Math.max(14, Math.min(34, Math.floor(Math.min(fitWidth, fitHeight))));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06080f;color:#cfe;font:${fontPx}px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center}pre{padding:18px;white-space:pre;line-height:1.25}</style></head><body><pre>${txt.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre></body></html>`;
};
// SVG needs two harness accommodations the other domains don't (audit F14):
// 1. viewBox-only SVGs have no intrinsic size and rendered near-invisible —
//    give the element explicit dimensions (preserveAspectRatio letterboxes
//    the art inside, so nothing distorts).
// 2. A fixed dark page made dark-ink-on-transparent art (a valid, common
//    output) judge as blank — a neutral checkerboard keeps both dark- and
//    light-ink art visible and shows the grader what is transparent.
const wrapSvg = (svg) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center}body{background:#858585;background-image:linear-gradient(45deg,#999 25%,transparent 25%,transparent 75%,#999 75%),linear-gradient(45deg,#999 25%,#737373 25%,#737373 75%,#999 75%);background-size:32px 32px;background-position:0 0,16px 16px}svg{width:90vmin;height:90vmin;max-width:90vw;max-height:90vh}</style></head><body>${svg}</body></html>`;

// domain → how to turn the artifact into a full standalone HTML page
const JOBS = [
  { name: 'p5',          html: () => HTMLWrapper.wrap(read('p5.js'), { domain: 'p5' }) },
  { name: 'shader-glsl', html: () => HTMLWrapper.wrap(read('glsl.frag'), { domain: 'shader' }) },
  { name: 'three',       html: () => HTMLWrapper.wrap(read('three.js'), { domain: 'three' }) },
  { name: 'hydra',       html: () => HTMLWrapper.wrap(read('hydra.js'), { domain: 'hydra' }) },
  { name: 'svg',         html: () => wrapSvg(read('svg.svg')) },
  { name: 'kinetic',     html: () => read('kinetic.html') },
  { name: 'hyperframes', html: () => read('hyperframes.html') },
  { name: 'tone',        html: () => read('tone.html') },
  { name: 'ascii',       html: () => wrapPre(read('ascii.txt')) },
  { name: 'textgen',     html: () => wrapPre(read('textgen.txt')) },
];

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 60000,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  ],
});
const results = [];
for (const job of JOBS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  let status = 'ok';
  try {
    const html = job.html();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 4000)); // let CDN scripts load + animation run
    const out = path.join(OUT, `${job.name}.png`);
    await page.screenshot({ path: out });
    const sz = fs.statSync(out).size;
    if (sz < 1500) status = `suspect-tiny(${sz}b)`;
  } catch (e) {
    status = 'RENDER-FAIL: ' + String(e.message).slice(0, 100);
  }
  results.push({ name: job.name, status, errors: errors.slice(0, 3) });
  await page.close();
}
await browser.close();
const revideoArtifact = findRevideoArtifact(SRC);
if (!revideoArtifact) {
  results.push({ name: 'revideo', status: 'SKIPPED (revideo artifact missing)', errors: [] });
} else {
  try {
    const out = path.join(OUT, 'revideo.png');
    const revideo = await renderRevideoStill({
      source: fs.readFileSync(revideoArtifact, 'utf-8'),
      outputPath: out,
      tempDir: path.join(OUT, '.revideo-tmp'),
      width: 900,
      height: 600,
    });
    results.push({ name: 'revideo', status: revideo.message, errors: [] });
  } catch (e) {
    results.push({ name: 'revideo', status: 'RENDER-FAIL: ' + String(e.message).slice(0, 100), errors: [] });
  }
}
for (const r of results) {
  const icon = r.status === 'ok' || r.status.startsWith('ok ')
    ? '✅'
    : r.status.startsWith('SKIPPED')
      ? '⏭️ '
      : '⚠️ ';
  console.log(`${icon} ${r.name.padEnd(12)} ${r.status}${r.errors.length ? '  | console: ' + r.errors.join(' ; ') : ''}`);
}
// Coverage transparency (audit F10): say what this harness deliberately does
// NOT render, so absent rows read as known gaps rather than silent omissions.
console.log('⏭️  strudel      skipped (audio — cannot be vision-graded)');
