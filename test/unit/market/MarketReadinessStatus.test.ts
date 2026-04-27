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
    expect(status.checks.find((check) => check.id === 'live-provider-smoke')).toBeDefined();
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

});
