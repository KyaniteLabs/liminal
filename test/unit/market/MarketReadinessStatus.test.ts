import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMarketReadinessStatus, collectRepositoryMarketReadinessStatus, formatMarketReadinessStatus } from '../../../src/market/MarketReadinessStatus.js';

describe('MarketReadinessStatus', () => {
  it('answers plainly whether Sinter is market ready and lists blocking gaps', () => {
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

  it('does not let source-presence (advisory) checks gate the READY verdict', () => {
    // All advisory "pass" signals — grep hits only, no execution-verified check.
    const status = buildMarketReadinessStatus({
      checks: [
        { id: 'natural-cli', label: 'Natural CLI front door', status: 'advisory', evidence: 'source-presence (not execution-verified): found x' },
        { id: 'creative-wrappers', label: 'Creative wrappers', status: 'advisory', evidence: 'source-presence (not execution-verified): found y' },
      ],
    });

    expect(status.ready).toBe(false);
    expect(status.verdict).toBe('not-ready');
    expect(status.blockers).toEqual([]);
  });

  it('marks the READY verdict solely on execution-verified receipt checks', () => {
    const status = buildMarketReadinessStatus({
      checks: [
        // Advisory source checks are present but must not count toward the verdict.
        { id: 'natural-cli', label: 'Natural CLI front door', status: 'advisory', evidence: 'source-presence (not execution-verified): missing z' },
        { id: 'studio-smoke', label: 'Studio smoke', status: 'pass', evidence: 'Found passing receipt' },
        { id: 'live-provider-smoke', label: 'Live provider smoke', status: 'pass', evidence: 'Found passing receipt' },
      ],
    });

    expect(status.ready).toBe(true);
    expect(status.verdict).toBe('ready');
    expect(status.blockers).toEqual([]);
  });

  it('separates execution-verified checks from advisory source-presence checks in the output', () => {
    const status = buildMarketReadinessStatus({
      checks: [
        { id: 'natural-cli', label: 'Natural CLI front door', status: 'advisory', evidence: 'source-presence (not execution-verified): found x' },
        { id: 'live-provider-smoke', label: 'Live provider smoke', status: 'fail', evidence: 'No current live provider smoke receipt found' },
      ],
    });

    const formatted = formatMarketReadinessStatus(status);
    expect(formatted).toContain('Execution-verified checks (gate the verdict):');
    expect(formatted).toContain('Source-presence checks (advisory — do NOT gate the verdict):');
    expect(formatted).toContain('Natural CLI front door: advisory — source-presence (not execution-verified): found x');
    expect(formatted).toContain('Live provider smoke: fail — No current live provider smoke receipt found');
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
      'studio-smoke',
      'live-provider-smoke',
    ]));
    expect(status.checks.find((check) => check.id === 'live-provider-smoke')).not.toBeNull();
  });

  it('keeps the source-presence checks advisory so grep hits cannot fabricate READY', () => {
    // The worktree's source contains every literal the five grep checks look for,
    // but ships no proof receipts. The verdict must come ONLY from the receipts.
    const status = collectRepositoryMarketReadinessStatus(process.cwd());

    const sourceCheckIds = ['natural-cli', 'creative-wrappers', 'studio-cognition', 'cli-cognition', 'level6-gate'];
    for (const id of sourceCheckIds) {
      const check = status.checks.find((c) => c.id === id);
      expect(check?.status).toBe('advisory');
      // An advisory check never appears as a blocker, even when its literals are present.
      expect(status.blockers).not.toContain(`${check?.label}: ${check?.evidence}`);
    }

    // No fresh receipts in this worktree → not ready, blocked only by the receipt checks.
    expect(status.ready).toBe(false);
    expect(status.blockers.some((b) => b.startsWith('Live provider smoke'))).toBe(true);
    expect(status.blockers.some((b) => b.startsWith('Studio smoke'))).toBe(true);
  });

  it('reaches READY only when both receipt-backed checks pass, regardless of source presence', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));
    const gitCommit = writeFakeGitHead(repoRoot);
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });

    // Live provider smoke receipt bound to the commit with a real artifact.
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

    // Studio smoke receipt bound to the commit.
    fs.writeFileSync(path.join(proofDir, 'studio-smoke.json'), JSON.stringify({
      status: 'pass',
      generatedAt: new Date().toISOString(),
      gitCommit,
      checks: { backendHealth: true, noConsoleErrors: true, studioHeading: true, stageNav: true },
      blockers: [],
    }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);

    // This temp repo has NO source literals at all → the advisory checks "miss" them,
    // yet the verdict is READY because both receipt-backed checks pass.
    expect(status.checks.find((c) => c.id === 'natural-cli')?.status).toBe('advisory');
    expect(status.checks.find((c) => c.id === 'live-provider-smoke')?.status).toBe('pass');
    expect(status.checks.find((c) => c.id === 'studio-smoke')?.status).toBe('pass');
    expect(status.ready).toBe(true);
    expect(status.blockers).toEqual([]);
  });

  it('does not accept a stale or failed live-provider receipt as market-ready', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(path.join(proofDir, 'live-provider-smoke.json'), JSON.stringify({ status: 'fail', blockers: ['bad output'] }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);
    const liveSmoke = status.checks.find((check) => check.id === 'live-provider-smoke');

    expect(liveSmoke?.status).toBe('fail');
    expect(liveSmoke?.evidence).toContain('Live provider smoke receipt status fail');
  });

  it('rejects passing live-provider receipts without commit and artifact proof', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));
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
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));
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

  it('does not accept a missing or failed studio-smoke receipt as market-ready', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));

    // No receipt at all → the gate can no longer pass on the script merely existing.
    let status = collectRepositoryMarketReadinessStatus(repoRoot);
    let studio = status.checks.find((check) => check.id === 'studio-smoke');
    expect(studio?.status).toBe('fail');
    expect(studio?.evidence).toContain('No studio smoke receipt found');

    // A failed run is honestly reported as failing.
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(path.join(proofDir, 'studio-smoke.json'), JSON.stringify({ status: 'fail', blockers: ['noConsoleErrors'] }));
    status = collectRepositoryMarketReadinessStatus(repoRoot);
    studio = status.checks.find((check) => check.id === 'studio-smoke');
    expect(studio?.status).toBe('fail');
    expect(studio?.evidence).toContain('Studio smoke receipt status fail');
  });

  it('accepts a fresh studio-smoke receipt bound to the current commit', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sinter-market-'));
    const gitCommit = writeFakeGitHead(repoRoot);
    const proofDir = path.join(repoRoot, '.omx', 'proof');
    fs.mkdirSync(proofDir, { recursive: true });
    fs.writeFileSync(path.join(proofDir, 'studio-smoke.json'), JSON.stringify({
      status: 'pass',
      generatedAt: new Date().toISOString(),
      gitCommit,
      checks: { backendHealth: true, noConsoleErrors: true, studioHeading: true, stageNav: true },
      blockers: [],
    }));

    const status = collectRepositoryMarketReadinessStatus(repoRoot);
    const studio = status.checks.find((check) => check.id === 'studio-smoke');
    expect(studio?.status).toBe('pass');
    expect(studio?.evidence).toContain('studio-smoke.json');
  });
});
