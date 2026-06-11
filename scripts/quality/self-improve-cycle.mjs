// Recursive self-improvement CYCLE driver.
//
// Runs N real generations with the archive-learning loop ON (--learn), so each
// high-scoring output enriches the persistent QualityArchive, which in turn
// enhances the prompt of later generations. Captures before/after metrics
// (archive size, per-gen quality scores, mean/trend) and appends one record per
// cycle to a persistent ledger so progress is measurable across runs/sessions.
//
// Usage:  node scripts/quality/self-improve-cycle.mjs [count]
// Paced + resumable: safe to run repeatedly (e.g. from cron); the QualityArchive
// and ledger accumulate. Honest fitness signal = Sinter's own evaluator score;
// guard against Goodhart with periodic human/vision audits of the gallery.

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  TARGET_DOMAINS,
  MAX_PER_DOMAIN,
  readPerDomainCounts,
  pickUnderfilledDomains,
  buildDomainPrompt,
  dreamThemeFromTask,
} from './self-improve-domains.mjs';
import { DreamQueue } from '../../dist/dreaming/DreamQueue.js';

const COUNT = Math.max(1, parseInt(process.argv[2] || '6', 10));
// Per-gen wall clock budget. Slow domains (hydra measured ~8min for a single
// iteration) overran the old 240s ceiling every time and were SIGTERM'd —
// logged misleadingly as garbled stdout tails. Tunable per environment.
const GEN_TIMEOUT_MS = Math.max(60_000, parseInt(process.env.SINTER_GEN_TIMEOUT_MS || '480000', 10));
const ARCHIVE = path.join(os.homedir(), '.sinter', 'archive', 'quality_archive.json');
const DREAM_QUEUE_PATH = path.join(os.homedir(), '.sinter', 'dreams', 'queue.json');
const LEDGER = 'docs/validation/self-improve-ledger.jsonl';
const OUTROOT = '.quality/rsi';
fs.mkdirSync(OUTROOT, { recursive: true });
fs.mkdirSync(path.dirname(LEDGER), { recursive: true });

// Novel creative ideas across domains/aesthetics. The cycle index + timestamp are
// appended so prompts are NEVER reused (avoids LLM cache returning stale art).
const IDEAS = [
  'a tide pool of bioluminescent anemones breathing with the cursor',
  'brass clockwork constellations that wind and unwind on a slate sky',
  'a meadow of paper wildflowers bending under procedural wind',
  'molten glass ribbons folding into impossible knots, warm on cool',
  'a migration of origami birds across a high-key dawn gradient',
  'crystalline frost spreading across a dark pane, then thawing',
  'a market of floating lanterns drifting over an indigo canal',
  'sand mandala grains self-assembling and scattering on touch',
  'neon koi circling a still pond under falling cherry petals',
  'a topographic map breathing like a slow tide, earthy contours',
];

const readArchive = () => {
  try {
    const d = JSON.parse(fs.readFileSync(ARCHIVE, 'utf-8'));
    // QualityArchive schema: { archives: { <domain>: ArchiveEntry[] }, lastUpdated }
    if (d.archives && typeof d.archives === 'object') {
      return Object.values(d.archives).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
    }
    return (d.outputs || d.entries || []).length;
  } catch { return 0; }
};
const gardenHealth = () => {
  try {
    const out = execSync('node bin/sinter garden status', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/Health:\s*([\d.]+)%/); return m ? parseFloat(m[1]) : null;
  } catch { return null; }
};
const codeSha = () => {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};
const distBuiltAt = () => {
  try { return fs.statSync('dist/index.js').mtime.toISOString(); }
  catch { return null; }
};

const stamp = new Date().toISOString();
const beforeDomains = readPerDomainCounts(ARCHIVE);
const before = { archive: readArchive(), health: gardenHealth() };
// Route each gen to a least-populated domain so the archive diversifies instead of
// collapsing every abstract theme onto the 'p5' fallback (the stall: detectPromptDomain
// returns null for abstract prompts, so all --learn outputs landed in one domain).
// Per-cycle random seed rotates the target set so the loop doesn't fixate on the same
// perpetually-empty domains every cycle (some of which may not accumulate) — it spreads
// coverage so archivable domains that still have room actually fill over time.
const cycleSeed = Math.floor(Math.random() * 1e6);
const targetDomains = pickUnderfilledDomains(beforeDomains, TARGET_DOMAINS, MAX_PER_DOMAIN, COUNT, cycleSeed);
console.log(`=== self-improve cycle (${COUNT} gens) @ ${stamp} ===`);
console.log(`before: archive=${before.archive} health=${before.health}% targets=[${targetDomains.join(', ')}]`);

