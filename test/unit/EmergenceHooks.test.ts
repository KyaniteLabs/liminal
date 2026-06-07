import { describe, it, expect } from 'vitest';
import { EmergenceHooks } from '../../src/emergence/EmergenceHooks.js';
import { SinterFS } from '../../src/fs/SinterFS.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'os';
import { join } from 'path';

const emergenceHooksTestTimeoutMs = 30000;

describe('EmergenceHooks', () => {
  let tmpDir: string;
  let liminalFs: SinterFS;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sinter-hooks-test-'));
    liminalFs = SinterFS.open(tmpDir);
  });

  afterEach(() => {
    liminalFs.close?.();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('processes a fresh-generation creative run', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    const result = await hooks.onCreativeRun({
      output: 'function draw() { background(0); circle(100, 100, 50); }',
      qualityScore: 0.8,
      provenance: 'fresh-generation',
      seed: 'test-seed',
    });

    expect(result.descriptor.values).toHaveLength(6);
    expect(result.lineage.provenance).toBe('fresh-generation');
    expect(result.lineage.parentIds).toEqual([]);
    expect(result.signals.novelty).toBeGreaterThan(0);
    expect(result.signals.novelty).toBeLessThanOrEqual(1);
    expect(result.placement.accepted).toBe(true);
    expect(result.placement.outcome).toBe('new-cell');
  }, emergenceHooksTestTimeoutMs);

  it('rejects low-quality artifacts', async () => {
    const hooks = new EmergenceHooks(liminalFs, { minQuality: 0.5 });
    const result = await hooks.onCreativeRun({
      output: 'x',
      qualityScore: 0.1,
      provenance: 'fresh-generation',
    });

    expect(result.placement.accepted).toBe(false);
    expect(result.placement.outcome).toBe('rejected');
  }, emergenceHooksTestTimeoutMs);

  it('tracks lineage for remix runs', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    const parent = await hooks.onCreativeRun({
      output: 'const parent = true;',
      qualityScore: 0.7,
      provenance: 'fresh-generation',
    });

    const child = await hooks.onCreativeRun({
      output: 'const child = true; const parent = true;',
      qualityScore: 0.8,
      provenance: 'remix',
      parentIds: [parent.lineage.artifactId],
    });

    expect(child.lineage.parentIds).toEqual([parent.lineage.artifactId]);
    expect(child.lineage.provenance).toBe('remix');
  }, emergenceHooksTestTimeoutMs);

  it('emergence signals are all in 0–1 range', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    const result = await hooks.onCreativeRun({
      output: 'function draw() { let t = frameCount * 0.01; animate(t); }',
      qualityScore: 0.85,
      provenance: 'fresh-generation',
    });

    const { signals } = result;
    for (const key of Object.keys(signals) as Array<keyof typeof signals>) {
      expect(signals[key]).toBeGreaterThanOrEqual(0);
      expect(signals[key]).toBeLessThanOrEqual(1);
    }
  }, emergenceHooksTestTimeoutMs);

  it('exposes archive for querying', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    await hooks.onCreativeRun({
      output: 'test output',
      qualityScore: 0.7,
      provenance: 'fresh-generation',
    });

    const stats = hooks.getArchive().getStats();
    expect(stats.totalCells).toBe(1);
    expect(stats.totalElites).toBe(1);
  }, emergenceHooksTestTimeoutMs);

  it('exposes lineage tracker for querying', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    await hooks.onCreativeRun({
      output: 'test output',
      qualityScore: 0.7,
      provenance: 'fresh-generation',
    });

    // The lineage tracker should have at least 1 record
    const tracker = hooks.getLineageTracker();
    const stats = await tracker.getStats();
    expect(stats.totalRecords).toBeGreaterThanOrEqual(1);
  }, emergenceHooksTestTimeoutMs);

  it('exposes extractor for querying', async () => {
    const hooks = new EmergenceHooks(liminalFs);
    expect(hooks.getExtractor().getAvailableAxes()).toHaveLength(6);
  }, emergenceHooksTestTimeoutMs);
});

import { beforeEach, afterEach } from 'vitest';
