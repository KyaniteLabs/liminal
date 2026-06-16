/**
 * RSI gap #2 — the autonomy garden must accumulate persisted emergence
 * experience across cycles instead of starting cold.
 *
 * Exercises the real data flow end-to-end: EmergenceHooks/ArchiveEntries write
 * archive entries to SinterFS → SinterFS.listRefs enumerates them →
 * ArchiveEntriesFSAdapter.readAllArchiveEntries reads them back →
 * EmergenceHooks.hydrateArchive rebuilds cells via ArchivePlacement → the
 * AutonomousGardener plans a cycle over those cells (the exact getCells seam
 * TuiBridgeService wires into gardener.start()).
 *
 * Each test gets its own throwaway SinterFS root via SINTER_PROJECT_ROOT
 * (the helper added in #605), so nothing touches the repo tree.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SinterFS } from '../../src/fs/SinterFS.js';
import { resolveSinterProjectRoot } from '../../src/fs/projectRoot.js';
import { EmergenceHooks } from '../../src/emergence/EmergenceHooks.js';
import { ArchiveEntriesFSAdapter } from '../../src/fs/adapters/ArchiveEntries.js';
import { AutonomousGardener } from '../../src/autonomy/AutonomousGardener.js';
import type { ArchiveEntry } from '../../src/emergence/types.js';

/**
 * Build a persisted-shape ArchiveEntry. The id mimics the real key the system
 * writes (`sinter://artifact/<id>`, which nests on disk) so the read path is
 * exercised against the production ref-name format. The order-chaos value picks
 * the cell: with 10 bins, 0.05/0.45/0.95 land in bins 0/4/9 → distinct cells.
 */
function makeEntry(suffix: string, orderChaos: number): ArchiveEntry {
  const id = `sinter://artifact/${suffix}`;
  return {
    id,
    artifactRef: { uri: id, hash: suffix, kind: 'generated-code' },
    descriptor: {
      values: [{ axis: 'order-chaos', value: orderChaos }],
      source: 'test',
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
    lineage: {
      artifactId: suffix,
      parentIds: [],
      provenance: 'fresh-generation',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    qualityScore: 0.9,
    signals: {
      novelty: 0.5,
      structure: 0.5,
      temporalRichness: 0.5,
      perturbationResilience: 0.5,
      fertility: 0.5,
      aesthetic: 0.5,
    },
    archivedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('garden archive hydration (RSI gap #2: cross-cycle accumulation)', () => {
  let tmpRoot: string;
  let savedRoot: string | undefined;

  beforeEach(() => {
    savedRoot = process.env.SINTER_PROJECT_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), 'garden-hydration-test-'));
    process.env.SINTER_PROJECT_ROOT = tmpRoot;
  });

  afterEach(() => {
    if (savedRoot !== undefined) process.env.SINTER_PROJECT_ROOT = savedRoot;
    else delete process.env.SINTER_PROJECT_ROOT;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('first-ever cycle hydrates an empty store to [] without throwing', () => {
    const fs = SinterFS.open(resolveSinterProjectRoot());
    const hooks = new EmergenceHooks(fs);
    const gardener = new AutonomousGardener({ totalBudget: 1000 });

    const cold = hooks.hydrateArchive();
    expect(cold).toEqual([]);
    // Driving a cycle over the cold archive must not throw.
    expect(() => gardener.cycle(cold, [])).not.toThrow();

    fs.close();
  });

  it('cycle 2 sees experience persisted before it: hydrated count (3) > cold count (0)', () => {
    const fs = SinterFS.open(resolveSinterProjectRoot());
    const hooks = new EmergenceHooks(fs);
    const gardener = new AutonomousGardener({ totalBudget: 1000 });

    // getCells is exactly what TuiBridgeService wires into gardener.start().
    const seenCellCounts: number[] = [];
    const getCells = () => {
      const cells = hooks.hydrateArchive();
      seenCellCounts.push(cells.length);
      return cells;
    };

    // ── Cycle 1: cold — the store is empty ──
    gardener.cycle(getCells(), []);

    // ── A creative run persists emergence experience between the cycles.
    // This is the exact persistence call EmergenceHooks.onCreativeRun makes. ──
    const writer = new ArchiveEntriesFSAdapter(fs);
    writer.writeArchiveEntry(makeEntry('a', 0.05)); // order-chaos bin 0
    writer.writeArchiveEntry(makeEntry('b', 0.45)); // order-chaos bin 4
    writer.writeArchiveEntry(makeEntry('c', 0.95)); // order-chaos bin 9

    // ── Cycle 2: hydrated from SinterFS ──
    gardener.cycle(getCells(), []);

    expect(seenCellCounts[0]).toBe(0); // cold start
    expect(seenCellCounts[1]).toBe(3); // 3 distinct cells hydrated
    expect(seenCellCounts[1]).toBeGreaterThan(seenCellCounts[0]); // accumulation

    fs.close();
  });

  it('hydrates experience written by the real onCreativeRun path, read from disk', async () => {
    const writeFs = SinterFS.open(resolveSinterProjectRoot());
    const writeHooks = new EmergenceHooks(writeFs);
    expect(writeHooks.hydrateArchive()).toEqual([]); // empty store first

    await writeHooks.onCreativeRun({
      output:
        'function setup(){createCanvas(400,400);noLoop();} function draw(){background(20);for(let i=0;i<200;i++){circle(random(400),random(400),random(2,9));}}',
      qualityScore: 0.95,
      provenance: 'fresh-generation',
      runId: 'hydration-real-path',
    });
    writeFs.close();

    // Re-open with a FRESH SinterFS + hooks to prove hydration reads from disk,
    // not from the in-memory archive the write instance happened to hold.
    const readFs = SinterFS.open(resolveSinterProjectRoot());
    const cells = new EmergenceHooks(readFs).hydrateArchive();
    expect(cells).toHaveLength(1); // one accepted entry → one cell

    readFs.close();
  }, 30000);
});
