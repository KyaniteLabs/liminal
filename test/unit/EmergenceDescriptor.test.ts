import { describe, it, expect } from 'vitest';
import { BehaviorDescriptorExtractor } from '../../src/emergence/BehaviorDescriptorExtractor.js';
import { ArchivePlacement } from '../../src/emergence/ArchivePlacement.js';
import type { ArchiveEntry, BehaviorDescriptor, LineageRecord, EmergenceSignals } from '../../src/emergence/types.js';
import type { LiminalObjectRef } from '../../src/fs/types.js';

// ── BehaviorDescriptorExtractor ──

describe('BehaviorDescriptorExtractor', () => {
  const extractor = new BehaviorDescriptorExtractor();

  it('extracts all 6 descriptor axes by default', () => {
    const descriptor = extractor.extract('function draw() { background(0); }');
    expect(descriptor.values).toHaveLength(6);
    expect(descriptor.source).toBe('heuristic-v1');
    expect(descriptor.extractedAt).toBeTruthy();
  });

  it('produces values in the 0–1 range for any input', () => {
    const inputs = [
      '', 'a', 'x'.repeat(10000),
      'function draw() { background(255); circle(100, 100, 50); }',
      'const x = 1;\nconst y = 2;\nconst z = 3;\n',
      ' chaotic!@#$%^&*()_+ random CONTENT with MIXED_case And_symbols ',
    ];
    for (const input of inputs) {
      const descriptor = extractor.extract(input);
      for (const v of descriptor.values) {
        expect(v.value).toBeGreaterThanOrEqual(0);
        expect(v.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('extracts only specified axes when configured', () => {
    const partial = new BehaviorDescriptorExtractor({ axes: ['order-chaos', 'sparse-dense'] });
    const descriptor = partial.extract('some code');
    expect(descriptor.values).toHaveLength(2);
    const axisNames = descriptor.values.map(v => v.axis);
    expect(axisNames).toContain('order-chaos');
    expect(axisNames).toContain('sparse-dense');
  });

  it('assigns different descriptors to different inputs', () => {
    const ordered = extractor.extract('line1\nline2\nline3\nline4\nline5\n');
    const chaotic = extractor.extract('a\n\n\n\nbb\n\nccc\n\ndddd\n\neeeeeeeeeeeeee\n');
    // order-chaos axis should differ
    const orderedOC = ordered.values.find(v => v.axis === 'order-chaos')!.value;
    const chaoticOC = chaotic.values.find(v => v.axis === 'order-chaos')!.value;
    // Chaotic input should have higher chaos (closer to 1) than ordered
    expect(chaoticOC).toBeGreaterThan(orderedOC);
  });

  it('detects evolving content via temporal keywords', () => {
    const static_ = extractor.extract('const x = 5;');
    const evolving = extractor.extract('function draw() { let t = frameCount * 0.01; animate(t); }');
    const staticVal = static_.values.find(v => v.axis === 'static-evolving')!.value;
    const evolvingVal = evolving.values.find(v => v.axis === 'static-evolving')!.value;
    expect(evolvingVal).toBeGreaterThan(staticVal);
  });

  it('uses custom source label', () => {
    const custom = new BehaviorDescriptorExtractor({ source: 'llm-v1' });
    const descriptor = custom.extract('test');
    expect(descriptor.source).toBe('llm-v1');
  });

  it('getAvailableAxes returns configured axes', () => {
    expect(extractor.getAvailableAxes()).toHaveLength(6);
    const partial = new BehaviorDescriptorExtractor({ axes: ['sparse-dense'] });
    expect(partial.getAvailableAxes()).toEqual(['sparse-dense']);
  });
});

// ── ArchivePlacement ──

function makeEntry(id: string, qualityScore: number, descriptorOverrides?: Partial<BehaviorDescriptor>): ArchiveEntry {
  const descriptor: BehaviorDescriptor = {
    values: [
      { axis: 'order-chaos', value: 0.5 },
      { axis: 'sparse-dense', value: 0.5 },
      { axis: 'symmetry-asymmetry', value: 0.5 },
      { axis: 'smooth-bursty', value: 0.5 },
      { axis: 'static-evolving', value: 0.5 },
      { axis: 'harmonic-dissonant', value: 0.5 },
    ],
    source: 'heuristic-v1',
    extractedAt: new Date().toISOString(),
    ...descriptorOverrides,
  };

  const lineage: LineageRecord = {
    artifactId: id,
    parentIds: [],
    provenance: 'fresh-generation',
    createdAt: new Date().toISOString(),
  };

  const signals: EmergenceSignals = {
    novelty: 0.5, structure: 0.5, temporalRichness: 0.5,
    perturbationResilience: 0.5, fertility: 0.5, aesthetic: qualityScore,
  };

  const ref: LiminalObjectRef = {
    uri: `liminal://artifact/${id}`,
    kind: 'generated-code',
  };

  return { id, artifactRef: ref, descriptor, lineage, qualityScore, signals, archivedAt: new Date().toISOString() };
}

describe('ArchivePlacement', () => {
  it('places first artifact into a new cell', () => {
    const archive = new ArchivePlacement();
    const result = archive.place({
      artifactRef: { uri: 'test://a', kind: 'generated-code' },
      descriptor: { values: [{ axis: 'order-chaos', value: 0.35 }], source: 'test', extractedAt: '' },
      lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.8,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    expect(result.accepted).toBe(true);
    expect(result.outcome).toBe('new-cell');
    expect(result.cellId).toContain('order-chaos');
  });

  it('rejects artifacts below minimum quality', () => {
    const archive = new ArchivePlacement({ minQuality: 0.5 });
    const result = archive.place({
      artifactRef: { uri: 'test://low', kind: 'generated-code' },
      descriptor: { values: [{ axis: 'order-chaos', value: 0.5 }], source: 'test', extractedAt: '' },
      lineage: { artifactId: 'low', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.2,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    expect(result.accepted).toBe(false);
    expect(result.outcome).toBe('rejected');
  });

  it('replaces elite when higher quality arrives in same cell', () => {
    const archive = new ArchivePlacement({ binsPerAxis: 10 });
    const desc = { values: [{ axis: 'order-chaos', value: 0.52 }], source: 'test', extractedAt: '' };

    archive.place({
      artifactRef: { uri: 'test://a', kind: 'generated-code' },
      descriptor: desc,
      lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.6,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    const result = archive.place({
      artifactRef: { uri: 'test://b', kind: 'generated-code' },
      descriptor: desc,
      lineage: { artifactId: 'b', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.9,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    expect(result.accepted).toBe(true);
    expect(result.outcome).toBe('replaced-elite');
    expect(result.displaced).toBeDefined();
    expect(result.displaced!.id).toBe('test://a');
  });

  it('places different descriptors into different cells', () => {
    const archive = new ArchivePlacement();
    const desc1 = { values: [{ axis: 'order-chaos', value: 0.1 }], source: 'test', extractedAt: '' };
    const desc2 = { values: [{ axis: 'order-chaos', value: 0.9 }], source: 'test', extractedAt: '' };

    archive.place({
      artifactRef: { uri: 'test://a', kind: 'generated-code' },
      descriptor: desc1,
      lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.7,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    const result = archive.place({
      artifactRef: { uri: 'test://b', kind: 'generated-code' },
      descriptor: desc2,
      lineage: { artifactId: 'b', parentIds: [], provenance: 'fresh-generation', createdAt: '' },
      qualityScore: 0.7,
      signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    });

    expect(result.accepted).toBe(true);
    expect(result.outcome).toBe('new-cell');
    expect(archive.getAllCells()).toHaveLength(2);
  });

  it('getAllElites returns one elite per cell', () => {
    const archive = new ArchivePlacement();
    archive.place({ artifactRef: { uri: 't://a', kind: 'generated-code' }, descriptor: { values: [{ axis: 'order-chaos', value: 0.2 }], source: 'test', extractedAt: '' }, lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' }, qualityScore: 0.7, signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 } });
    archive.place({ artifactRef: { uri: 't://b', kind: 'generated-code' }, descriptor: { values: [{ axis: 'order-chaos', value: 0.8 }], source: 'test', extractedAt: '' }, lineage: { artifactId: 'b', parentIds: [], provenance: 'fresh-generation', createdAt: '' }, qualityScore: 0.7, signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 } });

    const elites = archive.getAllElites();
    expect(elites).toHaveLength(2);
  });

  it('getStats returns correct totals', () => {
    const archive = new ArchivePlacement();
    expect(archive.getStats().totalCells).toBe(0);
    expect(archive.getStats().totalElites).toBe(0);

    archive.place({ artifactRef: { uri: 't://a', kind: 'generated-code' }, descriptor: { values: [{ axis: 'order-chaos', value: 0.5 }], source: 'test', extractedAt: '' }, lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' }, qualityScore: 0.8, signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 } });

    const stats = archive.getStats();
    expect(stats.totalCells).toBe(1);
    expect(stats.totalElites).toBe(1);
    expect(stats.avgQuality).toBeCloseTo(0.8);
  });

  it('exportState/importState round-trips archive', () => {
    const archive = new ArchivePlacement();
    archive.place({ artifactRef: { uri: 't://a', kind: 'generated-code' }, descriptor: { values: [{ axis: 'order-chaos', value: 0.5 }], source: 'test', extractedAt: '' }, lineage: { artifactId: 'a', parentIds: [], provenance: 'fresh-generation', createdAt: '' }, qualityScore: 0.8, signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 } });

    const state = archive.exportState();
    const archive2 = new ArchivePlacement();
    archive2.importState({ cells: Array.from(state.cells.entries()), index: Array.from(state.index.entries()) });
    expect(archive2.getAllCells()).toHaveLength(1);
  });
});
