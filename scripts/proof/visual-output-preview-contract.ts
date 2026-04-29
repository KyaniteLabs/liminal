import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import { buildSyncPreviewHtml } from '../../gui/src/gui/syncPreview';
import { GenericWrapper } from '../../src/core/wrappers/GenericWrapper';
import { HTMLWrapper } from '../../src/utils/htmlWrapper';

type RenderItem = { domain: string; html: string; sourceLabel: string };
type RenderedItem = RenderItem & { htmlPath: string; url?: string };
type VisualProofMetrics = {
  canvasCount: number;
  svgCount: number;
  videoCount: number;
  audioCount: number;
  buttonCount: number;
  bodyTextLength: number;
  largestCanvasAreaRatio: number;
  largestSvgAreaRatio: number;
  primaryTextBlockAreaRatio: number;
  cssAnimationCount: number;
  strudelCodeVisible: boolean;
  revideoTimelinePreview: boolean;
  tonePreviewShell: boolean;
  toneTempoSynced: boolean;
  toneEmbeddedPlayableControl: boolean;
  hyperframesPreviewShell: boolean;
  monitor: { errors?: Array<{ level: string; message: string }> };
};

type Args = { input?: string; out: string };

const ARTIST_OUTPUT_DOMAINS = [
  'p5',
  'three',
  'svg',
  'glsl',
  'hydra',
  'strudel',
  'tone',
  'revideo',
  'hyperframes',
  'ascii',
  'kinetic',
  'textgen',
  'organism',
] as const;

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
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 18% 18%,rgba(56,189,248,.2),transparent 30%),#05070d;color:#eaf2ff;font:clamp(22px,4.2vw,58px)/1.08 ui-monospace,monospace;padding:32px}pre{white-space:pre-wrap;border:1px solid #334155;border-radius:24px;padding:clamp(24px,5vw,72px);min-width:min(820px,92vw);min-height:min(420px,70vh);display:grid;place-items:center;background:linear-gradient(135deg,rgba(13,19,32,.96),rgba(15,23,42,.72));box-shadow:0 28px 90px rgba(0,0,0,.42);text-align:center}</style></head><body><pre data-textgen-preview-shell>${escapeHtml(code)}</pre></body></html>`;
}

function svgPreview(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>SVG preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 20% 16%,rgba(125,211,252,.2),transparent 30%),#0b1020}.card{padding:clamp(28px,5vw,72px);border-radius:28px;background:#fff;box-shadow:0 28px 90px rgba(0,0,0,.42)}svg{width:min(72vmin,760px);max-width:82vw;max-height:82vh;height:auto;display:block}</style></head><body><div class="card" data-svg-preview-shell>${code}</div></body></html>`;
}

function kineticFixture(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kinetic preview</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#030405;color:white;font:800 48px system-ui}.word{animation:spin 5s linear infinite;text-shadow:0 0 20px #9ff}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="word">ORBIT</div></body></html>`;
}

