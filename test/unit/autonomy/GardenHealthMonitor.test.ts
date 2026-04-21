/**
 * Unit tests for GardenHealthMonitor — Phase 15
 *
 * Tests garden health measurement and trend tracking.
 */

import { describe, it, expect } from 'vitest';
import { GardenHealthMonitor } from '../../../src/autonomy/GardenHealthMonitor.js';
import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../../../src/emergence/types.js';

function makeDescriptor(values: Record<string, number>) {
  return {
    values: Object.entries(values).map(([axis, value]) => ({ axis: axis as DescriptorAxis, value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, quality: number, fertility: number = 0.5): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'test', path: `test/${id}` },
    descriptor: makeDescriptor({ 'order-chaos': 0.5 }),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(id: string, quality: number, fertility: number = 0.5): ArchiveCell {
  return { niche: { center: makeDescriptor({ 'order-chaos': 0.5 }), radius: 0.2 }, elite: makeEntry(id, quality, fertility) };
}

function makeEmptyCell(): ArchiveCell {
  return { niche: { center: makeDescriptor({ 'order-chaos': 0.5 }), radius: 0.2 }, elite: undefined };
}

describe('GardenHealthMonitor', () => {
  it('measures empty archive correctly', () => {
    const monitor = new GardenHealthMonitor();
    const metrics = monitor.measure([]);
    expect(metrics.archiveSize).toBe(0);
    expect(metrics.nicheOccupancy).toBe(0);
    expect(metrics.healthLevel).toBe('declining');
  });

  it('measures populated archive', () => {
    const monitor = new GardenHealthMonitor();
    const cells = [
      makeCell('a', 0.8, 0.7),
      makeCell('b', 0.7, 0.6),
    ];
    const metrics = monitor.measure(cells);
    expect(metrics.archiveSize).toBe(2);
    expect(metrics.fertilityYield).toBeCloseTo(0.65, 2);
    expect(metrics.avgLineageDepth).toBe(1); // No parents
  });

  it('tracks taste alignment', () => {
    const monitor = new GardenHealthMonitor();
    const cells = [makeCell('a', 0.8), makeCell('b', 0.7)];
    const alignedIds = new Set(['a']);
    const metrics = monitor.measure(cells, alignedIds);
    expect(metrics.tasteAlignment).toBeCloseTo(0.5, 2);
  });

  it('classifies thriving garden', () => {
    const monitor = new GardenHealthMonitor({ thrivingThreshold: 0.5 });
    // 10 cells, all occupied, high fertility
    const cells = Array.from({ length: 10 }, (_, i) => makeCell(`e${i}`, 0.9, 0.8));
    const alignedIds = new Set(cells.map(c => c.elite!.id));
    const metrics = monitor.measure(cells, alignedIds);
    expect(metrics.healthLevel).toBe('thriving');
  });

  it('tracks trend across measurements', () => {
    const monitor = new GardenHealthMonitor();
    // First measurement: small archive
    const smallCells = [makeCell('a', 0.5, 0.3)];
    monitor.measure(smallCells);

    // Second measurement: larger, better archive
    const bigCells = Array.from({ length: 10 }, (_, i) => makeCell(`e${i}`, 0.9, 0.8));
    monitor.measure(bigCells);

    const trend = monitor.getTrend(2);
    expect(trend).toBe('improving');
  });

  it('maintains measurement history', () => {
    const monitor = new GardenHealthMonitor();
    monitor.measure([makeCell('a', 0.5)]);
    monitor.measure([makeCell('a', 0.5)]);
    const history = monitor.getHistory();
    expect(history).toHaveLength(2);
  });

  it('computes lineage depth from parentIds', () => {
    const monitor = new GardenHealthMonitor();
    const entry: ArchiveEntry = {
      ...makeEntry('deep', 0.7),
      lineage: { artifactId: 'deep', parentIds: ['p1', 'p2'], provenance: 'remix', createdAt: new Date().toISOString() },
    };
    const cell: ArchiveCell = { niche: { center: makeDescriptor({ 'order-chaos': 0.5 }), radius: 0.2 }, elite: entry };
    const metrics = monitor.measure([cell]);
    expect(metrics.avgLineageDepth).toBe(3); // 2 parents + 1 = 3
  });
});
