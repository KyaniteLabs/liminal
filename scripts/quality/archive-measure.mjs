// Render and measure QualityArchive visual entries, then optionally quarantine
// objectively dead frames by down-scoring them through the archive class.
//
// Dry run:
//   node scripts/quality/archive-measure.mjs --dry-run
// Apply quarantine:
//   node scripts/quality/archive-measure.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { QualityArchive } from '../../dist/learning/QualityArchive.js';
import { HTMLWrapper } from '../../dist/utils/htmlWrapper.js';
import { analyzeScreenshotBuffer } from '../../dist/render/DecodedImageVisibility.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, '.quality/archive-measure-renders');
const VISUAL_DOMAINS = ['p5', 'glsl', 'three', 'hydra', 'svg', 'ascii', 'textgen', 'kinetic'];
const MIN_ARCHIVE_SCORE = 0.65;
const DEAD_LUMINANCE_MAX = 0.12;
const DEAD_STD_MAX = 5;

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const DRY_RUN = argv.includes('--dry-run') || !APPLY;
const WAIT_MS = Number(readArg('--wait', '1500'));
const QUIET = argv.includes('--quiet');

function readArg(flag, fallback) {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : fallback;
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function wrapPre(text) {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map(line => line.length));
  const fitWidth = (900 * 0.9) / (longest * 0.6);
  const fitHeight = (600 * 0.9) / (lines.length * 1.25);
  const fontPx = Math.max(14, Math.min(34, Math.floor(Math.min(fitWidth, fitHeight))));
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06080f;color:#cfe;font:${fontPx}px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center}pre{padding:18px;white-space:pre;line-height:1.25}</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
}

function wrapSvg(svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center}body{background:#858585;background-image:linear-gradient(45deg,#999 25%,transparent 25%,transparent 75%,#999 75%),linear-gradient(45deg,#999 25%,#737373 25%,#737373 75%,#999 75%);background-size:32px 32px;background-position:0 0,16px 16px}svg{width:90vmin;height:90vmin;max-width:90vw;max-height:90vh}</style></head><body>${svg}</body></html>`;
}

function unwrapArchivedOutput(output) {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{')) return output;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed?.code === 'string' ? parsed.code : output;
  } catch {
    return output;
  }
}

function archiveEntryToHtml(entry) {
  const raw = unwrapArchivedOutput(entry.output);
  if (/<\s*(!doctype|html)/i.test(raw)) return raw;
  if (entry.domain === 'svg' || /<\s*svg[\s>]/i.test(raw)) return wrapSvg(raw);
  if (entry.domain === 'ascii' || entry.domain === 'textgen') return wrapPre(raw);
  if (entry.domain === 'kinetic') return raw;

  const wrapperDomain = entry.domain === 'glsl' ? 'shader' : entry.domain;
  return HTMLWrapper.wrap(raw, { domain: wrapperDomain });
}

function isDeadFrame(analysis) {
  return analysis.brightFraction === 0
    && analysis.meanLuminance <= DEAD_LUMINANCE_MAX
    && analysis.brightnessStd < DEAD_STD_MAX;
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-z0-9_.-]+/gi, '_').slice(0, 80);
}

function countEligible(entries) {
  return entries.filter(entry => entry.qualityScore >= MIN_ARCHIVE_SCORE).length;
}

function printTable(rows) {
  console.log('DOMAIN        total  eligible_before  eligible_after  measured  dead  failed');
  for (const row of rows) {
    console.log(`${row.domain.padEnd(12)} ${String(row.total).padStart(5)}  ${String(row.eligibleBefore).padStart(15)}  ${String(row.eligibleAfter).padStart(14)}  ${String(row.measured).padStart(8)}  ${String(row.dead).padStart(4)}  ${String(row.failed).padStart(6)}`);
  }
}

fs.mkdirSync(OUT, { recursive: true });
const archive = new QualityArchive();
await archive.load();

const beforeRows = new Map();
for (const domain of VISUAL_DOMAINS) {
  const entries = archive.getAll(domain);
  beforeRows.set(domain, {
    domain,
    total: entries.length,
    eligibleBefore: countEligible(entries),
    eligibleAfter: countEligible(entries),
    measured: 0,
    dead: 0,
    failed: 0,
  });
}

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 60000,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  ],
});

const deadEntries = [];
const failures = [];

