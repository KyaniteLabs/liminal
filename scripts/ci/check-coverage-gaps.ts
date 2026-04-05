#!/usr/bin/env npx tsx
/**
 * Coverage Gap Detector — CI enforcement for pre-existing code
 *
 * Reads vitest's coverage-final.json (Istanbul format) and reports:
 * 1. Files with 0% statement coverage (completely untested)
 * 2. Modules ranked by gap size (for prioritized remediation)
 *
 * Exit codes:
 *   0 — all checks pass (or --warn mode)
 *   1 — blocking gaps found
 *
 * Usage:
 *   npx tsx scripts/ci/check-coverage-gaps.ts           # block on gaps
 *   npx tsx scripts/ci/check-coverage-gaps.ts --warn     # warn only (CI current mode)
 *   npx tsx scripts/ci/check-coverage-gaps.ts --strict    # block on ANY zero-coverage file
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ─── Config ──────────────────────────────────────────────────────────
const WARN_MODE = process.argv.includes('--warn');
const STRICT_MODE = process.argv.includes('--strict');
const COVERAGE_PATH = resolve(ROOT, 'coverage/coverage-final.json');

// Modules that are experimental/UI — deferred from enforcement
const DEFERRED_MODULES = ['src/gui/', 'src/tui/', 'src/narrative/'];

// ─── Main ────────────────────────────────────────────────────────────
if (!existsSync(COVERAGE_PATH)) {
  console.error('❌ coverage/coverage-final.json not found. Run pnpm test:coverage first.');
  process.exit(1);
}

const coverage: Record<string, IstanbulFileCoverage> = JSON.parse(readFileSync(COVERAGE_PATH, 'utf-8'));

interface IstanbulFileCoverage {
  path: string;
  statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
  fnMap: Record<string, { name: string }>;
  branchMap: Record<string, unknown>;
  s: Record<string, number>; // statement execution counts
  f: Record<string, number>; // function execution counts
  b: Record<string, number[]>; // branch execution counts
}

// Extract relative path and compute coverage from Istanbul data
const files: Array<{ path: string; stmtTotal: number; stmtCovered: number; fnTotal: number; fnCovered: number; stmtPct: number }> = [];

for (const [absPath, cov] of Object.entries(coverage)) {
  const relPath = relative(ROOT, absPath);
  if (!relPath.startsWith('src/')) continue;
  if (relPath.endsWith('.d.ts') || relPath.endsWith('.test.ts')) continue;

  const stmtEntries = Object.values(cov.s);
  const fnEntries = Object.values(cov.f);
  const stmtTotal = stmtEntries.length;
  const stmtCovered = stmtEntries.filter(v => v > 0).length;
  const fnTotal = fnEntries.length;
  const fnCovered = fnEntries.filter(v => v > 0).length;
  const stmtPct = stmtTotal === 0 ? 100 : Math.round((stmtCovered / stmtTotal) * 10000) / 100;

  files.push({ path: relPath, stmtTotal, stmtCovered, fnTotal, fnCovered, stmtPct });
}

const zeroCov = files.filter(f => f.stmtPct === 0);
const lowCov = files.filter(f => f.stmtPct > 0 && f.stmtPct < 50);
const goodCov = files.filter(f => f.stmtPct >= 50);

// Separate deferred vs critical
const criticalZeros = zeroCov.filter(f => !DEFERRED_MODULES.some(d => f.path.startsWith(d)));
const deferredZeros = zeroCov.filter(f => DEFERRED_MODULES.some(d => f.path.startsWith(d)));

// ─── Report ──────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Coverage Gap Report');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Module grouping
const byModule: Record<string, { total: number; zero: number; low: number; avgPct: number }> = {};
for (const f of files) {
  const mod = f.path.split('/').slice(0, 2).join('/');
  if (!byModule[mod]) byModule[mod] = { total: 0, zero: 0, low: 0, avgPct: 0 };
  byModule[mod].total++;
  byModule[mod].avgPct += f.stmtPct;
  if (f.stmtPct === 0) byModule[mod].zero++;
  if (f.stmtPct > 0 && f.stmtPct < 50) byModule[mod].low++;
}
for (const mod of Object.keys(byModule)) {
  byModule[mod].avgPct = Math.round(byModule[mod].avgPct / byModule[mod].total * 10) / 10;
}

console.log('  Module Coverage Summary:');
console.log('  ─────────────────────────────────────────────────────────');
console.log('  Module                  Files   0%  <50%   Avg%');
console.log('  ─────────────────────────────────────────────────────────');
for (const [mod, info] of Object.entries(byModule).sort((a, b) => a[1].avgPct - b[1].avgPct)) {
  const deferred = DEFERRED_MODULES.some(d => mod.startsWith(d)) ? ' deferred' : '';
  const flag = info.zero > 0 ? '!! ' : '   ';
  console.log(`  ${flag}${mod.padEnd(24)} ${String(info.total).padStart(4)}  ${String(info.zero).padStart(3)}  ${String(info.low).padStart(3)}  ${String(info.avgPct).padStart(6)}%${deferred}`);
}
console.log('');

// Critical zeros (actionable list)
if (criticalZeros.length > 0) {
  console.log(`  !! ${criticalZeros.length} critical files with 0% coverage:`);
  for (const f of criticalZeros.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`     ${f.path} (${f.stmtTotal} statements, ${f.fnTotal} functions)`);
  }
  console.log('');
}

// Deferred zeros
if (deferredZeros.length > 0) {
  console.log(`  .. ${deferredZeros.length} deferred files with 0% coverage (GUI/TUI/narrative):`);
  for (const f of deferredZeros.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`     ${f.path}`);
  }
  console.log('');
}

// ─── Verdict ─────────────────────────────────────────────────────────
const totalFiles = files.length;
const coveredFiles = files.filter(f => f.stmtPct > 0).length;
const pct = ((coveredFiles / totalFiles) * 100).toFixed(1);

console.log('═══════════════════════════════════════════════════════════');
console.log(`  ${coveredFiles}/${totalFiles} src files have at least 1 test (${pct}%)`);
console.log(`  ${criticalZeros.length} critical gaps, ${deferredZeros.length} deferred, ${lowCov.length} below 50%`);
console.log('═══════════════════════════════════════════════════════════');
console.log('');

if (WARN_MODE) {
  if (criticalZeros.length > 0) {
    console.log(`  WARN: ${criticalZeros.length} files at 0% (not blocking in --warn mode)`);
  } else {
    console.log('  OK: No critical coverage gaps');
  }
  process.exit(0);
} else if (STRICT_MODE) {
  const allZeros = [...criticalZeros, ...deferredZeros];
  if (allZeros.length > 0) {
    console.log(`  FAIL: ${allZeros.length} files at 0% coverage (--strict mode, no exceptions).`);
    process.exit(1);
  } else {
    console.log('  OK: All files have at least 1 test (strict mode)');
    process.exit(0);
  }
} else {
  // Default: block on critical gaps only
  if (criticalZeros.length > 0) {
    console.log(`  FAIL: ${criticalZeros.length} files at 0% coverage. Add at least 1 test per file.`);
    console.log('  Use --warn to downgrade to warning, --strict to include deferred modules.');
    process.exit(1);
  } else {
    console.log('  OK: All critical files have at least 1 test');
    process.exit(0);
  }
}
