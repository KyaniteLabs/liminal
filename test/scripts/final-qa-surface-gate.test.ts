import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts/ci/final-qa-surface-gate.mjs');
const ledgerPath = path.join(repoRoot, 'docs/launch/final-qa-test-surface-ledger.json');
const launchDomains = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];

function makeReceipt(tempRoot: string, domains = launchDomains): string {
  const artifactDir = path.join(tempRoot, 'artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const receiptPath = path.join(tempRoot, 'domain-gauntlet-live.json');
  const receipt = {
    contract: 'liminal-live-creative-domain-execution-v1',
    status: domains.length === launchDomains.length ? 'pass' : 'fail',
    domains: domains.map((domain) => {
      const artifactPath = path.join(artifactDir, `${domain}.txt`);
      writeFileSync(artifactPath, `${domain} artifact`);
      return { domain, status: 'pass', artifactPath, codeBytes: 16 };
    }),
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receiptPath;
}

describe('final QA surface gate', () => {
  it('is wired as a package script and documents classified launch surfaces', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['final-qa:surface']).toBe('node scripts/ci/final-qa-surface-gate.mjs');
    expect(pkg.scripts['gui:build']).toBe('pnpm --dir gui build');
    expect(pkg.scripts['bubbletea:test']).toBe('cd bubbletea && go test ./...');
    expect(pkg.scripts['proof:live-creative-domains']).toBe('tsx scripts/proof/live-creative-domain-execution.ts');
  });

  it('passes with a complete all-domain live receipt and classified pending/skipped tests', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-'));
    try {
      const receiptPath = makeReceipt(tempRoot);
      const output = execFileSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(output).toContain('Included surfaces');
      expect(output).toContain('GUI production build');
      expect(output).toContain('Bubble Tea Go tests');
      expect(output).toContain('Creative domains: 12/12 covered');
      expect(output).toContain('Pending tests classified');
      expect(output).toContain('Skipped/gated tests classified');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails when a launch-scoped creative domain is missing from the live receipt', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-missing-'));
    try {
      const receiptPath = makeReceipt(tempRoot, launchDomains.filter((domain) => domain !== 'glsl'));
      const result = spawnSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('Missing creative-domain live artifacts: glsl');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
