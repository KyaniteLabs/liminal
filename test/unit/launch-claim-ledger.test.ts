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
      'docs/SECURITY.md',
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
    expect(features).toContain('12 Creative Domains');
    expect(features).toContain('Live-covered; release-rerun required');
  });

  it('does not retain stale final-QA blocker copy after remediation is verified', () => {
    const publicLaunchDocs = [
      readRepoFile('docs/features.html'),
      readRepoFile('docs/launch/feature-claim-ledger-2026-05-06.md'),
      readRepoFile('docs/launch/ml-feature-value-matrix.md'),
    ].join('\n');

    for (const stalePhrase of [
      'Default live proof currently covers p5, SVG, Strudel, Tone.js, and Revideo',
      'FQA-003 remains open',
      'Integration and slow CI remain red',
      'FQA-004 tracks the remaining receipt-hardening work',
    ]) {
      expect(publicLaunchDocs).not.toContain(stalePhrase);
    }
  });

  it('keeps automated PR-review placeholder language out of required-gate docs', () => {
    const prReview = readRepoFile('.github/workflows/pr-review.yml');
    const truthMatrix = readRepoFile('docs/launch/test-ci-truth-matrix-2026-05-01.md');

    expect(prReview).toContain('Informational');
    expect(prReview).not.toContain('automated review not yet implemented');
    expect(truthMatrix).not.toContain('Required automated PR review check');
    expect(truthMatrix).toContain('GitHub branch protection PR review policy');
  });

  it('keeps public security-header claims route-specific', () => {
    const security = readRepoFile('docs/SECURITY.md');
    const ledger = readRepoFile('docs/launch/feature-claim-ledger-2026-05-06.md');

    expect(security).not.toContain('All HTTP responses include:');
    expect(security).toContain('`PreviewServer` responses include');
    expect(security).toContain('X-Frame-Options: DENY');
    expect(security).toContain('Studio GUI/API/SSE responses include');
    expect(security).toContain('X-Frame-Options: SAMEORIGIN');
    expect(security).toContain("frame-ancestors 'self'");
    expect(ledger).toContain('Do not claim every HTTP response has CSP');
  });
});