for (const domain of VISUAL_DOMAINS) {
  const row = beforeRows.get(domain);
  const entries = archive.getAll(domain);
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    if (!QUIET) process.stderr.write(`measure ${domain} ${entryIndex + 1}/${entries.length} ${entry.id}\n`);
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 140)); });
    try {
      await page.setContent(archiveEntryToHtml(entry), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(resolve => setTimeout(resolve, WAIT_MS));
      const png = await page.screenshot({ type: 'png' });
      const outputPath = path.join(OUT, `${sanitizeFilePart(domain)}-${sanitizeFilePart(entry.id)}.png`);
      fs.writeFileSync(outputPath, png);
      const analysis = await analyzeScreenshotBuffer(png);
      row.measured++;

      if (isDeadFrame(analysis)) {
        row.dead++;
        deadEntries.push({ entry, analysis, errors: errors.slice(0, 3), outputPath });
      }
    } catch (error) {
      row.failed++;
      failures.push({ id: entry.id, domain, error: error instanceof Error ? error.message : String(error), errors: errors.slice(0, 3) });
    } finally {
      await page.close();
    }
  }
}

await browser.close();

if (deadEntries.length > 0) {
  console.log('\nDEAD FRAMES');
  for (const { entry, analysis } of deadEntries) {
    console.log(`${entry.domain.padEnd(8)} ${entry.id.padEnd(14)} q=${entry.qualityScore.toFixed(2)} lum=${analysis.meanLuminance.toFixed(4)} bright=${analysis.brightFraction.toFixed(4)} std=${analysis.brightnessStd.toFixed(2)}`);
  }
}

// Animated domains flip-flop on single frames: a sweep flagged 5 three
// entries dead that the previous sweep (minutes earlier) measured fine, and
// two p5 entries measured dead in two other harnesses were alive here.
// Quarantine only on CONSECUTIVE-sweep agreement; first-time flags are
// pending until the next sweep confirms them.
const STATE_PATH = path.join(ROOT, '.quality/archive-measure-state.json');
let prevDeadIds = [];
try { prevDeadIds = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')).deadIds ?? []; } catch { /* first sweep */ }
const prevDeadSet = new Set(prevDeadIds);
const confirmedDead = deadEntries.filter(({ entry }) => prevDeadSet.has(entry.id));
const pendingDead = deadEntries.filter(({ entry }) => !prevDeadSet.has(entry.id));
fs.writeFileSync(STATE_PATH, JSON.stringify({ sweptAt: new Date().toISOString(), deadIds: deadEntries.map(({ entry }) => entry.id) }, null, 2));
if (pendingDead.length > 0) {
  console.log(`\nPENDING_CONFIRMATION (dead this sweep, need a consecutive sweep to agree): ${pendingDead.map(({ entry }) => entry.id).join(', ')}`);
}

if (APPLY) {
  // Re-read before saving so a long render sweep does not clobber archive
  // entries added by a concurrently running daemon.
  await archive.load();
  const now = new Date().toISOString();
  for (const { entry: measuredEntry, analysis } of confirmedDead) {
    const entry = archive.getById(measuredEntry.id);
    if (!entry) continue;
    const priorScore = typeof entry.metadata?.preQuarantineQualityScore === 'number'
      ? entry.metadata.preQuarantineQualityScore
      : entry.qualityScore;
    entry.qualityScore = 0;
    entry.metadata = {
      ...entry.metadata,
      quarantinedAt: entry.metadata?.quarantinedAt ?? now,
      quarantineReason: 'archive-measure dead frame: brightFraction=0, meanLuminance<=0.12, brightnessStd<5',
      preQuarantineQualityScore: priorScore,
      quarantineRenderMeasure: {
        meanLuminance: analysis.meanLuminance,
        brightFraction: analysis.brightFraction,
        darkFraction: analysis.darkFraction,
        brightnessStd: analysis.brightnessStd,
        uniqueColors: analysis.uniqueColors,
        visibleRatio: analysis.visibleRatio,
      },
    };
  }
  await archive.save();
}

for (const domain of VISUAL_DOMAINS) {
  const row = beforeRows.get(domain);
  const entries = archive.getAll(domain);
  row.eligibleAfter = APPLY ? countEligible(entries) : row.eligibleBefore - deadEntries.filter(({ entry }) => entry.domain === domain && entry.qualityScore >= MIN_ARCHIVE_SCORE).length;
}

console.log(`\nMODE: ${DRY_RUN ? 'dry-run' : 'apply'}`);
printTable([...beforeRows.values()]);

if (failures.length > 0) {
  console.log('\nRENDER FAILURES');
  for (const failure of failures) {
    console.log(`${failure.domain.padEnd(8)} ${failure.id.padEnd(14)} ${failure.error.slice(0, 120)}${failure.errors.length ? ' | console: ' + failure.errors.join(' ; ') : ''}`);
  }
}

if (APPLY) {
  const quarantinedIds = confirmedDead.map(({ entry }) => entry.id).filter(id => archive.getById(id));
  console.log(`\nQUARANTINED (consecutive-sweep confirmed): ${quarantinedIds.length ? quarantinedIds.join(', ') : 'none'}`);
} else {
  console.log(`\nWOULD_QUARANTINE (consecutive-sweep confirmed): ${confirmedDead.length ? confirmedDead.map(({ entry }) => entry.id).join(', ') : 'none'}`);
}
