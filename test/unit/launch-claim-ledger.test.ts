import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const claimLedgerPath = path.join(repoRoot, 'docs/launch/feature-claim-ledger-2026-05-06.md');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('launch claim truth ledger', () => {
  it('records the public claim surfaces audited by final QA', () => {
    expect(fs.existsSync(claimLedgerPath)).toBe(true);

    const ledger = fs.readFileSync(claimLedgerPath, 'utf8');
    for (const auditedSurface of [
      'docs/features.html',
      'docs/launch/ml-feature-value-matrix.md',
      'docs/launch/test-ci-truth-matrix-2026-05-01.md',
      '.github/workflows/ci.yml',
      '.github/workflows/pr-review.yml',
    ]) {
      expect(ledger).toContain(auditedSurface);
    }
  });

  it('does not present partially proved launch claims as complete public proof', () => {
    const features = readRepoFile('docs/features.html');

    expect(features).toContain('feature-claim-ledger-2026-05-06.md');
    expect(features).not.toContain('<tr><td>11 Generators</td><td><span class="badge badge-success">Complete</span></td>');
    expect(features).not.toContain('<tr><td>Self-Improving Harness</td><td><span class="badge badge-success">Complete</span></td>');
  });

  it('keeps automated PR-review placeholder language out of required-gate docs', () => {
    const prReview = readRepoFile('.github/workflows/pr-review.yml');
    const truthMatrix = readRepoFile('docs/launch/test-ci-truth-matrix-2026-05-01.md');

    expect(prReview).toContain('Informational');
    expect(prReview).not.toContain('automated review not yet implemented');
    expect(truthMatrix).not.toContain('Required automated PR review check');
    expect(truthMatrix).toContain('GitHub branch protection PR review policy');
  });
});
