import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

interface MlValueProofReport {
  status: 'pass' | 'fail';
  executed: boolean;
  blockers: string[];
  features: Array<{ id: string; launchLabel: string; proofOutcome: string; effectiveLabel: string }>;
  summary: { proven: number; provenVerified: number; provenFailed: number; provenUnverified: number };
}

// Runs the proof script tolerating the non-zero exit it uses to signal a
// failing proof, then reads the report the script always writes.
async function runMlValueProof(args: string[]): Promise<MlValueProofReport> {
  try {
    await execFileAsync('pnpm', ['tsx', 'scripts/proof/ml-value-proof.ts', ...args], { cwd: process.cwd() });
  } catch {
    // non-zero exit is expected when the proof fails; the report is still written
  }
  const reportPath = join(process.cwd(), '.omx', 'proof', 'ml-value-proof.json');
  return JSON.parse(await readFile(reportPath, 'utf8')) as MlValueProofReport;
}

describe('ml-value proof script', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  });

  async function tempFeatures(features: unknown): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'sinter-ml-value-'));
    tempDirs.push(dir);
    const file = join(dir, 'features.json');
    await writeFile(file, JSON.stringify(features), 'utf8');
    return file;
  }

  it('reports a claimed-proven feature as proven only when its proof command actually passes', async () => {
    const features = await tempFeatures([
      { id: 'ok-feat', proofCommand: 'node -e process.exit(0)', baseline: 'b', enabled: 'e', metric: 'm', status: 'proven' },
    ]);

    const report = await runMlValueProof(['--features', features]);

    expect(report.executed).toBe(true);
    expect(report.status).toBe('pass');
    const feat = report.features.find(f => f.id === 'ok-feat');
    expect(feat?.proofOutcome).toBe('passed');
    expect(feat?.effectiveLabel).toBe('proven');
    expect(report.summary.provenVerified).toBe(1);
    expect(report.summary.provenFailed).toBe(0);
  });

  it('FAILS when a feature is claimed proven but its proof command fails', async () => {
    const features = await tempFeatures([
      { id: 'bad-feat', proofCommand: 'node -e process.exit(1)', baseline: 'b', enabled: 'e', metric: 'm', status: 'proven' },
    ]);

    const report = await runMlValueProof(['--features', features]);

    expect(report.status).toBe('fail');
    const feat = report.features.find(f => f.id === 'bad-feat');
    // The hardcoded "proven" claim is downgraded to "unproven" by the real run.
    expect(feat?.proofOutcome).toBe('failed');
    expect(feat?.effectiveLabel).toBe('unproven');
    expect(report.summary.provenFailed).toBe(1);
    expect(report.blockers.some(b => b.includes('bad-feat') && b.includes('proof command failed'))).toBe(true);
  });

  it('does not rubber-stamp a "proven" claim when execution is skipped', async () => {
    const features = await tempFeatures([
      { id: 'unrun-feat', proofCommand: 'node -e process.exit(0)', baseline: 'b', enabled: 'e', metric: 'm', status: 'proven' },
    ]);

    const report = await runMlValueProof(['--features', features, '--skip-exec']);

    expect(report.executed).toBe(false);
    expect(report.status).toBe('fail');
    const feat = report.features.find(f => f.id === 'unrun-feat');
    expect(feat?.proofOutcome).toBe('skipped');
    expect(feat?.effectiveLabel).toBe('unverified');
    expect(report.summary.provenUnverified).toBe(1);
  });
});
