#!/usr/bin/env node
/**
 * Disposable creative-domain QA cockpit.
 *
 * This script does not change Liminal's app routes or generation code. It reads
 * an existing artifact sweep, writes a temporary cockpit/checklist/bug-report
 * bundle under .omx/qa-cockpit by default, and can serve it locally for the
 * short manual browser/audio/video pass that machines cannot fully judge.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SMOKE_ROOT = path.join(ROOT, '.omx', 'runtime-smoke');
const DEFAULT_LIVE_RECEIPT = path.join(ROOT, '.omx', 'proof', 'domain-gauntlet-live.json');
const DEFAULT_LIVE_ARTIFACT_DIR = path.join(ROOT, '.omx', 'proof', 'live-creative-domains');
const DEFAULT_OUT_ROOT = path.join(ROOT, '.omx', 'qa-cockpit');
const DOMAIN_ORDER = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'html', 'ascii', 'kinetic', 'textgen'];

const DOMAIN_EXPECTATIONS = {
  p5: 'canvas visible; animation or intentional still sketch loads without console errors',
  svg: 'vector artwork is visible at the expected scale and not blank/cropped',
  glsl: 'shader canvas shows animated or colored fragment output',
  three: '3D scene/canvas loads with camera/light/geometry visible',
  hydra: 'video-synth canvas animates after load',
  strudel: 'click/start path produces audible pattern or exposes a clear play affordance',
  tone: 'click/start path produces audible synth/drone or exposes a clear play affordance',
  revideo: 'motion/video scene renders at least one frame and has plausible animation path',
  html: 'page layout renders without broken markup or obvious overflow',
  ascii: 'ASCII composition is visible, intentional, and not prose spillover',
  kinetic: 'CSS kinetic typography renders visible animated text/elements without console errors',
  textgen: 'generated text/concrete poetry is intentional, readable, and not placeholder/prose spillover',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function usage() {
  return `Usage:
  node scripts/qa-creative-domains.mjs [--input <artifact-dir-or-receipt.json>] [--out <out-dir>] [--port 4173] [--open] [--no-serve]

Examples:
  node scripts/qa-creative-domains.mjs --input .omx/proof/domain-gauntlet-live.json --open
  node scripts/qa-creative-domains.mjs --input .omx/runtime-smoke/domain-sweep-final-11 --out /tmp/liminal-qa --no-serve

Purpose:
  Builds a disposable cockpit for manual browser/audio/video checks. It does not
  modify the Liminal app, generation runtime, package scripts, or product UI.`;
}

function parseArgs(argv) {
  const options = {
    inputDir: null,
    outDir: null,
    port: Number(process.env.LIMINAL_QA_COCKPIT_PORT || 4173),
    open: false,
    serve: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--input') {
      options.inputDir = path.resolve(argv[++index] || '');
    } else if (arg.startsWith('--input=')) {
      options.inputDir = path.resolve(arg.slice('--input='.length));
    } else if (arg === '--out') {
      options.outDir = path.resolve(argv[++index] || '');
    } else if (arg.startsWith('--out=')) {
      options.outDir = path.resolve(arg.slice('--out='.length));
    } else if (arg === '--port') {
      options.port = Number(argv[++index]);
    } else if (arg.startsWith('--port=')) {
      options.port = Number(arg.slice('--port='.length));
    } else if (arg === '--open') {
      options.open = true;
    } else if (arg === '--no-serve') {
      options.serve = false;
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (!Number.isFinite(options.port) || options.port < 0) {
    throw new Error(`Invalid --port value: ${options.port}`);
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function findLatestSmokeDir(smokeRoot = DEFAULT_SMOKE_ROOT) {
  if (!fs.existsSync(smokeRoot)) return null;
  const candidates = [];
  for (const entry of fs.readdirSync(smokeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(smokeRoot, entry.name);
    const summaryPath = path.join(dir, 'summary.json');
    if (!fs.existsSync(summaryPath)) continue;
    candidates.push({ dir, mtimeMs: fs.statSync(summaryPath).mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.dir || null;
}

function findDefaultInput() {
  if (fs.existsSync(DEFAULT_LIVE_RECEIPT)) return DEFAULT_LIVE_RECEIPT;
  const latestSmoke = findLatestSmokeDir();
  if (latestSmoke) return latestSmoke;
  if (fs.existsSync(DEFAULT_LIVE_ARTIFACT_DIR)) return DEFAULT_LIVE_ARTIFACT_DIR;
  return null;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files.sort();
}

function firstExistingPath(values, inputDir) {
  for (const value of values) {
    if (!value || typeof value !== 'string') continue;
    const candidates = path.isAbsolute(value) ? [value] : [path.resolve(inputDir, value), path.resolve(ROOT, value), path.resolve(process.cwd(), value)];
    for (const absolute of candidates) {
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return absolute;
    }
  }
  return null;
}

function resolveInputSource(inputPath) {
  const absolute = path.resolve(inputPath);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    const receipt = safeReadJson(absolute);
    const artifactRoot = path.dirname(absolute);
    const siblingArtifactDir = path.join(artifactRoot, 'live-creative-domains');
    return { inputDir: fs.existsSync(siblingArtifactDir) ? siblingArtifactDir : artifactRoot, receiptPath: absolute, summary: receipt };
  }
  const receiptPath = path.join(absolute, 'receipt.json');
  const summaryPath = path.join(absolute, 'summary.json');
  const rootReceiptPath = path.join(ROOT, '.omx', 'proof', 'domain-gauntlet-live.json');
  return {
    inputDir: absolute,
    receiptPath: fs.existsSync(receiptPath) ? receiptPath : fs.existsSync(summaryPath) ? summaryPath : null,
    summary: safeReadJson(receiptPath) || safeReadJson(summaryPath) || (absolute === DEFAULT_LIVE_ARTIFACT_DIR ? safeReadJson(rootReceiptPath) : null),
  };
}

function pickArtifactFile(domain, inputDir, result = {}) {
  const hinted = firstExistingPath([
    result.html,
    result.htmlPath,
    result.artifact,
    result.artifactPath,
    result.outputPath,
    result.file,
    result.path,
  ], inputDir);
  if (hinted) return hinted;

  const candidateRoots = [
    path.join(inputDir, domain),
    path.join(inputDir, `${domain}`),
  ];
  const files = [
    ...candidateRoots.flatMap(walkFiles),
    ...walkFiles(inputDir).filter((file) => path.basename(file).toLowerCase().startsWith(`${domain}.`)),
  ];
  const preferred = ['.html', '.htm', '.svg', '.js', '.mjs', '.txt'];
  for (const ext of preferred) {
    const found = files.find((file) => path.extname(file).toLowerCase() === ext);
    if (found) return found;
  }
  return files[0] || null;
}

function normalizeSummaryResults(summary) {
  if (!summary) return [];
  if (Array.isArray(summary)) return summary;
  if (Array.isArray(summary.results)) return summary.results;
  if (Array.isArray(summary.domains)) return summary.domains;
  if (summary.results && typeof summary.results === 'object') return Object.values(summary.results);
  return [];
}

function discoverArtifacts(inputPath) {
  const source = resolveInputSource(inputPath);
  const inputDir = source.inputDir;
  const summaryPath = source.receiptPath;
  const summary = source.summary;
  const results = normalizeSummaryResults(summary);
  const byDomain = new Map();

  for (const result of results) {
    const domain = String(result?.domain || result?.name || '').toLowerCase();
    if (DOMAIN_ORDER.includes(domain)) byDomain.set(domain, result || {});
  }

  const domains = DOMAIN_ORDER.map((domain) => {
    const result = byDomain.get(domain) || {};
    const artifactPath = pickArtifactFile(domain, inputDir, result);
    return {
      domain,
      expected: DOMAIN_EXPECTATIONS[domain],
      success: result.success !== false,
      source: artifactPath,
      sourceRelative: artifactPath ? path.relative(inputDir, artifactPath) : null,
      size: artifactPath ? fs.statSync(artifactPath).size : 0,
      missing: !artifactPath,
      error: result.error || null,
    };
  });

  return {
    inputDir,
    summaryPath,
    domains,
    missingDomains: domains.filter((item) => item.missing).map((item) => item.domain),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

function artifactMonitorScript(domain) {
  const safeDomain = escapeJs(domain);
  return `<script data-liminal-qa-monitor="${safeDomain}">
(() => {
  const domain = "${safeDomain}";
  const post = (type, data = {}) => {
    try { parent.postMessage({ source: 'liminal-qa-artifact', domain, type, data }, location.origin); } catch {}
  };
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level]?.bind(console);
    console[level] = (...args) => {
      post('console', { level, message: args.map(String).join(' ').slice(0, 500) });
      if (original) original(...args);
    };
  }
  window.addEventListener('error', (event) => post('error', { message: event.message, filename: event.filename, lineno: event.lineno }));
  window.addEventListener('unhandledrejection', (event) => post('error', { message: String(event.reason) }));
  window.addEventListener('load', () => {
    setTimeout(() => post('ready', {
      title: document.title,
      canvasCount: document.querySelectorAll('canvas').length,
      svgCount: document.querySelectorAll('svg').length,
      audioCount: document.querySelectorAll('audio').length,
      videoCount: document.querySelectorAll('video').length,
      buttonCount: document.querySelectorAll('button,[role="button"]').length,
      bodyTextLength: (document.body?.innerText || '').trim().length,
    }), 250);
  });
})();
</script>`;
}

function injectMonitor(html, domain) {
  const monitor = artifactMonitorScript(domain);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${monitor}\n</head>`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${monitor}\n</body>`);
  return `${html}\n${monitor}`;
}

function wrapNonHtmlArtifact(content, domain, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const body = ext === '.svg'
    ? `<div class="svg-wrap">${content}</div>`
    : `<pre>${escapeHtml(content)}</pre>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(domain)} artifact</title>${artifactMonitorScript(domain)}
<style>body{margin:0;background:#111;color:#eee;font:14px ui-monospace,monospace}.svg-wrap{padding:16px;background:#fff;color:#111;min-height:100vh}pre{white-space:pre-wrap;padding:16px}</style>
</head><body>${body}</body></html>`;
}

function renderCockpit(discovery) {
  const cards = discovery.domains.map((item) => {
    const status = item.missing ? 'missing' : (item.success ? 'ready' : 'reported-failed');
    const frame = item.missing
      ? `<div class="missing">No artifact found for ${escapeHtml(item.domain)}.</div>`
      : `<iframe title="${escapeHtml(item.domain)} artifact" data-domain="${escapeHtml(item.domain)}" src="/artifact/${escapeHtml(item.domain)}" loading="lazy"></iframe>`;
    return `<section class="card ${status}" data-domain="${escapeHtml(item.domain)}">
      <header><h2>${escapeHtml(item.domain)}</h2><span class="badge" data-status-for="${escapeHtml(item.domain)}">${status}</span></header>
      <p class="expected">${escapeHtml(item.expected)}</p>
      <p class="source">${item.sourceRelative ? escapeHtml(item.sourceRelative) : 'missing'}</p>
      ${frame}
      <label class="manual"><input type="checkbox" data-manual="${escapeHtml(item.domain)}"> Human OK</label>
      <details><summary>Report notes</summary><textarea data-notes="${escapeHtml(item.domain)}" placeholder="What looked/sounded wrong?"></textarea></details>
    </section>`;
  }).join('\n');

  const manualList = discovery.domains.map((item) => `<li><strong>${escapeHtml(item.domain)}</strong> — ${escapeHtml(item.expected)}</li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Liminal Creative Domain QA Cockpit</title>
<style>
:root{color-scheme:dark;--bg:#0b0d12;--panel:#151a24;--muted:#8d98ad;--line:#2b3446;--ok:#5ee38b;--warn:#ffd166;--bad:#ff6b6b;--text:#eef4ff;--accent:#8ab4ff}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#090b10,#101520);color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{position:sticky;top:0;z-index:2;background:rgba(11,13,18,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:18px 22px}.top h1{margin:0 0 4px;font-size:22px}.top p{margin:0;color:var(--muted)}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}button,a.button{border:1px solid var(--line);background:#20283a;color:var(--text);border-radius:10px;padding:9px 12px;cursor:pointer;text-decoration:none}button:hover,a.button:hover{border-color:var(--accent)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;padding:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;min-height:420px;overflow:hidden}.card header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}.card h2{text-transform:uppercase;font-size:14px;letter-spacing:.12em;margin:0}.badge{font-size:12px;color:#101520;border-radius:999px;padding:4px 8px;background:var(--warn)}.badge.ok{background:var(--ok)}.badge.bad{background:var(--bad)}.expected,.source{padding:0 14px;margin:10px 0;color:var(--muted)}.source{font-family:ui-monospace,monospace;font-size:12px}iframe{width:100%;height:260px;border:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}.missing{height:260px;display:grid;place-items:center;color:var(--bad);border-block:1px solid var(--line)}.manual{display:block;padding:12px 14px}.manual input{transform:scale(1.2);margin-right:8px}details{padding:0 14px 14px}textarea{width:100%;min-height:70px;border-radius:10px;border:1px solid var(--line);background:#0e121b;color:var(--text);padding:8px}.panel{margin:0 16px 16px;padding:16px;background:var(--panel);border:1px solid var(--line);border-radius:16px}.panel h2{margin-top:0}.panel li{margin:6px 0}.report{white-space:pre-wrap;background:#080b10;border:1px solid var(--line);border-radius:12px;padding:12px;max-height:320px;overflow:auto;color:#d7e2f5}.warn{color:var(--warn)}
</style>
</head>
<body>
<header class="top">
  <h1>Liminal Creative Domain QA Cockpit</h1>
  <p>This is a disposable manual-test cockpit for generated artifacts only. It is not the Liminal app and should not become product surface.</p>
  <p><strong>Input:</strong> ${escapeHtml(discovery.inputDir)}</p>
  <div class="actions">
    <button id="runChecks">Run machine checks</button>
    <button id="copyReport">Copy bug report</button>
    <a class="button" href="/checklist.md" target="_blank">Checklist</a>
    <a class="button" href="/bug-report.md" target="_blank">Blank bug report</a>
  </div>
</header>
<section class="panel">
  <h2>Manual checks that still need human senses</h2>
  <ul>${manualList}</ul>
  <p class="warn">For Tone.js and Strudel, click inside the frame if the browser blocks autoplay.</p>
</section>
<main class="grid">${cards}</main>
<section class="panel">
  <h2>Live machine notes</h2>
  <pre id="report" class="report">Click “Run machine checks”.</pre>
</section>
<script>
const qaState = Object.fromEntries(${JSON.stringify(discovery.domains.map((item) => item.domain))}.map((domain) => [domain, { domain, loaded:false, errors:[], console:[], manual:false, notes:'', counts:{} }]));
function setBadge(domain, status, cls){ const el=document.querySelector('[data-status-for="'+domain+'"]'); if(el){el.textContent=status; el.className='badge '+(cls||'');}}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.source !== 'liminal-qa-artifact') return;
  const state = qaState[event.data.domain]; if (!state) return;
  if (event.data.type === 'ready') { state.loaded = true; state.counts = event.data.data || {}; setBadge(state.domain, 'loaded', 'ok'); }
  if (event.data.type === 'error') { state.errors.push(event.data.data); setBadge(state.domain, 'error', 'bad'); }
  if (event.data.type === 'console') state.console.push(event.data.data);
  renderReport();
});
for (const input of document.querySelectorAll('[data-manual]')) input.addEventListener('change', () => { qaState[input.dataset.manual].manual = input.checked; renderReport(); });
for (const notes of document.querySelectorAll('[data-notes]')) notes.addEventListener('input', () => { qaState[notes.dataset.notes].notes = notes.value; renderReport(); });
function inspectFrame(domain){
  const frame = document.querySelector('iframe[data-domain="'+domain+'"]');
  const state = qaState[domain];
  if (!frame) { state.errors.push({message:'missing iframe/artifact'}); return; }
  try {
    const doc = frame.contentDocument;
    state.counts = { ...state.counts, canvasCount: doc.querySelectorAll('canvas').length, svgCount: doc.querySelectorAll('svg').length, audioCount: doc.querySelectorAll('audio').length, videoCount: doc.querySelectorAll('video').length, bodyTextLength: (doc.body?.innerText || '').trim().length };
    state.loaded = true;
    if (state.errors.length === 0) setBadge(domain, 'checked', 'ok');
  } catch (error) {
    state.errors.push({message:'frame inspection blocked: '+error.message});
    setBadge(domain, 'inspect error', 'bad');
  }
}
function renderReport(){
  const lines = ['# Liminal creative-domain QA report', '', 'Generated: '+new Date().toISOString(), ''];
  for (const state of Object.values(qaState)) {
    lines.push('## '+state.domain);
    lines.push('- loaded: '+state.loaded);
    lines.push('- manual ok: '+state.manual);
    lines.push('- counts: '+JSON.stringify(state.counts));
    lines.push('- errors: '+(state.errors.length ? JSON.stringify(state.errors) : 'none'));
    lines.push('- console: '+(state.console.length ? JSON.stringify(state.console.slice(-5)) : 'none'));
    if (state.notes) lines.push('- notes: '+state.notes);
    lines.push('');
  }
  document.getElementById('report').textContent = lines.join('\\n');
}
document.getElementById('runChecks').addEventListener('click', () => { for (const domain of Object.keys(qaState)) inspectFrame(domain); renderReport(); });
document.getElementById('copyReport').addEventListener('click', async () => { renderReport(); await navigator.clipboard.writeText(document.getElementById('report').textContent); });
renderReport();
</script>
</body>
</html>`;
}

function renderChecklist(discovery) {
  const lines = [
    '# Liminal creative-domain manual QA checklist',
    '',
    `Input: ${discovery.inputDir}`,
    '',
    'Use this only as the final human-senses pass. If a box fails, copy the cockpit report and attach the artifact path.',
    '',
    '## Recording order',
    '',
    '1. Show the Level 6 release gate summary and provider/model provenance.',
    '2. Open the cockpit and click Run machine checks.',
    '3. Visit only domains that need human senses: animation, audio, motion/video, beauty, recognizability.',
    '4. Mark Human OK only after a real person sees/hears the artifact.',
    '5. If anything fails, copy the cockpit report instead of retyping context.',
    '',
    '## Domain checks',
    '',
  ];
  for (const item of discovery.domains) {
    lines.push(`- [ ] ${item.domain} — ${item.expected}`);
    lines.push(`  - artifact: ${item.sourceRelative || 'MISSING'}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderBugReport(discovery) {
  return `# Liminal creative-domain QA bug report

Input: ${discovery.inputDir}

## Domain

## Artifact path

## Expected vs actual

## Browser console / cockpit report

## Screenshot or screen recording path

## Can reproduce after refresh?

## Marketing-recording impact

- [ ] blocks recording
- [ ] acceptable with voiceover caveat
- [ ] cosmetic only

`;
}

function buildCockpitFiles({ inputDir, outDir }) {
  if (!inputDir) {
    inputDir = findDefaultInput();
  }
  if (!inputDir) {
    throw new Error('No artifact input found. Run pnpm proof:live-creative-domains -- --all, or pass --input .omx/proof/domain-gauntlet-live.json.');
  }
  inputDir = path.resolve(inputDir);
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Artifact input not found: ${inputDir}`);
  }
  outDir = path.resolve(outDir || path.join(DEFAULT_OUT_ROOT, timestamp()));
  fs.mkdirSync(outDir, { recursive: true });

  const discovery = discoverArtifacts(inputDir);
  const summary = {
    createdAt: new Date().toISOString(),
    inputDir: discovery.inputDir,
    cockpit: path.join(outDir, 'cockpit.html'),
    domains: discovery.domains,
    missingDomains: discovery.missingDomains,
  };

  fs.writeFileSync(path.join(outDir, 'cockpit.html'), renderCockpit(discovery));
  fs.writeFileSync(path.join(outDir, 'checklist.md'), renderChecklist(discovery));
  fs.writeFileSync(path.join(outDir, 'bug-report.md'), renderBugReport(discovery));
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  return { outDir, discovery, summary };
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function send(response, status, headers, body) {
  response.writeHead(status, headers);
  response.end(body);
}

function serveCockpit({ outDir, discovery, port, open }) {
  const artifactMap = new Map(discovery.domains.filter((item) => item.source).map((item) => [item.domain, item.source]));
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    if (url.pathname === '/') {
      send(response, 200, { 'content-type': 'text/html; charset=utf-8' }, fs.readFileSync(path.join(outDir, 'cockpit.html')));
      return;
    }
    if (url.pathname.startsWith('/artifact/')) {
      const domain = decodeURIComponent(url.pathname.slice('/artifact/'.length));
      const filePath = artifactMap.get(domain);
      if (!filePath) {
        send(response, 404, { 'content-type': 'text/plain; charset=utf-8' }, `Missing artifact for ${domain}`);
        return;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      const html = ext === '.html' || ext === '.htm'
        ? injectMonitor(raw, domain)
        : wrapNonHtmlArtifact(raw, domain, path.basename(filePath));
      send(response, 200, { 'content-type': 'text/html; charset=utf-8' }, html);
      return;
    }

    const staticPath = path.resolve(outDir, `.${url.pathname}`);
    const relativeStaticPath = path.relative(outDir, staticPath);
    if (relativeStaticPath.startsWith('..') || path.isAbsolute(relativeStaticPath) || !fs.existsSync(staticPath) || !fs.statSync(staticPath).isFile()) {
      send(response, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }
    send(response, 200, { 'content-type': contentType(staticPath) }, fs.readFileSync(staticPath));
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      const url = `http://127.0.0.1:${actualPort}/`;
      console.log(`Liminal QA cockpit: ${url}`);
      console.log(`Bundle: ${outDir}`);
      console.log('Press Ctrl+C to stop.');
      if (open) openUrl(url);
      resolve({ server, url });
    });
  });
}

function openUrl(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const { outDir, discovery } = buildCockpitFiles({ inputDir: options.inputDir, outDir: options.outDir });
  console.log(`Wrote QA cockpit bundle: ${outDir}`);
  if (discovery.missingDomains.length > 0) {
    console.warn(`Missing artifacts: ${discovery.missingDomains.join(', ')}`);
  }

  if (!options.serve) {
    console.log('Static bundle written. Serve it to use iframe machine checks:');
    console.log(`  node scripts/qa-creative-domains.mjs --input ${inputDirForMessage(options.inputDir)} --out ${outDir}`);
    return;
  }

  await serveCockpit({ outDir, discovery, port: options.port, open: options.open });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  DOMAIN_ORDER,
  buildCockpitFiles,
  discoverArtifacts,
  findLatestSmokeDir,
  findDefaultInput,
  parseArgs,
  renderBugReport,
  renderChecklist,
  renderCockpit,
  serveCockpit,
};

function inputDirForMessage(inputDir) {
  return inputDir || '<artifact-dir>';
}
