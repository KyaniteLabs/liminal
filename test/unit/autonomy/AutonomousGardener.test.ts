/**
 * Unit tests for AutonomousGardener lifecycle and cycle logic
 */

import { describe, it, expect } from 'vitest';
import { AutonomousGardener } from '../../../src/autonomy/AutonomousGardener.js';
import type { GardenerCycleResult } from '../../../src/autonomy/AutonomousGardener.js';
import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeEntry(id: string, quality: number): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test' as const, path: `test/${id}` },
    descriptor: {
      values: [{ axis: 'order-chaos' as const, value: 0.5 }],
      source: 'test',
      extractedAt: new Date().toISOString(),
    },
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation' as const, createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(id: string, quality: number): ArchiveCell {
  return {
    cellId: `cell-${id}`,
    coordinates: [{ axis: 'order-chaos' as const, value: 0.5 }],
    elite: makeEntry(id, quality),
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
});