// One dream per cycle: gen #1 consumes the gardener's highest-priority queued
// dream (persisted by `sinter garden tend`) as its theme — the link that turns
// dream recombinations into real generations. Other gens keep the idea pool.
const dreamQueue = new DreamQueue({ persistPath: DREAM_QUEUE_PATH });

const scores = [];
for (let i = 0; i < COUNT; i++) {
  const dreamTask = i === 0 ? dreamQueue.dequeue() ?? null : null;
  const dreamTheme = dreamTask ? dreamThemeFromTask(dreamTask) : null;
  const idea = dreamTheme ?? IDEAS[(before.archive + i) % IDEAS.length];
  const domain = targetDomains[i];
  const prompt = `${buildDomainPrompt(domain, idea)} — cycle ${stamp} #${i + 1}`; // domain-routed + novel
  const tag = `${OUTROOT}/g_${Date.now()}_${i + 1}`;
  try {
    const out = execSync(
      `node bin/sinter --prompt ${JSON.stringify(prompt)} --learn --intuition -o ${JSON.stringify(tag)}`,
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: GEN_TIMEOUT_MS,
        // Surface info-level [stage-timing] probes so a timeout kill's stdout
        // tail names the stage that was in flight when the budget expired.
        env: { ...process.env, LIMINAL_LOG_LEVEL: process.env.LIMINAL_LOG_LEVEL || 'info' },
      },
    );
    const m = out.match(/Quality score:\s*([\d.]+)/);
    const s = m ? parseFloat(m[1]) : null;
    if (s != null) scores.push(s);
    if (dreamTask) {
      if (s != null) dreamQueue.complete(dreamTask.id, { candidateDescriptor: [], parentIds: dreamTask.sources.map((src) => src.id) });
      else dreamQueue.fail(dreamTask.id);
    }
    console.log(`  [${i + 1}/${COUNT}] domain=${domain} score=${s ?? 'n/a'}${dreamTask ? ` dream=${dreamTask.id}` : ''}  "${idea.slice(0, 32)}…"`);
  } catch (e) {
    if (dreamTask) dreamQueue.fail(dreamTask.id);
    // execSync reports a timeout kill as SIGTERM with null status; name it
    // instead of dumping a mid-run stdout tail. Real errors arrive on stderr,
    // which the old logging ignored entirely.
    const timedOut = e.signal === 'SIGTERM' && e.status == null;
    const errTail = String(e.stderr || '').trim().slice(-200);
    const outTail = String(e.stdout || '').trim().slice(-200);
    const rateLimited = /429|rate.?limit|usage limit/i.test(`${errTail} ${outTail}`);
    const lastStage = (String(e.stdout || '').match(/\[stage-timing\][^\n]*/g) || []).pop();
    const reason = rateLimited
      ? 'RATE-LIMITED — stopping cycle early'
      : timedOut
        ? `TIMEOUT — domain=${domain} exceeded ${GEN_TIMEOUT_MS / 1000}s and was killed${lastStage ? ` (last completed stage: ${lastStage.slice(0, 80)})` : ''}`
        : (errTail || outTail || String(e.message || '')).slice(0, 120);
    console.log(`  [${i + 1}/${COUNT}] FAILED${dreamTask ? ` (dream=${dreamTask.id})` : ''}: ${reason}`);
    if (rateLimited) break;
  }
}

const afterDomains = readPerDomainCounts(ARCHIVE);
const after = { archive: readArchive(), health: gardenHealth() };
const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
// trend = mean(second half) - mean(first half): positive ⇒ later gens scoring higher
let trend = null;
if (scores.length >= 4) {
  const h = Math.floor(scores.length / 2);
  const a = scores.slice(0, h), b = scores.slice(h);
  trend = (b.reduce((x, y) => x + y, 0) / b.length) - (a.reduce((x, y) => x + y, 0) / a.length);
}
const record = {
  ts: stamp, requested: COUNT, completed: scores.length,
  codeSha: codeSha(), distBuiltAt: distBuiltAt(),
  before, after,
  archiveDelta: after.archive - before.archive,
  targetedDomains: targetDomains,
  beforeDomains, afterDomains,
  scores, meanScore: mean, intraCycleTrend: trend,
};
fs.appendFileSync(LEDGER, JSON.stringify(record) + '\n');

console.log(`after:  archive=${after.archive} (Δ+${record.archiveDelta}) health=${after.health}%`);
console.log(`scores: [${scores.map(s => s.toFixed(2)).join(', ')}]  mean=${mean?.toFixed(3) ?? 'n/a'}  intra-trend=${trend?.toFixed(3) ?? 'n/a'}`);
console.log(`ledger: appended to ${LEDGER} (${fs.readFileSync(LEDGER, 'utf-8').trim().split('\n').length} cycles total)`);
