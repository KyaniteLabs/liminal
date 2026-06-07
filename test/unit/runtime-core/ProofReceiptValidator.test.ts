import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  computeProofSourceFingerprint,
  readProofSubjectGitCommit,
  validateProofReceipt,
} from '../../../src/runtime-core/ProofReceiptValidator.js';

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function commit(repoRoot: string, message: string): string {
  git(repoRoot, ['-c', 'commit.gpgsign=false', 'commit', '-m', message, '--no-gpg-sign']);
  return git(repoRoot, ['rev-parse', 'HEAD']);
}

function createRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'liminal-proof-receipt-'));
  git(repoRoot, ['init', '-q']);
  git(repoRoot, ['config', 'user.name', 'Sinter Test']);
  git(repoRoot, ['config', 'user.email', 'liminal@example.test']);
  mkdirSync(join(repoRoot, 'src'), { recursive: true });
  writeFileSync(join(repoRoot, 'src', 'app.ts'), 'export const value = 1;\n');
  git(repoRoot, ['add', 'src/app.ts']);
  commit(repoRoot, 'source');
  return repoRoot;
}

describe('ProofReceiptValidator', () => {
  it('binds committed proof receipts to the last non-proof source commit', () => {
    const repoRoot = createRepo();
    try {
      const sourceCommit = git(repoRoot, ['rev-parse', 'HEAD']);
      mkdirSync(join(repoRoot, '.omx', 'proof'), { recursive: true });
      writeFileSync(join(repoRoot, '.omx', 'proof', 'domain-gauntlet-live.json'), JSON.stringify({
        status: 'pass',
        mode: 'live-execution',
        generatedAt: new Date().toISOString(),
        gitCommit: sourceCommit,
      }));
      git(repoRoot, ['add', '-f', '.omx/proof/domain-gauntlet-live.json']);
      commit(repoRoot, 'proof only');

      const receipt = JSON.parse(readFileSync(join(repoRoot, '.omx/proof/domain-gauntlet-live.json'), 'utf8')) as Record<string, unknown>;

      expect(readProofSubjectGitCommit(repoRoot)).toBe(sourceCommit);
      expect(validateProofReceipt(repoRoot, receipt, { requiredMode: 'live-execution' }).ok).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('keeps source fingerprints stable across proof-only artifact changes', () => {
    const repoRoot = createRepo();
    try {
      const beforeProof = computeProofSourceFingerprint(repoRoot);
      mkdirSync(join(repoRoot, '.omx', 'proof'), { recursive: true });
      writeFileSync(join(repoRoot, '.omx', 'proof', 'artifact.txt'), 'proof output\n');
      git(repoRoot, ['add', '-f', '.omx/proof/artifact.txt']);
      commit(repoRoot, 'add proof artifact');

      expect(computeProofSourceFingerprint(repoRoot)).toBe(beforeProof);

      writeFileSync(join(repoRoot, 'src', 'app.ts'), 'export const value = 2;\n');

      expect(computeProofSourceFingerprint(repoRoot)).not.toBe(beforeProof);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('does not absorb untracked local scratch files into committed receipt fingerprints', () => {
    const repoRoot = createRepo();
    try {
      const cleanFingerprint = computeProofSourceFingerprint(repoRoot);

      writeFileSync(join(repoRoot, 'scratch-never-committed.txt'), 'local operator note\n');

      expect(computeProofSourceFingerprint(repoRoot)).toBe(cleanFingerprint);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
