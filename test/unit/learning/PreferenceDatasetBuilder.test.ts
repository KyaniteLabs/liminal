/**
 * Unit tests for PreferenceDatasetBuilder — Phase 15
 *
 * Tests training pair construction from preference records.
 */

import { describe, it, expect } from 'vitest';
import { PreferenceDatasetBuilder } from '../../../src/learning/PreferenceDatasetBuilder.js';
import type { ArchiveEntry } from '../../../src/emergence/types.js';

function makeDescriptor(values: number[]): import('../../../src/emergence/types.js').BehaviorDescriptor {
  const axes = ['order-chaos', 'sparse-dense', 'symmetry-asymmetry'];
  return {
    values: values.map((v, i) => ({ axis: axes[i] as any, value: v })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(
  id: string,
  descValues: number[],
  quality: number,
  preference?: ArchiveEntry['preference'],
): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test', path: `test/${id}` },
    descriptor: makeDescriptor(descValues),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    preference,
    archivedAt: new Date().toISOString(),
  };
}

describe('PreferenceDatasetBuilder', () => {
  it('returns empty dataset when entries have no preferences', () => {
    const builder = new PreferenceDatasetBuilder();
    const entries = [
      makeEntry('a', [0.5], 0.6),
      makeEntry('b', [0.7], 0.7),
    ];
    const dataset = builder.build(entries);
    expect(dataset.pairs).toHaveLength(0);
  });

  it('creates pairs from pairwise comparisons', () => {
    const builder = new PreferenceDatasetBuilder();
    const entries = [
      makeEntry('a', [0.7], 0.7, {
        action: 'pairwise-a',
        artifactId: 'a',
        comparedTo: 'b',
        capturedAt: new Date().toISOString(),
      }),
      makeEntry('b', [0.3], 0.4),
    ];
    const dataset = builder.build(entries);
    expect(dataset.pairs.length).toBeGreaterThanOrEqual(1);
    // Winner should have higher quality
    expect(dataset.pairs[0].winner.quality).toBeGreaterThan(dataset.pairs[0].loser.quality);
  });

  it('addSyntheticPair returns a pair with specified confidence', () => {
    const builder = new PreferenceDatasetBuilder();
    const winner = makeEntry('winner', [0.9], 0.9);
    const loser = makeEntry('loser', [0.2], 0.2);
    const pair = builder.addSyntheticPair(winner, loser, 0.95);
    expect(pair.confidence).toBe(0.95);
    expect(pair.winner.id).toBe('winner');
    expect(pair.loser.id).toBe('loser');
    expect(pair.winner.quality).toBe(0.9);
    expect(pair.loser.quality).toBe(0.2);
    expect(pair.source).toBe('pairwise-a');
  });

  it('excludes inferred pairs when includeInferred is false', () => {
    const builder = new PreferenceDatasetBuilder({ includeInferred: false });
    const entries = [
      makeEntry('a', [0.7], 0.7, {
        action: 'pin',
        artifactId: 'a',
        capturedAt: new Date().toISOString(),
      }),
      makeEntry('b', [0.3], 0.4),
    ];
    const dataset = builder.build(entries);
    // Pin is inferred, not a direct comparison
    expect(dataset.pairs).toHaveLength(0);
  });

  it('filters by minConfidence', () => {
    const builder = new PreferenceDatasetBuilder({ minConfidence: 0.8 });
    const entries = [
      makeEntry('a', [0.7], 0.7, {
        action: 'pairwise-a',
        artifactId: 'a',
        comparedTo: 'b',
        capturedAt: new Date().toISOString(),
      }),
      makeEntry('b', [0.3], 0.4),
    ];
    const dataset = builder.build(entries);
    // Only pairs meeting the confidence threshold should be included
    for (const pair of dataset.pairs) {
      expect(pair.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });
});
