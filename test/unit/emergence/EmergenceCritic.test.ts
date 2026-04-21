/**
 * Unit tests for EmergenceCritic — Phase 14
 *
 * Tests ensemble evaluation of emergence signals.
 */

import { describe, it, expect } from 'vitest';
import { EmergenceCritic } from '../../../src/emergence/EmergenceCritic.js';
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

const OUTPUT = [
  'function draw() {',
  '  let t = frameCount * 0.01;',
  '  for (let i = 0; i < 10; i++) {',
  '    let x = noise(i * 0.5, t) * width;',
  '    let y = noise(i * 0.5 + 100, t) * height;',
  '    ellipse(x, y, 20, 20);',
  '  }',
  '  if (frameCount > 100) { background(0); }',
  '}',
].join('\n');

const MOCK_EXTRACT = (output: string) => makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });

describe('EmergenceCritic', () => {
  it('evaluateQuick returns all signals and composite', () => {
    const critic = new EmergenceCritic();
    const desc = makeDescriptor({ 'order-chaos': 0.6, 'sparse-dense': 0.4 });
    const archive = [makeEntry('a', { 'order-chaos': 0.2, 'sparse-dense': 0.8 }, 0.7)];

    const result = critic.evaluateQuick({
      descriptor: desc,
      qualityScore: 0.8,
      archive,
      output: OUTPUT,
    });

    expect(result.signals.novelty).toBeGreaterThanOrEqual(0);
    expect(result.signals.novelty).toBeLessThanOrEqual(1);
    expect(result.signals.structure).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(1);
    expect(result.mode).toBe('quick');
    expect(result.breakdown).toHaveLength(6);
  });

  it('evaluateFull computes perturbation resilience with extractFn', async () => {
    const critic = new EmergenceCritic();
    const desc = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const archive = [makeEntry('a', { 'order-chaos': 0.3, 'sparse-dense': 0.7 }, 0.6)];

    const result = await critic.evaluateFull({
      output: OUTPUT,
      descriptor: desc,
      qualityScore: 0.8,
      archive,
      extractFn: MOCK_EXTRACT,
    });

    expect(result.mode).toBe('full');
    expect(result.signals.perturbationResilience).toBeGreaterThanOrEqual(0);
    expect(result.signals.perturbationResilience).toBeLessThanOrEqual(1);
  });

  it('composite is weighted sum across all signal breakdowns', () => {
    const critic = new EmergenceCritic();
    const desc = makeDescriptor({ 'order-chaos': 0.5 });
    const archive = [makeEntry('a', { 'order-chaos': 0.2 }, 0.7)];

    const result = critic.evaluateQuick({ descriptor: desc, qualityScore: 0.5, archive, output: OUTPUT });

    // Verify composite equals sum of breakdown contributions
    const expectedComposite = result.breakdown.reduce((sum, b) => sum + b.contribution, 0);
    expect(result.composite).toBeCloseTo(expectedComposite, 10);
    // Default weights should sum to 1.0
    const totalWeight = result.breakdown.reduce((sum, b) => sum + b.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it('clamps signals to [0, 1]', () => {
    const critic = new EmergenceCritic();
    const desc = makeDescriptor({ 'order-chaos': 0.5 });
    const result = critic.evaluateQuick({ descriptor: desc, qualityScore: 0.5, archive: [], output: 'short' });
    for (const key of Object.keys(result.signals)) {
      expect(result.signals[key as keyof typeof result.signals]).toBeGreaterThanOrEqual(0);
      expect(result.signals[key as keyof typeof result.signals]).toBeLessThanOrEqual(1);
    }
  });

  it('exposes sub-components via getters', () => {
    const critic = new EmergenceCritic();
    expect(critic.getNoveltyIndex()).toBeDefined();
    expect(critic.getTemporalAnalyzer()).toBeDefined();
    expect(critic.getPerturbationProbe()).toBeDefined();
  });
});
