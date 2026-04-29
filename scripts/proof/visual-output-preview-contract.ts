import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildSyncPreviewHtml } from '../../gui/src/gui/syncPreview';
import { GenericWrapper } from '../../src/core/wrappers/GenericWrapper';
import { HTMLWrapper } from '../../src/utils/htmlWrapper';

type RenderItem = { domain: string; html: string; sourceLabel: string };
type RenderedItem = RenderItem & { htmlPath: string; url?: string };

type Args = { input?: string; out: string };

function parseArgs(argv: string[]): Args {
  const args: Args = { out: path.join('.omx', 'proof', 'visual-output-preview-contract') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--help') {
      console.log('Usage: pnpm run proof:visual-output-previews -- [--input .omx/proof/domain-gauntlet-live.json] [--out .omx/proof/visual-output-preview-contract]');
      process.exit(0);
    }
  }
  return args;
}

function escapeHtml(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function monitorScript(domain: string): string {
  return `<script>
window.__liminalVisualProof = { domain: ${JSON.stringify(domain)}, errors: [], ready: false };
for (const level of ['error', 'warn']) {
  const original = console[level]?.bind(console);
  console[level] = (...args) => {
    window.__liminalVisualProof.errors.push({ level, message: args.map(String).join(' ').slice(0, 500) });
    if (original) original(...args);
  };
}
window.addEventListener('error', (event) => window.__liminalVisualProof.errors.push({ level: 'error', message: event.message }));
window.addEventListener('unhandledrejection', (event) => window.__liminalVisualProof.errors.push({ level: 'error', message: String(event.reason) }));
window.addEventListener('load', () => setTimeout(() => { window.__liminalVisualProof.ready = true; }, 600));
</script>`;
}

function injectMonitor(html: string, domain: string): string {
  const script = monitorScript(domain);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${script}\n</head>`);
  return `${html}\n${script}`;
}

function textPreview(title: string, code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;color:#eaf2ff;font:16px/1.4 ui-monospace,monospace}pre{white-space:pre-wrap;border:1px solid #334155;border-radius:16px;padding:24px;max-width:760px;background:#0d1320}</style></head><body><pre>${escapeHtml(code)}</pre></body></html>`;
}

function svgPreview(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>SVG preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020}.card{padding:40px;border-radius:24px;background:#fff}svg{max-width:78vw;max-height:78vh}</style></head><body><div class="card">${code}</div></body></html>`;
}

function kineticFixture(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kinetic preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#030405;color:white;font:800 48px system-ui}.word{animation:spin 5s linear infinite;text-shadow:0 0 20px #9ff}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="word">ORBIT</div></body></html>`;
}

function fixtureItems(): RenderItem[] {
  return [
    { domain: 'p5', sourceLabel: 'fixture p5', html: buildSyncPreviewHtml('function setup(){createCanvas(480,320)} function draw(){background(5,8,16); fill(80,220,255); circle(width/2+sin(frameCount*.05)*80,height/2,38)}') },
    { domain: 'three', sourceLabel: 'fixture three', html: buildSyncPreviewHtml('const renderer = new THREE.WebGLRenderer({ canvas }); renderer.setSize(window.innerWidth, window.innerHeight); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, .1, 100); camera.position.z = 3; const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({color:0x44ddff})); scene.add(cube); function animate(){ cube.rotation.y += .02; renderer.render(scene,camera); requestAnimationFrame(animate); } animate();') },
    { domain: 'svg', sourceLabel: 'fixture svg', html: svgPreview('<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle cx="60" cy="60" r="46" fill="#dff7ff"/><path d="M38 62l15 15 31-35" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>') },
    { domain: 'glsl', sourceLabel: 'fixture glsl', html: GenericWrapper.wrap('precision highp float; uniform vec2 u_resolution; uniform float u_time; void main(){ vec2 uv=gl_FragCoord.xy/u_resolution.xy; gl_FragColor=vec4(uv,abs(sin(u_time)),1.0); }', { domain: 'shader' }) },
    { domain: 'hydra', sourceLabel: 'fixture hydra', html: GenericWrapper.wrap('osc(8, 0.1, 1.2).kaleid(4).out()', { domain: 'hydra' }) },
    { domain: 'strudel', sourceLabel: 'fixture strudel', html: GenericWrapper.wrap('s("bd sd hh*2").slow(2)', { domain: 'strudel' }) },
    { domain: 'tone', sourceLabel: 'fixture tone raw html', html: HTMLWrapper.wrap('<!DOCTYPE html><html><body><button id="startButton">Start Ambient Sequence</button><script src="https://unpkg.com/tone@14.8.49/build/Tone.js"></script><script>const synth = new Tone.Synth().toDestination(); document.getElementById("startButton").addEventListener("click", () => synth.triggerAttackRelease("C4", "8n"));</script></body></html>', { domain: 'tone', title: 'Liminal Tone Preview' }) },
    { domain: 'revideo', sourceLabel: 'fixture revideo', html: GenericWrapper.wrap('import { makeScene } from "@revideo/core"; export default makeScene("x", function* () {});', { domain: 'revideo' }) },
    { domain: 'html', sourceLabel: 'fixture html', html: '<!doctype html><html><head><title>HTML preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#284b8f;color:white;font:700 44px system-ui}</style></head><body>Liminal</body></html>' },
    { domain: 'ascii', sourceLabel: 'fixture ascii', html: GenericWrapper.wrap('/\\\n/  \\\n----', { domain: 'ascii' }) },
    { domain: 'kinetic', sourceLabel: 'fixture kinetic', html: kineticFixture() },
    { domain: 'textgen', sourceLabel: 'fixture textgen', html: textPreview('Text art', 'D R E A M\n  MACHINE\n    IN LOOPS') },
  ];
}

function domainHtml(domain: string, filePath: string): string {
  const code = fs.readFileSync(filePath, 'utf8');
  if (domain === 'p5' || domain === 'three') return buildSyncPreviewHtml(code);
  if (domain === 'svg') return svgPreview(code);
  if (domain === 'glsl') return GenericWrapper.wrap(code, { domain: 'shader' });
  if (domain === 'hydra') return GenericWrapper.wrap(code, { domain: 'hydra' });
  if (domain === 'strudel') return GenericWrapper.wrap(code, { domain: 'strudel' });
  if (domain === 'tone') return HTMLWrapper.wrap(code, { domain: 'tone', title: 'Liminal Tone Preview' });
  if (domain === 'revideo') return GenericWrapper.wrap(code, { domain: 'revideo' });
  if (domain === 'ascii') return GenericWrapper.wrap(code, { domain: 'ascii' });
  if (domain === 'html' || domain === 'kinetic') return code;
  return textPreview(domain, code);
}

function itemsFromReceipt(receiptPath: string): RenderItem[] {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  return (receipt.domains || []).map((item: { domain: string; artifactPath: string }) => ({
    domain: item.domain,
    sourceLabel: item.artifactPath,
    html: domainHtml(item.domain, path.resolve(item.artifactPath)),
  }));
}

async function listen(server: http.Server): Promise<string> {
  return await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') reject(new Error('Could not bind preview proof server'));
      else resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function startOrganismPreview(): Promise<{ item: RenderedItem; close: () => Promise<void> }> {
  const { default: createApp } = await import('../../gui/server.js');
  const app = createApp();
  const server = http.createServer(app);
  const url = await listen(server);
  const code = JSON.stringify({
    type: 'organism',
    musicCode: '$: s("bd sd").gain(0.7)',
    visualCode: 'osc(10, 0.1, 1).kaleid(4).out()',
  });
  await fetch(`${url}/api/preview/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, version: 7001 }),
  });
  return {
    item: {
      domain: 'organism',
      html: '',
      htmlPath: `${url}/preview?version=7001`,
      sourceLabel: 'fixture organism via /api/preview/run',
      url: `${url}/preview?version=7001`,
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out);
  const screenshotDir = path.join(outDir, 'screenshots');
  const renderedDir = path.join(outDir, 'rendered');
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(renderedDir, { recursive: true });

  const items = args.input ? itemsFromReceipt(args.input) : fixtureItems();
  const rendered: RenderedItem[] = items.map((item) => {
    const htmlPath = path.join(renderedDir, `${item.domain}.html`);
    fs.writeFileSync(htmlPath, injectMonitor(item.html, item.domain));
    return { ...item, htmlPath };
  });
  const organismPreview = await startOrganismPreview();
  rendered.push(organismPreview.item);

  const server = http.createServer((request, response) => {
    const domain = decodeURIComponent((request.url || '/').slice(1));
    const item = rendered.find((candidate) => candidate.domain === domain && !candidate.url);
    if (!item) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fs.readFileSync(item.htmlPath));
  });
  const url = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const results = [];

  for (const item of rendered) {
    const browserErrors: string[] = [];
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    await page.goto(item.url || `${url}/${encodeURIComponent(item.domain)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (item.domain === 'tone') await page.locator('button').first().click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(['p5', 'three', 'glsl', 'hydra', 'kinetic'].includes(item.domain) ? 2_000 : 1_000);
    const screenshot = path.join(screenshotDir, `${item.domain}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const metrics = await page.evaluate(() => ({
      canvasCount: document.querySelectorAll('canvas').length,
      svgCount: document.querySelectorAll('svg').length,
      videoCount: document.querySelectorAll('video').length,
      audioCount: document.querySelectorAll('audio').length,
      buttonCount: document.querySelectorAll('button,[role="button"]').length,
      bodyTextLength: (document.body?.innerText || '').trim().length,
      revideoTimelinePreview: Boolean(document.querySelector('[data-revideo-timeline-preview]')),
      tonePreviewShell: Boolean(document.querySelector('[data-tone-preview-shell], #visualizer, #liminal-tone-visualizer')),
      monitor: (window as unknown as { __liminalVisualProof?: { errors?: Array<{ level: string; message: string }> } }).__liminalVisualProof || {},
    }));
    const monitorErrors = (metrics.monitor.errors || []).filter((entry: { level: string; message: string }) => entry.level === 'error');
    const contractErrors = [
      item.domain === 'revideo' && !metrics.revideoTimelinePreview ? 'Revideo preview is missing the rendered timeline shell' : '',
      item.domain === 'tone' && !metrics.tonePreviewShell ? 'Tone preview is missing the polished audio shell' : '',
    ].filter(Boolean);
    results.push({
      domain: item.domain,
      source: item.sourceLabel,
      screenshot: path.relative(process.cwd(), screenshot),
      html: path.relative(process.cwd(), item.htmlPath),
      browserErrors: [...browserErrors, ...contractErrors],
      monitorErrors,
      metrics,
    });
  }

  await browser.close();
  server.close();
  await organismPreview.close();
  const failures = results.filter((result) => result.browserErrors.length || result.monitorErrors.length);
  const report = { createdAt: new Date().toISOString(), input: args.input || 'fixtures', outDir: path.relative(process.cwd(), outDir), results, failures };
  fs.writeFileSync(path.join(outDir, 'visual-output-preview-contract.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'visual-output-preview-contract.md'), [
    '# Visual output preview contract',
    '',
    `Input: ${report.input}`,
    '',
    '| Domain | Errors | Signal | Screenshot |',
    '| --- | ---: | --- | --- |',
    ...results.map((result) => `| ${result.domain} | ${result.browserErrors.length + result.monitorErrors.length} | canvas:${result.metrics.canvasCount} svg:${result.metrics.svgCount} text:${result.metrics.bodyTextLength} | ${result.screenshot} |`),
    '',
  ].join('\n'));
  console.log(JSON.stringify({ outDir: report.outDir, checked: results.length, failures: failures.map((failure) => failure.domain) }, null, 2));
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
