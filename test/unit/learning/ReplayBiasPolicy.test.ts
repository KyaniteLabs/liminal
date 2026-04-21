/**
 * Unit tests for ReplayBiasPolicy — Phase 15
 *
 * Tests taste-blended replay selection and alignment checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayBiasPolicy } from '../../../src/learning/ReplayBiasPolicy.js';
import type { ArchiveEntry } from '../../../src/emergence/types.js';

function makeDescriptor(values: number[]): import('../../../src/emergence/types.js').BehaviorDescriptor {
  const axes = ['order-chaos', 'sparse-dense', 'symmetry-asymmetry'];
  return {
    values: values.map((v, i) => ({ axis: axes[i] as any, value: v })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, descValues: number[], quality: number, fertility: number = 0.5): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test', path: `test/${id}` },
    descriptor: makeDescriptor(descValues),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility, aesthetic: 0.5 },
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

describe('ReplayBiasPolicy', () => {
  let policy: ReplayBiasPolicy;

  beforeEach(() => {
    policy = new ReplayBiasPolicy({ minTasteScore: 0.1 });
  });

  it('falls back to quality + fertility when no model loaded', () => {
    const entries = [
      makeEntry('low', [0.2], 0.3, 0.3),
      makeEntry('high', [0.8], 0.9, 0.8),
    ];
    const selected = policy.selectForReplay(entries, 1);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe('high');
  });

  it('uses taste model when loaded', () => {
    policy.loadModel(WEIGHTS);
    const entries = [
      makeEntry('aligned', [0.9, 0.8, 0.5], 0.7),
      makeEntry('unaligned', [0.1, 0.1, 0.5], 0.9),
    ];
    const selected = policy.selectForReplay(entries, 1);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe('aligned');
  });

  it('selects requested count of entries', () => {
    policy.loadModel(WEIGHTS);
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`e${i}`, [i / 10, 0.5, 0.5], 0.5),
    );
    const selected = policy.selectForReplay(entries, 3);
    expect(selected).toHaveLength(3);
  });

  it('blendedScore returns number in valid range', () => {
    policy.loadModel(WEIGHTS);
    const entry = makeEntry('a', [0.5, 0.5, 0.5], 0.6);
    const score = policy.blendedScore(entry);
    expect(typeof score).toBe('number');
    expect(isFinite(score)).toBe(true);
  });

  it('isTasteAligned returns true for high-scoring entries', () => {
    policy.loadModel(WEIGHTS);
    const entry = makeEntry('a', [0.9, 0.8, 0.5], 0.9);
    expect(policy.isTasteAligned(entry)).toBe(true);
  });

  it('handles empty entries gracefully', () => {
    policy.loadModel(WEIGHTS);
    expect(policy.selectForReplay([], 5)).toEqual([]);
  });

  it('isModelLoaded reflects model state', () => {
    expect(policy.isModelLoaded()).toBe(false);
    policy.loadModel(WEIGHTS);
    expect(policy.isModelLoaded()).toBe(true);
  });
});
