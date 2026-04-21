/**
 * Unit tests for NoveltyIndex — Phase 14
 *
 * Tests kNN-based novelty scoring.
 */

import { describe, it, expect } from 'vitest';
import { NoveltyIndex } from '../../../src/emergence/NoveltyIndex.js';
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

describe('NoveltyIndex', () => {
  it('returns high novelty for unique descriptor in empty archive', () => {
    const index = new NoveltyIndex();
    const desc = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const score = index.score(desc, []);
    expect(score).toBe(1); // No neighbors → maximally novel
  });

  it('returns low novelty for descriptor matching archive', () => {
    const index = new NoveltyIndex();
    const archive = [makeEntry('a', { 'order-chaos': 0.5, 'sparse-dense': 0.5 }, 0.7)];
    const desc = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const score = index.score(desc, archive);
    expect(score).toBeLessThan(0.5);
  });

  it('returns higher novelty for distant descriptors', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('a', { 'order-chaos': 0.2, 'sparse-dense': 0.2 }, 0.7),
      makeEntry('b', { 'order-chaos': 0.3, 'sparse-dense': 0.3 }, 0.6),
    ];
    const nearDesc = makeDescriptor({ 'order-chaos': 0.25, 'sparse-dense': 0.25 });
    const farDesc = makeDescriptor({ 'order-chaos': 0.9, 'sparse-dense': 0.9 });
    const nearScore = index.score(nearDesc, archive);
    const farScore = index.score(farDesc, archive);
    expect(farScore).toBeGreaterThan(nearScore);
  });

  it('findNearest returns closest entries with distances', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('close', { 'order-chaos': 0.5 }, 0.7),
      makeEntry('mid', { 'order-chaos': 0.3 }, 0.6),
      makeEntry('far', { 'order-chaos': 0.1 }, 0.5),
    ];
    const desc = makeDescriptor({ 'order-chaos': 0.5 });
    const nearest = index.findNearest(desc, archive, 2);
    expect(nearest).toHaveLength(2);
    expect(nearest[0].entry.id).toBe('close');
    expect(nearest[0].distance).toBeLessThan(nearest[1].distance);
  });

  it('computeCoverage returns fraction of occupied bins', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('a', { 'order-chaos': 0.1 }, 0.7),
      makeEntry('b', { 'order-chaos': 0.5 }, 0.6),
      makeEntry('c', { 'order-chaos': 0.9 }, 0.5),
    ];
    const coverage = index.computeCoverage(archive, 5);
    // Returns a number: occupied bins / total bins
    expect(typeof coverage).toBe('number');
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(1);
  });

  it('computeCoverage returns 0 for empty archive', () => {
    const index = new NoveltyIndex();
    const coverage = index.computeCoverage([], 5);
    expect(coverage).toBe(0);
  });
});
