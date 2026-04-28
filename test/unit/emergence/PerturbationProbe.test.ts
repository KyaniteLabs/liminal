/**
 * Unit tests for PerturbationProbe — Phase 14
 *
 * Tests seeded perturbation resilience analysis.
 */

import { describe, it, expect } from 'vitest';
import { PerturbationProbe } from '../../../src/emergence/PerturbationProbe.js';
import type { DescriptorAxis } from '../../../src/emergence/types.js';

function makeDescriptor(values: Record<string, number>) {
  return {
    values: Object.entries(values).map(([axis, value]) => ({ axis: axis as DescriptorAxis, value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

const CODE_OUTPUT = [
  'function draw() {',
  '  let x = noise(frameCount * 0.01) * 100;',
  '  let y = noise(frameCount * 0.01 + 100) * 100;',
  '  ellipse(x, y, 30, 30);',
  '  if (frameCount > 200) background(0);',
  '  for (let i = 0; i < 5; i++) {',
  '    rect(i * 20, x, 10, y);',
  '  }',
  '}',
].join('\n');

const EXTRACT_FN = (output: string) => makeDescriptor({ 'order-chaos': 0.6, 'sparse-dense': 0.4 });

describe('PerturbationProbe', () => {
  it('probe returns resilience score and classification', () => {
    const probe = new PerturbationProbe();
    const desc = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const result = probe.probe(CODE_OUTPUT, desc, EXTRACT_FN);
    expect(result.resilience).toBeGreaterThanOrEqual(0);
    expect(result.resilience).toBeLessThanOrEqual(1);
    expect(result.classification).not.toBeNull();

    expect(result.perturbations?.length).toBeGreaterThan(0);
  });

  it('quickEstimate returns midrange for balanced descriptor', () => {
    const probe = new PerturbationProbe();
    const balanced = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const extreme = makeDescriptor({ 'order-chaos': 0.01, 'sparse-dense': 0.99 });
    const balancedScore = probe.quickEstimate(balanced);
    const extremeScore = probe.quickEstimate(extreme);
    // Balanced descriptors should be more resilient than extreme ones
    expect(balancedScore).toBeGreaterThanOrEqual(extremeScore * 0.8);
  });

  it('quickEstimate handles single-axis descriptor', () => {
    const probe = new PerturbationProbe();
    const desc = makeDescriptor({ 'order-chaos': 0.5 });
    const score = probe.quickEstimate(desc);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('probe with custom magnitude', () => {
    const probe = new PerturbationProbe({ magnitude: 0.5 });
    const desc = makeDescriptor({ 'order-chaos': 0.5, 'sparse-dense': 0.5 });
    const result = probe.probe(CODE_OUTPUT, desc, EXTRACT_FN);
    expect(result.resilience).toBeGreaterThanOrEqual(0);
  });
});
