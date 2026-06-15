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
  readDomainArchives,
  diffArchiveAdmissions,
  pickUnderfilledDomains,
  buildDomainPrompt,
  dreamThemeFromTask,
  readPerDomainTopQuality,
  classifyFailure,
  parseScoreLine,
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
const gitPorcelain = () => {
  try { return execSync('git status --porcelain', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const gitBranch = () => {
  try { return execSync('git branch --show-current', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

const stamp = new Date().toISOString();
const beforeDomains = readPerDomainCounts(ARCHIVE);
const beforeArchives = readDomainArchives(ARCHIVE);
const before = { archive: readArchive(), health: gardenHealth() };
const dirty = gitPorcelain().length > 0;
const branch = gitBranch();
// Route each gen to a least-populated domain so the archive diversifies instead of
// collapsing every abstract theme onto the 'p5' fallback (the stall: detectPromptDomain
// returns null for abstract prompts, so all --learn outputs landed in one domain).
// Per-cycle random seed rotates the target set so the loop doesn't fixate on the same
// perpetually-empty domains every cycle (some of which may not accumulate) — it spreads
// coverage so archivable domains that still have room actually fill over time.
const cycleSeed = Math.floor(Math.random() * 1e6);
const topQuality = readPerDomainTopQuality(ARCHIVE);
const targetDomains = pickUnderfilledDomains(beforeDomains, TARGET_DOMAINS, MAX_PER_DOMAIN, COUNT, cycleSeed, topQuality);
console.log(`=== self-improve cycle (${COUNT} gens) @ ${stamp} ===`);
console.log(`before: archive=${before.archive} health=${before.health}% targets=[${targetDomains.join(', ')}]`);

// One dream per cycle: gen #1 consumes the gardener's highest-priority queued
// dream (persisted by `sinter garden tend`) as its theme — the link that turns
// dream recombinations into real generations. Other gens keep the idea pool.
const dreamQueue = new DreamQueue({ persistPath: DREAM_QUEUE_PATH });

const scores = [];
// Per-gen evaluation evidence so the ledger is HONEST about which scores are real
// fitness vs degraded evaluator-offline fallbacks. Each entry:
// { domain, score, degraded, evalFailureClass, evalConfidence }.
const evals = [];
// Per-failure {domain, failureClass} so the ledger records WHY gens fail, not
// just how many (Phase-0 reliability instrumentation). Aggregated into a count
// map on the ledger record below.
const failures = [];
// Full stderr of failed gens, persisted to a sidecar so failure classification is
// based on the COMPLETE error text — the old 200-char tail dropped the real error
// line and collapsed everything to 'other'. One file per cycle, names the run.
const STDERR_LOG = `${OUTROOT}/stderr_${Date.now()}.log`;
for (let i = 0; i < COUNT; i++) {
  const dreamTask = i === 0 ? dreamQueue.dequeue() ?? null : null;
  const dreamTheme = dreamTask ? dreamThemeFromTask(dreamTask) : null;
  const idea = dreamTheme ?? IDEAS[(before.archive + i) % IDEAS.length];
  const domain = targetDomains[i];
  const prompt = `${buildDomainPrompt(domain, idea)} — cycle ${stamp} #${i + 1}`; // domain-routed + novel
  const tag = `${OUTROOT}/g_${Date.now()}_${i + 1}`;
  // Per-domain generator routing (Simon-approved 2026-06-12): MiniMax-M3
  // composes three scenes measurably better than GLM (judge-swap lanes C/D:
  // cathedral B+/A-, orrery A-/A vs GLM's flat meadows). --provider sets the
  // LIMINAL_LLM_* env that getEffectiveConfig honors for the GENERATOR;
  // the evaluator role stays config-pinned (GLM) because role config outranks
  // env in the LLMClient constructor.
  const generatorFlags = domain === 'three' ? ' --provider minimax --model MiniMax-M3' : '';
  try {
    const out = execSync(
      `node bin/sinter --prompt ${JSON.stringify(prompt)} --learn --intuition${generatorFlags} -o ${JSON.stringify(tag)}`,
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: GEN_TIMEOUT_MS,
        // Surface info-level [stage-timing] probes so a timeout kill's stdout
        // tail names the stage that was in flight when the budget expired.
        env: { ...process.env, LIMINAL_LOG_LEVEL: process.env.LIMINAL_LOG_LEVEL || 'info' },
      },
    );
    // Parse the score AND its degradation status from the same line, so a
    // degraded evaluator-offline fallback is never silently banked as real fitness.
    const parsed = parseScoreLine(out);
    const s = parsed.score;
    if (s != null) {
      scores.push(s);
      evals.push({ domain, score: s, degraded: parsed.degraded, evalFailureClass: parsed.evalFailureClass, evalConfidence: parsed.evalConfidence });
    }
    if (dreamTask) {
      if (s != null) dreamQueue.complete(dreamTask.id, { candidateDescriptor: [], parentIds: dreamTask.sources.map((src) => src.id) });
      else dreamQueue.fail(dreamTask.id);
    }
    const degTag = parsed.degraded ? ` [degraded:${parsed.evalFailureClass ?? '?'}]` : '';
    console.log(`  [${i + 1}/${COUNT}] domain=${domain} score=${s ?? 'n/a'}${degTag}${dreamTask ? ` dream=${dreamTask.id}` : ''}  "${idea.slice(0, 32)}…"`);
  } catch (e) {
    if (dreamTask) dreamQueue.fail(dreamTask.id);
    // execSync reports a timeout kill as SIGTERM with null status; name it
    // instead of dumping a mid-run stdout tail. Real errors arrive on stderr,
    // which the old logging ignored entirely.
    const timedOut = e.signal === 'SIGTERM' && e.status == null;
    // Keep the FULL stderr/stdout for classification — the 200-char tail dropped
    // the real error line and collapsed real failures to 'other'. Persist the
    // full text to a sidecar log so the classification is auditable after the run.
    const fullErr = String(e.stderr || '');
    const fullOut = String(e.stdout || '');
    try {
      fs.appendFileSync(STDERR_LOG, `\n=== [${i + 1}/${COUNT}] domain=${domain} ===\n--- stderr ---\n${fullErr}\n--- stdout ---\n${fullOut}\n`);
    } catch { /* sidecar logging is best-effort */ }
    const errTail = fullErr.trim().slice(-200);
    const outTail = fullOut.trim().slice(-200);
    // INFO logs (store registrations etc.) can land on stderr AFTER the real
    // error, so a bare tail hides it — prefer the last error-bearing line.
    const errLine = fullErr.split('\n').reverse()
      .find((l) => /error|failed|❌|exception/i.test(l))?.trim();
    const rateLimited = /429|rate.?limit|usage limit/i.test(`${fullErr} ${fullOut}`);
    const lastStage = (fullOut.match(/\[stage-timing\][^\n]*/g) || []).pop();
    const reason = rateLimited
      ? 'RATE-LIMITED — stopping cycle early'
      : timedOut
        ? `TIMEOUT — domain=${domain} exceeded ${GEN_TIMEOUT_MS / 1000}s and was killed${lastStage ? ` (last completed stage: ${lastStage.slice(0, 80)})` : ''}`
        : (errLine || errTail || outTail || String(e.message || '')).slice(0, 120);
    // Classify from the COMPLETE error text (not a tail) so the class is real.
    const failureClass = classifyFailure(`${reason} ${fullErr} ${fullOut}`);
    failures.push({ domain, failureClass });
    console.log(`  [${i + 1}/${COUNT}] FAILED${dreamTask ? ` (dream=${dreamTask.id})` : ''} [${failureClass}]: ${reason}`);
    if (rateLimited) break;
  }
}

const afterDomains = readPerDomainCounts(ARCHIVE);
const afterArchives = readDomainArchives(ARCHIVE);
const after = { archive: readArchive(), health: gardenHealth() };
const { admitted, floors, tops } = diffArchiveAdmissions(beforeArchives, afterArchives);
const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
// trend = mean(second half) - mean(first half): positive ⇒ later gens scoring higher
let trend = null;
if (scores.length >= 4) {
  const h = Math.floor(scores.length / 2);
  const a = scores.slice(0, h), b = scores.slice(h);
  trend = (b.reduce((x, y) => x + y, 0) / b.length) - (a.reduce((x, y) => x + y, 0) / a.length);
}
// Honest fitness signal = mean of REAL (non-degraded) scores only. A degraded
// score is an evaluator-offline fallback, NOT measured fitness, so banking it in
// the mean inflates the trend. Keep `meanScore` for back-compat but surface the
// real-only mean + degraded count so the ledger is honest about what's real.
const degradedCount = evals.filter((e) => e.degraded).length;
const realScores = evals.filter((e) => !e.degraded).map((e) => e.score);
const meanRealScore = realScores.length
  ? realScores.reduce((a, b) => a + b, 0) / realScores.length
  : null;
// Per-cycle fail-rate as a first-class field: failed gens / requested gens. This
// is the reliability signal the ledger previously buried inside failureClasses.
const failRate = COUNT > 0 ? failures.length / COUNT : 0;
// Aggregate failures into a stable count map (class → n) for the ledger, so a
// cheap aggregator can trend WHY gens fail over time without re-parsing logs.
const failureClasses = failures.reduce((acc, f) => {
  acc[f.failureClass] = (acc[f.failureClass] ?? 0) + 1;
  return acc;
}, {});
const record = {
  ts: stamp, requested: COUNT, completed: scores.length,
  codeSha: codeSha(), distBuiltAt: distBuiltAt(),
  branch, dirty,
  before, after,
  archiveDelta: after.archive - before.archive,
  admitted, floors, tops,
  targetedDomains: targetDomains,
  beforeDomains, afterDomains,
  scores, meanScore: mean, intraCycleTrend: trend,
  // Honest fitness: real-only mean + which gens were degraded fallbacks.
  realScores, meanRealScore, degradedCount, evals,
  failureClasses, failures, failRate,
};
fs.appendFileSync(LEDGER, JSON.stringify(record) + '\n');

console.log(`after:  archive=${after.archive} (Δ+${record.archiveDelta}) admitted=${admitted} health=${after.health}%`);
console.log(`scores: [${scores.map(s => s.toFixed(2)).join(', ')}]  mean=${mean?.toFixed(3) ?? 'n/a'}  intra-trend=${trend?.toFixed(3) ?? 'n/a'}`);
console.log(`real:   ${realScores.length}/${scores.length} non-degraded  meanReal=${meanRealScore?.toFixed(3) ?? 'n/a'}  degraded=${degradedCount}  failRate=${(failRate * 100).toFixed(0)}%`);
if (failures.length) {
  const fc = Object.entries(failureClasses).map(([k, v]) => `${k}×${v}`).join(', ');
  console.log(`failures: ${failures.length} [${fc}]`);
}
console.log(`ledger: appended to ${LEDGER} (${fs.readFileSync(LEDGER, 'utf-8').trim().split('\n').length} cycles total)`);
