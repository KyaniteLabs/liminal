// Failure-class report — aggregates the `failureClasses` field the self-improve
// cycle now writes to the ledger, so you can see WHY gens fail over time without
// re-reading raw daemon logs. Cycles older than the instrumentation simply have
// no failureClasses field and are counted only toward completion totals.
//
// Usage:
//   node scripts/quality/failure-class-report.mjs            # last 30 cycles
//   node scripts/quality/failure-class-report.mjs --all
//   node scripts/quality/failure-class-report.mjs --n 50

import fs from 'fs';

const LEDGER = 'docs/validation/self-improve-ledger.jsonl';
const argv = process.argv.slice(2);
const all = argv.includes('--all');
const nFlag = argv.indexOf('--n');
const N = nFlag >= 0 && argv[nFlag + 1] ? parseInt(argv[nFlag + 1], 10) : 30;

let lines;
try {
  lines = fs.readFileSync(LEDGER, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
} catch {
  console.error(`Cannot read ${LEDGER}`);
  process.exit(1);
}

const window = all ? lines : lines.slice(-N);
let requested = 0, completed = 0;
const classTotals = {};
const classByDomain = {};
let instrumentedCycles = 0;

for (const c of window) {
  requested += c.requested ?? 0;
  completed += c.completed ?? 0;
  if (c.failureClasses && typeof c.failureClasses === 'object') {
    instrumentedCycles++;
    for (const [cls, n] of Object.entries(c.failureClasses)) {
      classTotals[cls] = (classTotals[cls] ?? 0) + n;
    }
  }
  for (const f of c.failures ?? []) {
    classByDomain[f.domain] ??= {};
    classByDomain[f.domain][f.failureClass] = (classByDomain[f.domain][f.failureClass] ?? 0) + 1;
  }
}

const failed = requested - completed;
const span = `${window.length} cycles${all ? ' (all)' : ` (last ${N})`}`;
console.log(`=== failure-class report — ${span} ===`);
console.log(`completion: ${completed}/${requested} (${requested ? (100 * completed / requested).toFixed(0) : 0}%) — ${failed} failed`);
console.log(`instrumented cycles (have failureClasses): ${instrumentedCycles}/${window.length}`);

const ranked = Object.entries(classTotals).sort((a, b) => b[1] - a[1]);
if (ranked.length === 0) {
  console.log('\nNo classified failures in window (older cycles predate instrumentation).');
} else {
  const classified = ranked.reduce((a, [, n]) => a + n, 0);
  console.log(`\nfailure classes (${classified} classified):`);
  for (const [cls, n] of ranked) {
    console.log(`  ${cls.padEnd(22)} ${String(n).padStart(4)}  ${'█'.repeat(Math.round(30 * n / ranked[0][1]))}`);
  }
}

const domains = Object.keys(classByDomain).sort();
if (domains.length) {
  console.log('\nby domain:');
  for (const d of domains) {
    const cls = Object.entries(classByDomain[d]).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}×${v}`).join(', ');
    console.log(`  ${d.padEnd(10)} ${cls}`);
  }
}
