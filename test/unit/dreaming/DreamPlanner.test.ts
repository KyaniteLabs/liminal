/**
 * Unit tests for DreamPlanner — Phase 15
 *
 * Tests dream task planning from archive cells.
 */

import { describe, it, expect } from 'vitest';
import { DreamPlanner } from '../../../src/dreaming/DreamPlanner.js';
import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeDescriptor(values: Record<string, number>) {
  return {
    values: Object.entries(values).map(([axis, value]) => ({ axis: axis as DescriptorAxis, value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, descValues: Record<string, number>, quality: number, kind: string): ArchiveEntry {
  return {
    id,
    artifactRef: { kind, path: `test/${id}` },
    descriptor: makeDescriptor(descValues),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(id: string, descValues: Record<string, number>, quality: number, kind: string = 'p5'): ArchiveCell {
  return { niche: { center: makeDescriptor(descValues), radius: 0.2 }, elite: makeEntry(id, descValues, quality, kind) };
}

describe('DreamPlanner', () => {
  it('returns empty tasks when fewer than 2 entries', () => {
    const planner = new DreamPlanner();
    const cells = [makeCell('a', { 'order-chaos': 0.5 }, 0.8)];
    const plan = planner.plan(cells, ['order-chaos']);
    expect(plan.tasks).toHaveLength(0);
  });

  it('creates elite-x-elite task from quality and novelty leaders', () => {
    const planner = new DreamPlanner();
    const cells = [
      makeCell('high-q', { 'order-chaos': 0.5, 'sparse-dense': 0.5 }, 0.9),
      makeCell('high-n', { 'order-chaos': 0.9, 'sparse-dense': 0.1 }, 0.6),
    ];
    const plan = planner.plan(cells, ['order-chaos', 'sparse-dense']);
    const eliteTask = plan.tasks.find(t => t.strategy === 'elite-x-elite');

    expect(eliteTask!.priority).toBe(0.9);
  });

  it('creates distant-niche task when entries are spread', () => {
    const planner = new DreamPlanner();
    const cells = [
      makeCell('a', { 'order-chaos': 0.1, 'sparse-dense': 0.1 }, 0.7),
      makeCell('b', { 'order-chaos': 0.9, 'sparse-dense': 0.9 }, 0.7),
      makeCell('c', { 'order-chaos': 0.5, 'sparse-dense': 0.5 }, 0.7),
      makeCell('d', { 'order-chaos': 0.2, 'sparse-dense': 0.8 }, 0.7),
    ];
    const plan = planner.plan(cells, ['order-chaos', 'sparse-dense']);
    const distant = plan.tasks.find(t => t.strategy === 'distant-niche-x-distant');
    expect(distant).not.toBeNull();
  });

  it('creates cross-modal task for different domains', () => {
    const planner = new DreamPlanner();
    const cells = [
      makeCell('p5art', { 'order-chaos': 0.5 }, 0.8, 'p5'),
      makeCell('shader', { 'order-chaos': 0.5 }, 0.7, 'shader'),
      makeCell('strudel', { 'order-chaos': 0.5 }, 0.6, 'strudel'),
    ];
    const plan = planner.plan(cells, ['order-chaos']);
    const crossModal = plan.tasks.find(t => t.strategy === 'cross-modal');
    expect(crossModal).not.toBeNull();
  });

  it('respects maxTasks limit', () => {
    const planner = new DreamPlanner({ maxTasks: 2 });
    const cells = Array.from({ length: 8 }, (_, i) =>
      makeCell(`e${i}`, { 'order-chaos': i / 8, 'sparse-dense': 0.5 }, 0.7),
    );
    const plan = planner.plan(cells, ['order-chaos', 'sparse-dense']);
    expect(plan.tasks.length).toBeLessThanOrEqual(2);
  });

  it('handles empty cells gracefully', () => {
    const planner = new DreamPlanner();
    const plan = planner.plan([], []);
    expect(plan.tasks).toHaveLength(0);
  });

  const sig = (t: { strategy: string; sources: { id: string }[] }) =>
    `${t.strategy}:${t.sources.map(s => s.id).sort().join('+')}`;

  it('proposes fresh recombinations not already in the queue via excludeKeys', () => {
    const planner = new DreamPlanner();
    const axes: DescriptorAxis[] = ['order-chaos', 'sparse-dense'];
    const cells = Array.from({ length: 10 }, (_, i) =>
      makeCell(`e${i}`, { 'order-chaos': i / 10, 'sparse-dense': (9 - i) / 10 }, 0.9 - i * 0.04),
    );

    // First plan with nothing excluded fills to maxTasks (the deterministic top pairs).
    const first = planner.plan(cells, axes);
    expect(first.tasks).toHaveLength(8);
    const firstKeys = new Set(first.tasks.map(sig));

    // Re-planning while excluding every pairing already proposed must yield only NEW ones.
    const second = planner.plan(cells, axes, { excludeKeys: firstKeys });
    expect(second.tasks).toHaveLength(8);
    for (const t of second.tasks) {
      expect(firstKeys.has(sig(t))).toBe(false);
    }
  });

  it('does not re-propose an excluded elite-x-elite pairing', () => {
    const planner = new DreamPlanner();
    const axes: DescriptorAxis[] = ['order-chaos', 'sparse-dense'];
    const cells = Array.from({ length: 6 }, (_, i) =>
      makeCell(`e${i}`, { 'order-chaos': i / 6, 'sparse-dense': (5 - i) / 6 }, 0.8 - i * 0.05),
    );

    const baselineElite = planner.plan(cells, axes).tasks.find(t => t.strategy === 'elite-x-elite');
    const excludedKey = sig(baselineElite!);

    const replan = planner.plan(cells, axes, { excludeKeys: new Set([excludedKey]) });
    expect(replan.tasks.map(sig)).not.toContain(excludedKey);
    // A fresh elite-x-elite pairing is still proposed (just a different one).
    const replanElite = replan.tasks.find(t => t.strategy === 'elite-x-elite');
    expect(sig(replanElite!)).not.toBe(excludedKey);
  });
});
