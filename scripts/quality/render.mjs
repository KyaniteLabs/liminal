// Render real generated artifacts to PNG via headless Chrome, so quality/beauty
// can be judged by looking — not by reading code. Captures page console errors to
// distinguish a real render from a broken one.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { HTMLWrapper } from '../../dist/utils/htmlWrapper.js';

const SRC = '.omx/proof/live-creative-domains';
const OUT = '.quality/renders';
fs.mkdirSync(OUT, { recursive: true });

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf-8');
const wrapPre = (txt) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#06080f;color:#cfe;font:14px ui-monospace,Menlo,monospace}pre{padding:18px;white-space:pre-wrap}</style></head><body><pre>${txt.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre></body></html>`;
const wrapSvg = (svg) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06080f;display:flex;align-items:center;justify-content:center}svg{max-width:90vw;max-height:90vh}</style></head><body>${svg}</body></html>`;

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
for (const r of results) {
  console.log(`${r.status === 'ok' ? '✅' : '⚠️ '} ${r.name.padEnd(12)} ${r.status}${r.errors.length ? '  | console: ' + r.errors.join(' ; ') : ''}`);
}
