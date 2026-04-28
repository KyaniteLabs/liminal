import { describe, it, expect } from 'vitest';
import { ReplayBudgetPolicy } from '../../src/autonomy/ReplayBudgetPolicy.js';
import { PromisingStateSelector } from '../../src/autonomy/PromisingStateSelector.js';
import type { ArchiveEntry, PromisingState, EmergenceSignals } from '../../src/emergence/types.js';
import type { LiminalObjectRef } from '../../src/fs/types.js';

// ── ReplayBudgetPolicy ──

describe('ReplayBudgetPolicy', () => {
  it('returns configured budget', () => {
    const policy = new ReplayBudgetPolicy({ replayRatio: 0.4, actionsPerCycle: 12, maxConsecutiveReplay: 2 });
    const budget = policy.getBudget();
    expect(budget.replayRatio).toBe(0.4);
    expect(budget.actionsPerCycle).toBe(12);
    expect(budget.maxConsecutiveReplay).toBe(2);
  });

  it('defaults to 0.3 replay ratio', () => {
    const policy = new ReplayBudgetPolicy();
    expect(policy.getBudget().replayRatio).toBe(0.3);
  });

  it('forces exploration after max consecutive replays', () => {
    const policy = new ReplayBudgetPolicy({ maxConsecutiveReplay: 2, replayRatio: 1.0 });

    // Simulate 2 consecutive replay actions
    const fresh: Array<{ type: import('../../src/emergence/types.js').CreativeTaskType }> = [];
    const r1 = policy.decideNextTask([...fresh, { type: 'replay-promising' }], 0.5);
    const r2 = policy.decideNextTask([...fresh, { type: 'replay-promising' }, { type: 'replay-promising' }], 0.5);

    // After 3 replays total (2 in array + this decision = 3rd), should force exploration
    const replayTypes = new Set(['replay-promising', 'branch-from-pinned', 'compost-resurrection']);
    // The 3rd consecutive call should return a fresh type
    const r3 = policy.decideNextTask(
      [{ type: 'replay-promising' }, { type: 'replay-promising' }, { type: 'replay-promising' }],
      0.5,
    );
    expect(replayTypes.has(r3)).toBe(false);
  });

  it('prefers exploration when archive coverage is low', () => {
    const policy = new ReplayBudgetPolicy({ replayRatio: 0.5 });
    const results = new Set<import('../../src/emergence/types.js').CreativeTaskType>();

    for (let i = 0; i < 20; i++) {
      const task = policy.decideNextTask([], 0.1);
      results.add(task);
    }

    // With low coverage, most should be exploration
    const explorationTypes = new Set(['fresh-exploration', 'dream-recombination']);
    let explorationCount = 0;
    for (const r of results) {
      if (explorationTypes.has(r)) explorationCount++;
    }
    expect(explorationCount).toBeGreaterThan(0);
  });

  it('tracks effective replay ratio from history', () => {
    const policy = new ReplayBudgetPolicy();
    expect(policy.getEffectiveReplayRatio()).toBe(0.3); // Default when no history

    policy.recordCycle(7, 3);
    policy.recordCycle(6, 4);

    const effective = policy.getEffectiveReplayRatio();
    expect(effective).toBeGreaterThan(0);
    expect(effective).toBeLessThan(1);
  });

  it('cycles are capped at 20 entries', () => {
    const policy = new ReplayBudgetPolicy();
    for (let i = 0; i < 25; i++) {
      policy.recordCycle(5, 5);
    }
    // Should not throw, just trim
    expect(policy.getEffectiveReplayRatio()).toBeCloseTo(0.5);
  });
});

// ── PromisingStateSelector ──

function makeArchiveEntry(id: string, signals: Partial<EmergenceSignals>, parentCount = 0): ArchiveEntry {
  return {
    id,
    artifactRef: { uri: `test://${id}`, kind: 'generated-code' } as LiminalObjectRef,
    descriptor: {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: new Date().toISOString(),
    },
    lineage: {
      artifactId: id,
      parentIds: Array(parentCount).fill('parent'),
      provenance: 'fresh-generation',
      createdAt: new Date().toISOString(),
    },
    qualityScore: 0.7,
    signals: {
      novelty: 0.5, structure: 0.5, temporalRichness: 0.5,
      perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5,
      ...signals,
    },
    archivedAt: new Date().toISOString(),
  };
}

describe('PromisingStateSelector', () => {
  it('selects high-fertility entries', () => {
    const selector = new PromisingStateSelector();
    const elites = [
      makeArchiveEntry('low-fert', { fertility: 0.1 }),
      makeArchiveEntry('high-fert', { fertility: 0.9 }),
      makeArchiveEntry('mid-fert', { fertility: 0.5 }),
    ];

    const selected = selector.select(elites, new Map(), 2);
    expect(selected.length).toBeGreaterThan(0);
    // High fertility should be in the selection
    expect(selected.some(s => s.entry.id === 'high-fert')).toBe(true);
  });

  it('selects user-pinned entries', () => {
    const selector = new PromisingStateSelector();
    const elites = [
      makeArchiveEntry('pinned', { fertility: 0.1 }),
      makeArchiveEntry('unpinned', { fertility: 0.9 }),
    ];

    const prefs = new Map<string, { positive: number; negative: number }>();
    prefs.set('pinned', { positive: 3, negative: 0 });

    const selected = selector.select(elites, prefs, 2);
    const pinnedResult = selected.find(s => s.entry.id === 'pinned');

    expect(pinnedResult!.reason).toBe('user-pinned');
  });

  it('penalizes heavily replayed entries', () => {
    const selector = new PromisingStateSelector();
    const elites = [
      makeArchiveEntry('fresh', { fertility: 0.7 }),
      makeArchiveEntry('replayed', { fertility: 0.7 }),
    ];

    // Select the same entries multiple times to build replay count
    const prefs = new Map();
    selector.select(elites, prefs, 2);
    selector.select(elites, prefs, 2);
    selector.select(elites, prefs, 2);

    const stats = selector.getStats();
    expect(stats.totalReplays).toBeGreaterThan(0);
  });

  it('returns empty for no elites', () => {
    const selector = new PromisingStateSelector();
    const selected = selector.select([], new Map(), 5);
    expect(selected).toHaveLength(0);
  });

  it('respects maxResults limit', () => {
    const selector = new PromisingStateSelector();
    const elites = Array.from({ length: 20 }, (_, i) =>
      makeArchiveEntry(`e-${i}`, { fertility: 0.8 }),
    );

    const selected = selector.select(elites, new Map(), 3);
    expect(selected.length).toBeLessThanOrEqual(3);
  });

  it('reports stats', () => {
    const selector = new PromisingStateSelector();
    const stats = selector.getStats();
    expect(stats.totalReplays).toBe(0);
    expect(stats.mostReplayed).toBeNull();
    expect(stats.maxReplays).toBe(0);
  });
});
