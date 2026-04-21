/**
 * Unit tests for CrossModalTransfer — Phase 15
 *
 * Tests cross-domain pattern transfer.
 */

import { describe, it, expect } from 'vitest';
import { CrossModalTransfer } from '../../../src/dreaming/CrossModalTransfer.js';
import type { ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

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

describe('CrossModalTransfer', () => {
  it('finds transfers between different domains', () => {
    const transfer = new CrossModalTransfer();
    const entries = [
      makeEntry('p5art', { 'order-chaos': 0.5, 'sparse-dense': 0.6 }, 0.8, 'p5'),
      makeEntry('shader', { 'order-chaos': 0.6, 'sparse-dense': 0.5 }, 0.7, 'shader'),
    ];
    const mappings = transfer.findTransfers(entries);
    expect(mappings.length).toBeGreaterThanOrEqual(1);
    expect(mappings[0].sourceDomain).not.toBe(mappings[0].targetDomain);
  });

  it('returns empty when all entries are same domain', () => {
    const transfer = new CrossModalTransfer();
    const entries = [
      makeEntry('a', { 'order-chaos': 0.5 }, 0.8, 'p5'),
      makeEntry('b', { 'order-chaos': 0.6 }, 0.7, 'p5'),
    ];
    const mappings = transfer.findTransfers(entries);
    expect(mappings).toHaveLength(0);
  });

  it('transfer blends source and target descriptors', () => {
    const transfer = new CrossModalTransfer();
    const source = makeEntry('src', { 'order-chaos': 0.8, 'sparse-dense': 0.2 }, 0.8, 'p5');
    const target = makeEntry('tgt', { 'order-chaos': 0.4, 'sparse-dense': 0.6 }, 0.7, 'shader');
    const result = transfer.transfer(source, target);
    // 60% source + 40% target
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(0.8 * 0.6 + 0.4 * 0.4, 2);
    expect(result[1]).toBeCloseTo(0.2 * 0.6 + 0.6 * 0.4, 2);
  });

  it('respects minSimilarity threshold', () => {
    const transfer = new CrossModalTransfer({ minSimilarity: 0.99 });
    // Use non-parallel vectors: [0.1, 0.9] vs [0.9, 0.1] → cosine ≈ 0 → mapped ≈ 0.5
    const entries = [
      makeEntry('a', { 'order-chaos': 0.1, 'sparse-dense': 0.9 }, 0.8, 'p5'),
      makeEntry('b', { 'order-chaos': 0.9, 'sparse-dense': 0.1 }, 0.7, 'shader'),
    ];
    const mappings = transfer.findTransfers(entries);
    // Low cosine similarity (≈0.5 mapped) won't reach 0.99
    expect(mappings).toHaveLength(0);
  });
});
