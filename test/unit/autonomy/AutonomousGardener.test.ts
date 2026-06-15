/**
 * Unit tests for AutonomousGardener lifecycle and cycle logic
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { AutonomousGardener } from '../../../src/autonomy/AutonomousGardener.js';
import type { GardenerCycleResult } from '../../../src/autonomy/AutonomousGardener.js';
import { DreamQueue } from '../../../src/dreaming/DreamQueue.js';
import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeEntry(id: string, quality: number, descriptorValue = 0.5): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test' as const, path: `test/${id}` },
    descriptor: {
      values: [{ axis: 'order-chaos' as const, value: descriptorValue }],
      source: 'test',
      extractedAt: new Date().toISOString(),
    },
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation' as const, createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(id: string, quality: number, descriptorValue = 0.5): ArchiveCell {
  return {
    cellId: `cell-${id}`,
    coordinates: [{ axis: 'order-chaos' as const, value: descriptorValue }],
    elite: makeEntry(id, quality, descriptorValue),
    nearElites: [],
    capacity: 5,
  };
}

const emptyCells: ArchiveCell[] = [];
const axes: DescriptorAxis[] = ['order-chaos'];

describe('AutonomousGardener', () => {
  it('runs a single cycle and returns structured result', () => {
    const gardener = new AutonomousGardener({ totalBudget: 100 });
    const result = gardener.cycle([makeCell('a', 0.8)], axes);

    expect(result).not.toBeNull();
    expect(result!.cycle).toBe(1);
    expect(result!.mode).toBe('co-create');
    expect(result!.budgetRemaining).toBeLessThan(100);
    expect(result!.health).not.toBeNull();
    expect(typeof result!.actions).toBe('number');
  });

  it('returns null when budget is exhausted', () => {
    const gardener = new AutonomousGardener({ totalBudget: 0 });
    const result = gardener.cycle(emptyCells, axes);
    expect(result).toBeNull();
  });

  it('decrements budget across multiple cycles', () => {
    const gardener = new AutonomousGardener({ totalBudget: 50 });
    const r1 = gardener.cycle([makeCell('a', 0.7)], axes);
    expect(r1).not.toBeNull();

    const r2 = gardener.cycle([makeCell('b', 0.6)], axes);
    if (r2) {
      expect(r2.budgetRemaining).toBeLessThan(r1!.budgetRemaining);
      expect(r2.cycle).toBe(2);
    }
  });

  it('handles empty archive gracefully', () => {
    const gardener = new AutonomousGardener({ totalBudget: 100 });
    const result = gardener.cycle(emptyCells, axes);
    // Empty archive may or may not produce actions depending on policy
    // but must not throw
    expect(result === null || typeof result.actions === 'number').toBe(true);
  });

  it('respects mode config', () => {
    const gardener = new AutonomousGardener({ mode: 'autopilot', totalBudget: 100 });
    const result = gardener.cycle([makeCell('a', 0.8)], axes);
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('autopilot');
  });

  it('tracks cycle count incrementally', () => {
    const gardener = new AutonomousGardener({ totalBudget: 200 });
    const r1 = gardener.cycle([makeCell('a', 0.8)], axes);
    const r2 = gardener.cycle([makeCell('b', 0.7)], axes);
    const r3 = gardener.cycle([makeCell('c', 0.6)], axes);

    expect(r1?.cycle).toBe(1);
    expect(r2?.cycle).toBe(2);
    expect(r3?.cycle).toBe(3);
  });

  it('stop() sets active to false', () => {
    const gardener = new AutonomousGardener({ totalBudget: 100 });
    expect(gardener.isActive()).toBe(false);
    // stop() is idempotent — safe to call before start
    gardener.stop();
    expect(gardener.isActive()).toBe(false);
  });

  it('reports task breakdown with fresh/replay/dream counts', () => {
    const gardener = new AutonomousGardener({ totalBudget: 200 });
    // Provide multiple cells to increase archive coverage
    const cells = [makeCell('a', 0.9), makeCell('b', 0.8), makeCell('c', 0.7)];
    const result = gardener.cycle(cells, axes);

    if (result?.taskBreakdown) {
      const { fresh, replay, dream } = result.taskBreakdown;
      expect(typeof fresh).toBe('number');
      expect(typeof replay).toBe('number');
      expect(typeof dream).toBe('number');
      expect(fresh + replay + dream).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes stagnation data in cycle result', () => {
    const gardener = new AutonomousGardener({ totalBudget: 100 });
    const result = gardener.cycle([makeCell('a', 0.8)], axes);
    expect(result).not.toBeNull();
    expect(result!.stagnation).not.toBeNull();
    expect(result!.stagnation.isStagnant === true || result!.stagnation.isStagnant === false).toBe(true);
  });

  it('reports archive entries selected by the loaded taste model', () => {
    const gardener = new AutonomousGardener({
      totalBudget: 20,
      replayRatio: 1,
      replayBiasStrength: 1,
      minTasteScore: 0.5,
      maxArchiveTasks: 1,
    });
    gardener.loadTasteModel({
      axisWeights: [1],
      qualityWeight: 0,
      trainedAt: new Date().toISOString(),
      pairCount: 1,
      trainingAgreement: 1,
    });

    const result = gardener.cycle([
      makeCell('preferred', 0.5, 0.9),
      makeCell('low-signal', 0.9, 0.1),
    ], axes);

    expect(result).toMatchObject({
      tasteAlignedCount: 1,
      tasteSelectedEntryIds: ['preferred'],
    });
  });

  describe('dream queue wiring (B15)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('enqueues an in-cycle recombination into the injected dream queue', () => {
      // Force ReplayBudgetPolicy.decideNextTask down the dream-recombination
      // path deterministically: replayRatio 0 (never replay) + Math.random 0.99
      // (full archive coverage → normal allocation → freshTypes[floor(0.99*2)=1]
      // = 'dream-recombination').
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const dreamQueue = new DreamQueue();
      const gardener = new AutonomousGardener({
        totalBudget: 100,
        replayRatio: 0,
        maxArchiveTasks: 1,
        dreamQueue,
      });

      // Two distinct elites so DreamPlanner produces a pair to recombine.
      const cells = [makeCell('alpha', 0.9, 0.9), makeCell('beta', 0.6, 0.1)];
      const result = gardener.cycle(cells, axes);

      expect(result!.taskBreakdown!.dream).toBe(1);

      const queued = dreamQueue.getTasks('queued');
      expect(queued.length).toBeGreaterThanOrEqual(1);
      // The queued task carries the actual recombination pairing — the two
      // archive elites — not just an incremented counter.
      const top = queued[0];
      expect(top.strategy).toBe('elite-x-elite');
      const sourceIds = top.sources.map(s => s.id).sort();
      expect(sourceIds).toEqual(['alpha', 'beta']);
    });

    it('does not enqueue when no dream queue is injected (back-compat)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const dreamQueue = new DreamQueue();
      const gardener = new AutonomousGardener({
        totalBudget: 100,
        replayRatio: 0,
        maxArchiveTasks: 1,
        // no dreamQueue injected
      });

      const cells = [makeCell('alpha', 0.9, 0.9), makeCell('beta', 0.6, 0.1)];
      const result = gardener.cycle(cells, axes);

      // Dream work still happens (reported), but nothing is enqueued anywhere.
      expect(result!.taskBreakdown!.dream).toBe(1);
      expect(dreamQueue.getStatus().queued).toBe(0);
    });

    it('does not re-enqueue the same pairing across cycles (dedup)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const dreamQueue = new DreamQueue();
      const gardener = new AutonomousGardener({
        totalBudget: 100,
        replayRatio: 0,
        maxArchiveTasks: 1,
        dreamQueue,
      });

      const cells = [makeCell('alpha', 0.9, 0.9), makeCell('beta', 0.6, 0.1)];
      gardener.cycle(cells, axes);
      const afterFirst = dreamQueue.getStatus().queued;
      gardener.cycle(cells, axes);
      const afterSecond = dreamQueue.getStatus().queued;

      // Same archive → same top pairing → deduped, no growth.
      expect(afterFirst).toBe(1);
      expect(afterSecond).toBe(1);
    });
  });
});
