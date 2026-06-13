// Reliability probe — measures the GENERATION-PATH pass rate per domain without
// touching the archive. Unlike `quality:rescore` (which re-renders/re-scores
// EXISTING archive entries), this runs fresh novel prompts through the real
// `bin/sinter` generator path and records pass/fail + failure class. It is the
// Phase-0 instrument that gives an honest before/after for reliability fixes
// without waiting on hourly daemon cycles.
//
// Usage:
//   node scripts/quality/reliability-probe.mjs                 # all domains, n=5 each
//   node scripts/quality/reliability-probe.mjs --domain svg --n 10
//   node scripts/quality/reliability-probe.mjs --domain glsl,svg --n 8 --json out.json
//
// NEVER mutates ~/.sinter (no --learn). Each prompt is novel (timestamp + index
// suffix) so the LLM cache can't return a stale artifact and mask a real failure.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  TARGET_DOMAINS,
  buildDomainPrompt,
  classifyFailure,
} from './self-improve-domains.mjs';

const argv = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const N = Math.max(1, parseInt(getFlag('--n', '5'), 10));
const domainArg = getFlag('--domain', '');
const domains = domainArg
  ? domainArg.split(',').map((d) => d.trim()).filter((d) => TARGET_DOMAINS.includes(d))
  : TARGET_DOMAINS;
const jsonOut = getFlag('--json', '');
const GEN_TIMEOUT_MS = Math.max(60_000, parseInt(process.env.SINTER_GEN_TIMEOUT_MS || '480000', 10));

if (domains.length === 0) {
  console.error(`No valid domains. Known: ${TARGET_DOMAINS.join(', ')}`);
  process.exit(1);
}

// Novel themes — paired with a unique run stamp so no prompt is ever reused.
const THEMES = [
  'a derelict greenhouse reclaimed by phosphorescent moss',
  'tessellated koi dissolving into falling maple leaves',
  'a lighthouse beam sweeping through layered sea fog',
  'circuit-board ivy climbing a brutalist concrete wall',
  'a slow aurora folding over a frozen salt flat',
  'paper cranes unfolding into flocking starlings',
  'molten copper poured into a lattice of black glass',
  'a desert at dusk where dunes breathe like slow lungs',
  'origami mountains refracted through rippling water',
  'a clockwork orchard dropping brass fruit on velvet soil',
];

const runStamp = new Date().toISOString();
// Output MUST live under cwd (or ~/.sinter) — the CLI's resolveOutputPath guard
// (PR #677) rejects absolute paths elsewhere, e.g. os.tmpdir(), as path traversal.
// `.quality/` is gitignored; the run is cleaned up at the end either way.
const OUTROOT = path.join('.quality', `probe-${Date.now()}`);
fs.mkdirSync(OUTROOT, { recursive: true });

const results = {};
console.error(`=== reliability probe: ${domains.length} domain(s) × ${N} @ ${runStamp} ===`);

for (const domain of domains) {
  const r = { n: N, passed: 0, failed: 0, scores: [], classes: {} };
  for (let i = 0; i < N; i++) {
    const theme = THEMES[(i + domains.indexOf(domain)) % THEMES.length];
    const prompt = `${buildDomainPrompt(domain, theme)} — probe ${runStamp} #${i + 1}`;
    const tag = path.join(OUTROOT, `${domain}_${i + 1}`);
    const generatorFlags = domain === 'three' ? ' --provider minimax --model MiniMax-M3' : '';
    try {
      const out = execSync(
        `node bin/sinter --prompt ${JSON.stringify(prompt)} --intuition${generatorFlags} -o ${JSON.stringify(tag)}`,
        {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: GEN_TIMEOUT_MS,
          env: { ...process.env, LIMINAL_LOG_LEVEL: process.env.LIMINAL_LOG_LEVEL || 'warn' },
        },
      );
      const m = out.match(/Quality score:\s*([\d.]+)/);
      const s = m ? parseFloat(m[1]) : null;
      r.passed++;
      if (s != null) r.scores.push(s);
      console.error(`  [${domain} ${i + 1}/${N}] PASS score=${s ?? 'n/a'}`);
    } catch (e) {
      r.failed++;
      const timedOut = e.signal === 'SIGTERM' && e.status == null;
      const errLine = String(e.stderr || '').split('\n').reverse()
        .find((l) => /error|failed|❌|exception/i.test(l))?.trim();
      const text = `${timedOut ? 'TIMEOUT' : ''} ${errLine ?? ''} ${String(e.stderr || '').slice(-200)} ${String(e.stdout || '').slice(-200)}`;
      const cls = classifyFailure(text);
      r.classes[cls] = (r.classes[cls] ?? 0) + 1;
      console.error(`  [${domain} ${i + 1}/${N}] FAIL [${cls}]`);
      if (cls === 'rate_limited') { console.error('  rate-limited — stopping probe early'); r.n = i + 1; break; }
    }
  }
  r.passRate = r.passed / r.n;
  r.meanScore = r.scores.length ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : null;
  results[domain] = r;
  console.error(`  → ${domain}: ${r.passed}/${r.n} pass (${(r.passRate * 100).toFixed(0)}%) mean=${r.meanScore?.toFixed(3) ?? 'n/a'} classes=${JSON.stringify(r.classes)}`);
}

// Clean the temp output — this probe never persists artifacts.
try { fs.rmSync(OUTROOT, { recursive: true, force: true }); } catch { /* best effort */ }

const summary = {
  ts: runStamp,
  n: N,
  domains: results,
  overall: {
    passed: Object.values(results).reduce((a, r) => a + r.passed, 0),
    total: Object.values(results).reduce((a, r) => a + r.n, 0),
  },
};
summary.overall.passRate = summary.overall.total ? summary.overall.passed / summary.overall.total : null;

// stdout = machine-readable JSON only (stderr carried the human progress log).
const json = JSON.stringify(summary, null, 2);
process.stdout.write(json + '\n');
if (jsonOut) {
  fs.writeFileSync(jsonOut, json + '\n');
  console.error(`wrote ${jsonOut}`);
}
console.error(`OVERALL: ${summary.overall.passed}/${summary.overall.total} (${(summary.overall.passRate * 100).toFixed(0)}%)`);
