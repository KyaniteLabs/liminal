import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMarketReadinessStatus, collectRepositoryMarketReadinessStatus, formatMarketReadinessStatus } from '../../../src/market/MarketReadinessStatus.js';

describe('MarketReadinessStatus', () => {
  it('answers plainly whether Liminal is market ready and lists blocking gaps', () => {
    const status = buildMarketReadinessStatus({
      checks: [
        { id: 'natural-cli', label: 'Natural CLI front door', status: 'pass', evidence: 'PR #366' },
        { id: 'studio-cognition', label: 'Studio learning receipts', status: 'pass', evidence: 'PR #367' },
        { id: 'live-smoke', label: 'Live end-to-end smoke', status: 'fail', evidence: 'No current live provider smoke attached' },
      ],
    });

    expect(status.ready).toBe(false);
    expect(status.verdict).toBe('not-ready');
    expect(status.blockers).toEqual(['Live end-to-end smoke: No current live provider smoke attached']);
  });

  it('formats a market-readiness status for humans', () => {
    const status = buildMarketReadinessStatus({
      checks: [
        { id: 'a', label: 'A', status: 'pass', evidence: 'ok' },
        { id: 'b', label: 'B', status: 'unknown', evidence: 'not checked' },
      ],
    });

    expect(formatMarketReadinessStatus(status)).toContain('Market readiness: NOT READY');
    expect(formatMarketReadinessStatus(status)).toContain('B: unknown — not checked');
  });
});

describe('collectRepositoryMarketReadinessStatus', () => {
  function writeFakeGitHead(repoRoot: string, commit = 'a'.repeat(40)): string {
    const refsDir = path.join(repoRoot, '.git', 'refs', 'heads');
    fs.mkdirSync(refsDir, { recursive: true });
    fs.writeFileSync(path.join(repoRoot, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    fs.writeFileSync(path.join(refsDir, 'main'), `${commit}\n`);
    return commit;
  }

  it('checks the real repository surfaces without running slow provider calls', () => {
    const status = collectRepositoryMarketReadinessStatus(process.cwd());

    expect(status.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'natural-cli',
      'creative-wrappers',
      'studio-cognition',
      'cli-cognition',
      'studio-smoke-script',
      'live-provider-smoke',
    ]));
    expect(status.checks.find((check) => check.id === 'live-provider-smoke')).not.toBeNull();
  });

  it('does not accept a stale or failed live-provider receipt as market-ready', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-market-'));
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(path.join(proofDir, 'live-provider-smoke.json'), JSON.stringify({ status: 'fail', blockers: ['bad output'] }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);
    const liveSmoke = status.checks.find((check) => check.id === 'live-provider-smoke');

    expect(liveSmoke?.status).toBe('fail');
    expect(liveSmoke?.evidence).toContain('Live provider smoke receipt status fail');
  });

  it('rejects passing live-provider receipts without commit and artifact proof', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-market-'));
    writeFakeGitHead(repoRoot);
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(path.join(proofDir, 'live-provider-smoke.json'), JSON.stringify({
      status: 'pass',
      generatedAt: new Date().toISOString(),
      provider: 'glm',
      model: 'glm-5v-turbo',
      artifactPath: '.omx/proof/live-provider-smoke/p5.js',
    }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);
    const liveSmoke = status.checks.find((check) => check.id === 'live-provider-smoke');

    expect(liveSmoke?.status).toBe('fail');
    expect(liveSmoke?.evidence).toContain('missing gitCommit');
  });

  it('accepts a fresh live-provider receipt bound to the current commit and artifact', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-market-'));
    const gitCommit = writeFakeGitHead(repoRoot);
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    const artifactPath = path.join(proofDir, 'live-provider-smoke', 'p5.js');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, 'function setup() { createCanvas(100, 100); }\n');
    fs.writeFileSync(path.join(proofDir, 'live-provider-smoke.json'), JSON.stringify({
      status: 'pass',
      generatedAt: new Date().toISOString(),
      gitCommit,
      provider: 'glm',
      model: 'glm-5v-turbo',
      artifactPath: '.omx/proof/live-provider-smoke/p5.js',
    }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);
    const liveSmoke = status.checks.find((check) => check.id === 'live-provider-smoke');

    expect(liveSmoke?.status).toBe('pass');
    expect(liveSmoke?.evidence).toContain('glm/glm-5v-turbo');
  });
});