function hyperframesFixture(): string {
  return HTMLWrapper.wrap(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>HyperFrames fixture</title>
  <style>
    body { margin: 0; background: #050816; color: white; font-family: Inter, system-ui, sans-serif; }
    [data-composition-id] { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: radial-gradient(circle at 24% 24%, #22d3ee, transparent 28%), linear-gradient(135deg, #08111f, #2e1065); }
    .clip { position: absolute; border-radius: 28px; }
    .hero { left: 9%; top: 16%; font-size: clamp(52px, 8vw, 118px); font-weight: 900; letter-spacing: -.07em; text-shadow: 0 0 30px rgba(103,232,249,.55); }
    .panel { right: 10%; bottom: 13%; width: 36%; height: 34%; background: linear-gradient(135deg, rgba(45,212,191,.88), rgba(129,140,248,.72)); box-shadow: 0 30px 80px rgba(34,211,238,.22); }
  </style>
</head>
<body>
  <div data-composition-id="liminal-promo" data-width="1920" data-height="1080">
    <h1 class="clip hero" data-start="0" data-duration="4" data-track-index="0">Open the threshold</h1>
    <div class="clip panel" data-start="1" data-duration="3" data-track-index="1"></div>
  </div>
  <script>
    window.gsap = window.gsap || { timeline: () => ({ from: () => window.gsap.timeline(), to: () => window.gsap.timeline() }) };
    const tl = gsap.timeline({ paused: true });
    tl.from(".hero", { opacity: 0, y: 70, duration: 1 }, 0);
    tl.to(".panel", { x: -80, scale: 1.08, duration: 2 }, 1);
    window.__timelines = window.__timelines || {};
    window.__timelines["liminal-promo"] = tl;
  </script>
</body>
</html>`, { domain: 'hyperframes', title: 'Liminal HyperFrames Preview' });
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
    { domain: 'hyperframes', sourceLabel: 'fixture hyperframes', html: hyperframesFixture() },
    { domain: 'ascii', sourceLabel: 'fixture ascii', html: GenericWrapper.wrap(['        /\\\\', '       /  \\\\', '  ____/____\\\\____', ' /  moonlit ridge \\\\', '/__stars__stars___\\\\'].join('\n'), { domain: 'ascii' }) },
    { domain: 'kinetic', sourceLabel: 'fixture kinetic', html: kineticFixture() },
    { domain: 'textgen', sourceLabel: 'fixture textgen', html: textPreview('Text art', 'D R E A M\n  MACHINE\n    IN LOOPS\n      REMEMBERS\n        LIGHT') },
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
  if (domain === 'hyperframes') return HTMLWrapper.wrap(code, { domain: 'hyperframes', title: 'Liminal HyperFrames Preview' });
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

function validateOutputMatrix(domains: string[]): string[] {
  const expected = new Set<string>(ARTIST_OUTPUT_DOMAINS);
  const actual = new Set(domains);
  const missing = [...expected].filter((domain) => !actual.has(domain));
  const genericHtml = actual.has('html') ? ['generic html is not an artist-facing output type; route kinetic HTML through kinetic and compositing HTML through HyperFrames'] : [];
  return [
    ...missing.map((domain) => `Missing artist-facing output domain: ${domain}`),
    ...genericHtml,
  ];
}

function contractErrorsForDomain(domain: string, metrics: VisualProofMetrics): string[] {
  const canvasDomains = new Set(['p5', 'three', 'glsl', 'hydra', 'organism']);
  return [
    canvasDomains.has(domain) && (metrics.canvasCount < 1 || metrics.largestCanvasAreaRatio < 0.08)
      ? `${domain} is missing a browser-visible canvas`
      : '',
    domain === 'svg' && (metrics.svgCount < 1 || metrics.largestSvgAreaRatio < 0.08)
      ? 'SVG preview is too small or missing'
      : '',
    domain === 'ascii' && (metrics.bodyTextLength < 40 || metrics.primaryTextBlockAreaRatio < 0.08)
      ? 'ASCII preview text block is too small'
      : '',
    domain === 'textgen' && (metrics.bodyTextLength < 20 || metrics.primaryTextBlockAreaRatio < 0.08)
      ? 'Textgen preview text block is too small'
      : '',
    domain === 'kinetic' && metrics.cssAnimationCount < 1
      ? 'Kinetic preview is missing visible CSS animation'
      : '',
    domain === 'strudel' && !metrics.strudelCodeVisible
      ? 'Strudel preview is missing visible source code'
      : '',
    domain === 'revideo' && !metrics.revideoTimelinePreview
      ? 'Revideo preview is missing the rendered timeline shell'
      : '',
    domain === 'tone' && !metrics.tonePreviewShell
      ? 'Tone preview is missing the polished audio shell'
      : '',
    domain === 'tone' && !metrics.toneTempoSynced
      ? 'Tone preview is missing tempo-synced visual feedback'
      : '',
    domain === 'tone' && !metrics.toneEmbeddedPlayableControl
      ? 'Tone preview is missing the generated playback control'
      : '',
    domain === 'hyperframes' && !metrics.hyperframesPreviewShell
      ? 'HyperFrames preview is missing the composition shell'
      : '',
  ].filter(Boolean);
}

async function writeGalleryAssets(outDir: string, results: Array<{ domain: string; screenshot: string; source: string }>, page: Page): Promise<void> {
  const gallery = [
    '<!doctype html><html><head><meta charset="utf-8"><title>Liminal output proof gallery</title>',
    '<style>:root{color-scheme:dark}body{margin:0;background:#05070d;color:#eaf2ff;font-family:Inter,system-ui,sans-serif;padding:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}figure{margin:0;border:1px solid rgba(148,163,184,.32);border-radius:18px;background:#0b1220;overflow:hidden}img{width:100%;display:block}figcaption{padding:12px 14px;font-weight:800}.source{display:block;color:#94a3b8;font:11px ui-monospace,monospace;margin-top:4px;word-break:break-word}</style></head><body>',
    '<h1>Liminal full output visual proof</h1><main>',
    ...results.map((result) => {
      const relativeShot = path.relative(outDir, path.resolve(result.screenshot));
      return `<figure><img src="${escapeHtml(relativeShot)}" alt="${escapeHtml(result.domain)} screenshot"><figcaption>${escapeHtml(result.domain.toUpperCase())}<span class="source">${escapeHtml(result.source)}</span></figcaption></figure>`;
    }),
    '</main></body></html>',
  ].join('');
  const galleryPath = path.join(outDir, 'gallery.html');
  fs.writeFileSync(galleryPath, gallery);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto(pathToFileURL(galleryPath).href, { waitUntil: 'load', timeout: 45_000 });
  await page.screenshot({ path: path.join(outDir, 'contact-sheet.png'), fullPage: true });
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
    await page.waitForTimeout(['p5', 'three', 'glsl', 'hydra', 'kinetic', 'hyperframes'].includes(item.domain) ? 2_000 : 1_000);
    const screenshot = path.join(screenshotDir, `${item.domain}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const metrics = await page.evaluate(`(() => {
      const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
      const largestAreaRatio = (selector) => {
        let largest = 0;
        for (const element of document.querySelectorAll(selector)) {
          const rect = element.getBoundingClientRect();
          largest = Math.max(largest, Math.max(0, rect.width * rect.height) / viewportArea);
        }
        return largest;
      };
      const textBlock = document.querySelector('pre, [data-ascii-preview-shell], [data-textgen-preview-shell], [data-strudel-source-code]');
      const textBlockRect = textBlock && textBlock.getBoundingClientRect();
      const primaryTextBlockAreaRatio = textBlockRect ? Math.max(0, textBlockRect.width * textBlockRect.height) / viewportArea : 0;
      return {
        canvasCount: document.querySelectorAll('canvas').length,
        svgCount: document.querySelectorAll('svg').length,
        videoCount: document.querySelectorAll('video').length,
        audioCount: document.querySelectorAll('audio').length,
        buttonCount: document.querySelectorAll('button,[role="button"]').length,
        bodyTextLength: (document.body && document.body.innerText || '').trim().length,
        largestCanvasAreaRatio: largestAreaRatio('canvas'),
        largestSvgAreaRatio: largestAreaRatio('svg'),
        primaryTextBlockAreaRatio,
        cssAnimationCount: document.getAnimations().length,
        strudelCodeVisible: Boolean(document.querySelector('[data-strudel-source-code]') && document.querySelector('[data-strudel-source-code]').textContent.trim()),
        revideoTimelinePreview: Boolean(document.querySelector('[data-revideo-timeline-preview]')),
        tonePreviewShell: Boolean(document.querySelector('[data-tone-preview-shell], #visualizer, #liminal-tone-visualizer')),
        toneTempoSynced: Boolean(document.querySelector('[data-tone-tempo-sync="true"][data-tone-bpm]')),
        toneEmbeddedPlayableControl: Boolean(
          !document.querySelector('#tone-artifact-surface') ||
          document.querySelector('#tone-artifact-surface button, #tone-artifact-surface [role="button"]')
        ),
        hyperframesPreviewShell: Boolean(document.querySelector('[data-hyperframes-preview-shell]')),
        monitor: window.__liminalVisualProof || {},
      };
    })()`) as VisualProofMetrics;
    const monitorErrors = (metrics.monitor.errors || []).filter((entry: { level: string; message: string }) => entry.level === 'error');
    const contractErrors = contractErrorsForDomain(item.domain, metrics);
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

  const matrixErrors = validateOutputMatrix(results.map((result) => result.domain));
  if (matrixErrors.length > 0) {
    results.push({
      domain: 'matrix',
      source: 'artist output domain matrix',
      screenshot: '',
      html: '',
      browserErrors: matrixErrors,
      monitorErrors: [],
      metrics: {
        canvasCount: 0,
        svgCount: 0,
        videoCount: 0,
        audioCount: 0,
        buttonCount: 0,
        bodyTextLength: 0,
        largestCanvasAreaRatio: 0,
        largestSvgAreaRatio: 0,
        primaryTextBlockAreaRatio: 0,
        cssAnimationCount: 0,
        strudelCodeVisible: false,
        revideoTimelinePreview: false,
        tonePreviewShell: false,
        toneTempoSynced: false,
        toneEmbeddedPlayableControl: false,
        hyperframesPreviewShell: false,
        monitor: {},
      },
    });
  }
  await writeGalleryAssets(outDir, results.filter((result) => result.screenshot), page);
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
    `Contact sheet: ${path.relative(process.cwd(), path.join(outDir, 'contact-sheet.png'))}`,
    `Gallery: ${path.relative(process.cwd(), path.join(outDir, 'gallery.html'))}`,
    '',
    '| Domain | Errors | Signal | Screenshot |',
    '| --- | ---: | --- | --- |',
    ...results.map((result) => `| ${result.domain} | ${result.browserErrors.length + result.monitorErrors.length} | canvas:${result.metrics.canvasCount} (${result.metrics.largestCanvasAreaRatio.toFixed(2)}) svg:${result.metrics.svgCount} (${result.metrics.largestSvgAreaRatio.toFixed(2)}) text:${result.metrics.bodyTextLength} (${result.metrics.primaryTextBlockAreaRatio.toFixed(2)}) anim:${result.metrics.cssAnimationCount} | ${result.screenshot} |`),
    '',
  ].join('\n'));
  console.log(JSON.stringify({ outDir: report.outDir, checked: results.length, failures: failures.map((failure) => failure.domain) }, null, 2));
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
