/**
 * Unit tests for HoldoutCriticBus — Phase 15
 *
 * Tests multi-critic evaluation with agreement detection.
 */

import { describe, it, expect } from 'vitest';
import { HoldoutCriticBus } from '../../../src/evaluation/HoldoutCriticBus.js';
import type { ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeDescriptor(values: Record<string, number>) {
  return {
    values: Object.entries(values).map(([axis, value]) => ({ axis: axis as DescriptorAxis, value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, quality: number): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test', path: `test/${id}` },
    descriptor: makeDescriptor({ 'order-chaos': 0.5 }),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

describe('HoldoutCriticBus', () => {
  it('isReady requires at least 2 critics', () => {
    const bus = new HoldoutCriticBus();
    expect(bus.isReady()).toBe(false);
    bus.registerCritic('a', () => 0.5);
    expect(bus.isReady()).toBe(false);
    bus.registerCritic('b', () => 0.5);
    expect(bus.isReady()).toBe(true);
  });

  it('returns consensus when critics agree', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('a', () => 0.7);
    bus.registerCritic('b', () => 0.72);
    const result = bus.evaluate(makeEntry('x', 0.7));
    expect(result.agreement).toBe('consensus');
    expect(result.blocked).toBe(false);
    expect(result.compositeScore).toBeCloseTo(0.71, 2);
  });

  it('returns minor-divergence for moderate disagreement', () => {
    const bus = new HoldoutCriticBus();
    // StdDev of 0.5, 0.72 = 0.11 — just above consensus threshold of 0.1
    bus.registerCritic('a', () => 0.5);
    bus.registerCritic('b', () => 0.72);
    const result = bus.evaluate(makeEntry('x', 0.6));
    expect(result.agreement).toBe('minor-divergence');
    expect(result.blocked).toBe(false);
  });

  it('blocks on major divergence by default', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('a', () => 0.1);
    bus.registerCritic('b', () => 0.9);
    const result = bus.evaluate(makeEntry('x', 0.5));
    expect(result.agreement).toBe('major-divergence');
    expect(result.blocked).toBe(true);
  });

  it('does not block when blockOnDivergence is false', () => {
    const bus = new HoldoutCriticBus({ blockOnDivergence: false });
    bus.registerCritic('a', () => 0.1);
    bus.registerCritic('b', () => 0.9);
    const result = bus.evaluate(makeEntry('x', 0.5));
    expect(result.agreement).toBe('major-divergence');
    expect(result.blocked).toBe(false);
  });

  it('getCriticIds returns registered IDs', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('taste', () => 0.5);
    bus.registerCritic('aesthetic', () => 0.5);
    expect(bus.getCriticIds()).toContain('taste');
    expect(bus.getCriticIds()).toContain('aesthetic');
  });

  it('removeCritic removes a critic', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('a', () => 0.5);
    bus.registerCritic('b', () => 0.5);
    expect(bus.removeCritic('a')).toBe(true);
    expect(bus.getCriticIds()).not.toContain('a');
    expect(bus.removeCritic('nonexistent')).toBe(false);
  });

  it('evaluate with no critics returns zero composite', () => {
    const bus = new HoldoutCriticBus();
    const result = bus.evaluate(makeEntry('x', 0.5));
    expect(result.compositeScore).toBe(0);
    expect(result.votes).toHaveLength(0);
  });

  it('uses weights for composite score', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('heavy', () => 0.9, 3.0);
    bus.registerCritic('light', () => 0.3, 1.0);
    const result = bus.evaluate(makeEntry('x', 0.6));
    // (0.9*3 + 0.3*1) / 4 = 3.0 / 4 = 0.75
    expect(result.compositeScore).toBeCloseTo(0.75, 2);
  });
});
