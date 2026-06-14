#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildMlFeatureValueMatrix, type MlFeatureInput, type MlFeatureValue } from '../../src/improvement/OpportunityScanner.js';

/**
 * ML value proof.
 *
 * The launch label (`proven` / `experimental` / `hidden`) carried by the
 * feature matrix is a *claim*. This script does not trust that claim: for every
 * feature that declares a proof command, it actually RUNS the command and
 * records the real exit outcome. A feature can only be reported as "proven"
 * when its declared status is `proven` AND its proof command actually passed.
 * If a command fails, the feature is downgraded to `unproven`; if it cannot be
 * executed at all, it is reported as `unverified` — never silently "proven".
 */

type ExecOutcome = 'passed' | 'failed' | 'unverified' | 'skipped';

type EffectiveLabel = MlFeatureValue['launchLabel'] | 'unproven' | 'unverified';

interface ProvenFeatureResult extends MlFeatureValue {
  /** Real outcome of running the proof command. */
  proofOutcome: ExecOutcome;
  /** Label after reconciling the claimed launch label with the real proof outcome. */
  effectiveLabel: EffectiveLabel;
  exitCode: number | null;
  durationMs: number;
  detail: string;
}

const repoRoot = process.cwd();
const argv = process.argv.slice(2);
const skipExec = argv.includes('--skip-exec') || process.env.SINTER_ML_VALUE_SKIP_EXEC === '1';
const perCommandTimeoutMs = Number(process.env.SINTER_ML_VALUE_TIMEOUT_MS ?? 180_000);

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

// Optional override of the feature list for testing the real-execution path
// without running the entire test suite. Production runs use DEFAULT_ML_FEATURES.
const featuresPath = getArg('features') ?? process.env.SINTER_ML_VALUE_FEATURES?.trim();
const overrideFeatures: MlFeatureInput[] | undefined = featuresPath
  ? (JSON.parse(fs.readFileSync(featuresPath, 'utf8')) as MlFeatureInput[])
  : undefined;

function runProofCommand(command: string): { outcome: ExecOutcome; exitCode: number | null; durationMs: number; detail: string } {
  // proofCommand is e.g. "pnpm test -- ModelRouter RoutingData"
  const parts = command.trim().split(/\s+/);
  const bin = parts[0];
  const args = parts.slice(1);
  const started = Date.now();
  const result = spawnSync(bin, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: perCommandTimeoutMs,
    env: { ...process.env, CI: '1' },
  });
  const durationMs = Date.now() - started;
  if (result.error) {
    const reason = result.error instanceof Error ? result.error.message : String(result.error);
    return { outcome: 'unverified', exitCode: result.status, durationMs, detail: `proof command could not run: ${reason}` };
  }
  if (result.status === 0) {
    return { outcome: 'passed', exitCode: 0, durationMs, detail: 'proof command exited 0' };
  }
  const tail = (result.stderr || result.stdout || '').trim().split('\n').slice(-3).join(' | ');
  return { outcome: 'failed', exitCode: result.status, durationMs, detail: `proof command exited ${result.status}: ${tail}` };
}

const matrix = overrideFeatures ? buildMlFeatureValueMatrix(overrideFeatures) : buildMlFeatureValueMatrix();
const results: ProvenFeatureResult[] = matrix.map((feature) => {
  if (!feature.proofCommand.trim()) {
    return { ...feature, proofOutcome: 'unverified', effectiveLabel: 'unverified', exitCode: null, durationMs: 0, detail: 'no proof command declared' };
  }
  if (skipExec) {
    return { ...feature, proofOutcome: 'skipped', effectiveLabel: 'unverified', exitCode: null, durationMs: 0, detail: 'execution skipped (--skip-exec); claim not verified' };
  }
  const exec = runProofCommand(feature.proofCommand);
  // Reconcile the claimed label with the real outcome. A "proven" claim only
  // stands if the proof command actually passed.
  let effectiveLabel: EffectiveLabel;
  if (exec.outcome === 'passed') {
    effectiveLabel = feature.launchLabel;
  } else if (exec.outcome === 'failed') {
    effectiveLabel = 'unproven';
  } else {
    effectiveLabel = 'unverified';
  }
  return { ...feature, proofOutcome: exec.outcome, effectiveLabel, exitCode: exec.exitCode, durationMs: exec.durationMs, detail: exec.detail };
});

const provenFeatures = results.filter((r) => r.launchLabel === 'proven');
const provenVerified = provenFeatures.filter((r) => r.proofOutcome === 'passed').length;
const provenFailed = provenFeatures.filter((r) => r.proofOutcome === 'failed').length;
const provenUnverified = provenFeatures.filter((r) => r.proofOutcome === 'unverified' || r.proofOutcome === 'skipped').length;

// Honest status: the proof passes only if every feature CLAIMED as "proven"
// actually had its proof command pass. A claimed-proven feature that fails or
// cannot be verified makes the whole proof fail.
const status: 'pass' | 'fail' = provenFeatures.length > 0 && provenFailed === 0 && provenUnverified === 0 ? 'pass' : 'fail';
const blockers: string[] = [];
if (provenFeatures.length === 0) blockers.push('No feature is claimed as proven; nothing to verify');
for (const r of provenFeatures) {
  if (r.proofOutcome === 'failed') blockers.push(`${r.id}: claimed proven but proof command failed (${r.detail})`);
  if (r.proofOutcome === 'unverified' || r.proofOutcome === 'skipped') blockers.push(`${r.id}: claimed proven but proof not executed (${r.detail})`);
}

const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'ml-value-proof.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  status,
  executed: !skipExec,
  blockers,
  features: results,
  summary: {
    proven: results.filter((feature) => feature.launchLabel === 'proven').length,
    experimental: results.filter((feature) => feature.launchLabel === 'experimental').length,
    hidden: results.filter((feature) => feature.launchLabel === 'hidden').length,
    provenVerified,
    provenFailed,
    provenUnverified,
  },
}, null, 2)}\n`, 'utf-8');

console.log(`ML value proof written: ${outPath} (status=${status})`);
for (const feature of results) {
  console.log(`${feature.id}: claimed=${feature.launchLabel} proof=${feature.proofOutcome} -> ${feature.effectiveLabel} | ${feature.metric || 'no metric'}`);
}
if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`blocker: ${blocker}`);
}
if (status !== 'pass') process.exit(1);
