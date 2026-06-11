// Render the latest gallery works to PNG via headless Chrome, so quality/beauty
// can be judged by LOOKING (vision audit) — not by reading code. Complements
// render.mjs (which renders the fixed cross-domain proof set): this one points at
// real accumulated gallery output, which is what the "gets better every cycle"
// audit actually needs to look at.
//
//   pnpm quality:render-gallery            # newest 6 gallery works
//   node scripts/quality/render-gallery.mjs --count 10
//   node scripts/quality/render-gallery.mjs --dir gallery/2026-06-07--tundra-aurora-resonance
//
// Output: .quality/renders/gallery/<work>.png  (.quality is gitignored).
// Captures page console/JS errors so a broken render is distinguishable from a real one.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { HTMLWrapper } from '../../dist/utils/htmlWrapper.js';
import { detectDomain } from './detect-domain.mjs';
import { relativeLuminance, DARK_LUMINANCE_THRESHOLD } from './luminance.mjs';
import { looksLikeRevideoArtifact, renderRevideoStill } from './revideo-render.mjs';

// sharp is an optionalDependency — load it lazily so the renderer still works
// without it (the DARK luminance flag is just skipped when it's unavailable).
let sharp;
try { sharp = (await import('sharp')).default; } catch { /* luminance flag disabled */ }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GALLERY = path.join(ROOT, 'gallery');
const OUT = path.join(ROOT, '.quality/renders/gallery');

const argv = process.argv.slice(2);
const getArg = (flag, def) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : def; };
const COUNT = parseInt(getArg('--count', '6'), 10);
const ONLY_DIR = getArg('--dir', null);
const WAIT_MS = parseInt(getArg('--wait', '6000'), 10);

fs.mkdirSync(OUT, { recursive: true });

// Pick the latest version artifact inside a work dir (latest.json ref → vN, else highest vN).
function pickArtifact(dir) {
  const files = fs.readdirSync(dir);
  const versions = files.filter(f => /^v\d+\.(js|html|tsx|jsx)$/.test(f))
    .sort((a, b) => parseInt(b.match(/\d+/)[0], 10) - parseInt(a.match(/\d+/)[0], 10));
  return versions[0] ? path.join(dir, versions[0]) : null;
}

// detectDomain lives in ./detect-domain.mjs (shared + unit-tested).

// Turn a gallery artifact into a full standalone HTML page.
function toHtml(raw) {
  const txt = raw.trim();
  if (txt.startsWith('{')) {
    try {
      const obj = JSON.parse(txt);
      // Composition / version record: { type, code }. If code is already HTML, use it as-is.
      if (typeof obj.code === 'string') {
        if (/<\s*(!doctype|html|svg|iframe|canvas)/i.test(obj.code)) return obj.code;
        raw = obj.code; // raw sketch stored inside the record
      }
    } catch { /* not JSON — treat as raw code below */ }
  }
  if (/<\s*(!doctype|html)/i.test(raw)) return raw; // already standalone HTML
  const domain = detectDomain(raw);
  if (domain === 'svg') return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06080f;display:flex;align-items:center;justify-content:center}svg{max-width:90vw;max-height:90vh}</style></head><body>${raw}</body></html>`;
  // Faithful wrapping via the product's own HTMLWrapper (p5/shader/three/hydra).
  return HTMLWrapper.wrap(raw, { domain });
}

// Click through a "start"/"play" interaction gate so audio/interactive pieces
// render their actual content instead of the pre-start overlay.
async function dismissStartGate(page) {
  try {
    const clicked = await page.evaluate(() => {
      const isGate = (el) => /\b(click to start|start|begin|play|enter|tap)\b/i.test((el.textContent || '').trim()) && el.offsetParent !== null;
      const el = [...document.querySelectorAll('button,a,div,span,[role=button]')].find(isGate);
      if (el) { el.click(); return true; }
      return false;
    });
    if (!clicked) await page.mouse.click(500, 350); // fallback: click canvas center
    return clicked;
  } catch { return false; }
}

function selectWorks() {
  if (ONLY_DIR) {
    const d = path.isAbsolute(ONLY_DIR) ? ONLY_DIR : path.join(ROOT, ONLY_DIR);
    return [d];
  }
  if (!fs.existsSync(GALLERY)) return [];
  return fs.readdirSync(GALLERY)
    .map(name => path.join(GALLERY, name))
    .filter(p => fs.statSync(p).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, COUNT);
}

const works = selectWorks();
if (works.length === 0) { console.error('No gallery works found at', GALLERY); process.exit(1); }

const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 60000,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});

let ok = 0, fail = 0, skipped = 0;
for (const dir of works) {
  const name = path.basename(dir);
  const art = pickArtifact(dir);
  if (!art) { console.log(`${name.padEnd(40)} SKIP (no v*.js/html/tsx/jsx)`); continue; }
  const raw = fs.readFileSync(art, 'utf-8');
  if (looksLikeRevideoArtifact(raw, art)) {
    try {
      const out = path.join(OUT, `${name}.png`);
      const revideo = await renderRevideoStill({
        source: raw,
        outputPath: out,
        tempDir: path.join(OUT, '.revideo-tmp'),
        width: 1000,
        height: 700,
      });
      console.log(`${name.padEnd(40)} ${revideo.message}`);
      revideo.status === 'ok' ? ok++ : skipped++;
    } catch (e) {
      console.log(`${name.padEnd(40)} RENDER-FAIL: ${String(e.message).slice(0, 90)}`);
      fail++;
    }
    continue;
  }
  // Audio works (Strudel/Tidal) can't be vision-rendered — skip rather than
  // wrap-as-visual and produce a false-broken blank render (`bpm is not defined`).
  if (detectDomain(raw) === 'audio') {
    console.log(`${name.padEnd(40)} SKIP (audio domain — not visually rendered)`);
    skipped++;
    continue;
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  let status;
  try {
    await page.setContent(toHtml(raw), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, Math.min(WAIT_MS, 2500))); // let CDN scripts load + gate appear
    await dismissStartGate(page);                                   // click through any start/audio gate
    await new Promise(r => setTimeout(r, WAIT_MS));                 // let animation run post-start
    const out = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: out });
    const sz = fs.statSync(out).size;
    status = sz < 2000 ? `SUSPECT-TINY(${sz}b)` : `ok ${(sz / 1024).toFixed(0)}KB`;
    sz < 2000 ? fail++ : ok++;
    if (sharp && sz >= 2000) {                                       // flag too-dark/low-contrast renders objectively
      try {
        const { channels: [r, g, b] } = await sharp(out).stats();
        const lum = relativeLuminance(r.mean, g.mean, b.mean);
        if (lum < DARK_LUMINANCE_THRESHOLD) status += `  DARK(lum=${lum.toFixed(2)})`;
      } catch { /* luminance is best-effort */ }
    }
  } catch (e) { status = 'RENDER-FAIL: ' + String(e.message).slice(0, 90); fail++; }
  console.log(`${name.padEnd(40)} ${status}${errors.length ? '  ERR:' + errors.slice(0, 2).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
console.log(`\n${ok} ok, ${fail} suspect/failed, ${skipped} skipped (audio) → ${OUT}`);
process.exit(fail > 0 && ok === 0 ? 1 : 0);
