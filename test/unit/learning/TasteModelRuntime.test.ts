/**
 * Unit tests for TasteModelRuntime — Phase 15
 *
 * Tests runtime scoring, ranking, and comparison using trained weights.
 */

import { describe, it, expect } from 'vitest';
import { TasteModelRuntime } from '../../../src/learning/TasteModelRuntime.js';
import type { ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeDescriptor(values: Record<string, number>) {
  return {
    values: Object.entries(values).map(([axis, value]) => ({ axis: axis as DescriptorAxis, value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, descValues: Record<string, number>, quality: number): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test', path: `test/${id}` },
    descriptor: makeDescriptor(descValues),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

const WEIGHTS = {
  axisWeights: [0.7, 0.3],
  qualityWeight: 0.4,
  trainedAt: new Date().toISOString(),
  pairCount: 10,
  trainingAgreement: 0.9,
};

describe('TasteModelRuntime', () => {
  it('falls back to qualityScore when no model loaded', () => {
    const runtime = new TasteModelRuntime();
    const entry = makeEntry('a', { 'order-chaos': 0.5 }, 0.8);
    expect(runtime.score(entry)).toBe(0.8);
  });

  it('scores using descriptor and quality weights', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    const entry = makeEntry('a', { 'order-chaos': 0.6, 'sparse-dense': 0.4 }, 0.5);
    // descScore = 0.7*0.6 + 0.3*0.4 = 0.42 + 0.12 = 0.54
    // score = 0.54 * (1 - 0.4) + 0.5 * 0.4 = 0.324 + 0.2 = 0.524
    expect(runtime.score(entry)).toBeCloseTo(0.524, 3);
  });

  it('rank sorts by taste score descending', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    const low = makeEntry('low', { 'order-chaos': 0.1, 'sparse-dense': 0.1 }, 0.3);
    const high = makeEntry('high', { 'order-chaos': 0.9, 'sparse-dense': 0.9 }, 0.9);
    const ranked = runtime.rank([low, high]);
    expect(ranked[0].entry.id).toBe('high');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].entry.id).toBe('low');
    expect(ranked[1].rank).toBe(2);
  });

  it('compare returns positive when a is preferred', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    const a = makeEntry('a', { 'order-chaos': 0.9 }, 0.9);
    const b = makeEntry('b', { 'order-chaos': 0.1 }, 0.1);
    expect(runtime.compare(a, b)).toBeGreaterThan(0);
  });

  it('topN returns top N candidates', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`e${i}`, { 'order-chaos': i / 10, 'sparse-dense': 0.5 }, 0.5),
    );
    const top = runtime.topN(entries, 3);
    expect(top).toHaveLength(3);
    expect(top[0].rank).toBe(1);
  });

  it('isLoaded reflects model state', () => {
    const runtime = new TasteModelRuntime();
    expect(runtime.isLoaded()).toBe(false);
    runtime.load(WEIGHTS);
    expect(runtime.isLoaded()).toBe(true);
  });

  it('getWeights returns loaded weights', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    expect(runtime.getWeights()).toEqual(WEIGHTS);
  });

  it('handles empty entries array', () => {
    const runtime = new TasteModelRuntime();
    runtime.load(WEIGHTS);
    expect(runtime.rank([])).toEqual([]);
    expect(runtime.topN([], 5)).toEqual([]);
  });
});
