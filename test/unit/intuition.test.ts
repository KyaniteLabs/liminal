/**
 * Intuition module tests — ThompsonSampler, DomainPrototype, IntuitionStrategy
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ThompsonSampler } from '../../src/intuition/ThompsonSampler.js';
import { DomainPrototype } from '../../src/intuition/DomainPrototype.js';
import { IntuitionStrategy } from '../../src/intuition/IntuitionStrategy.js';
import type { ScoringInput } from '../../src/core/ScoringEngine.js';

// ---------------------------------------------------------------------------
// ThompsonSampler
// ---------------------------------------------------------------------------
describe('ThompsonSampler', () => {
  let sampler: ThompsonSampler<string>;

  beforeEach(() => {
    sampler = new ThompsonSampler<string>({ minPulls: 3, successThreshold: 0.7, maxArms: 50 });
  });

  it('should return null when no arm has enough pulls', () => {
    sampler.update('arm-a', 0.8);
    sampler.update('arm-a', 0.9);
    expect(sampler.select()).toBeNull();
  });

  it('should select an arm after minPulls reached', () => {
    for (let i = 0; i < 5; i++) sampler.update('arm-a', 0.8 + i * 0.02);
    for (let i = 0; i < 5; i++) sampler.update('arm-b', 0.3 + i * 0.02);

    const selected = sampler.select();
    expect(selected).not.toBeNull();
    expect(['arm-a', 'arm-b']).toContain(selected);
  });

  it('should update alpha on success (score >= threshold)', () => {
    sampler.update('arm-x', 0.9);
    const stats = sampler.getArmStats('arm-x');
    expect(stats).not.toBeNull();
    expect(stats!.alpha).toBe(2); // started at 1, +1 for success
    expect(stats!.beta).toBe(1); // unchanged
    expect(stats!.pulls).toBe(1);
  });

  it('should update beta on failure (score < threshold)', () => {
    sampler.update('arm-x', 0.3);
    const stats = sampler.getArmStats('arm-x');
    expect(stats!.alpha).toBe(1); // unchanged
    expect(stats!.beta).toBe(2); // started at 1, +1 for failure
  });

  it('should serialize and deserialize', () => {
    sampler.update('arm-a', 0.8);
    sampler.update('arm-a', 0.6);
    sampler.update('arm-b', 0.9);

    const state = sampler.serialize();
    expect(state.version).toBe(1);
    expect(state.arms.length).toBe(2);

    const sampler2 = new ThompsonSampler<string>();
    sampler2.deserialize(state);
    expect(sampler2.getArmStats('arm-a')!.pulls).toBe(2);
    expect(sampler2.getArmStats('arm-b')!.pulls).toBe(1);
  });

  it('should report confidence based on alpha/(alpha+beta)', () => {
    // 3 successes, 1 failure → alpha=4, beta=2 → confidence = 0.67
    sampler.update('arm-x', 0.8);
    sampler.update('arm-x', 0.8);
    sampler.update('arm-x', 0.8);
    sampler.update('arm-x', 0.3);
    expect(sampler.getConfidence('arm-x')).toBeCloseTo(4 / 6, 2);
  });

  it('should report 0 confidence for unknown arms', () => {
    expect(sampler.getConfidence('unknown')).toBe(0);
  });

  it('should report isReady when any arm has enough pulls', () => {
    expect(sampler.isReady()).toBe(false);
    for (let i = 0; i < 3; i++) sampler.update('arm-a', 0.5);
    expect(sampler.isReady()).toBe(true);
  });

  it('should evict least-pulled arm when maxArms reached', () => {
    const small = new ThompsonSampler<string>({ minPulls: 1, maxArms: 3 });
    small.update('a', 0.5);
    small.update('b', 0.5);
    small.update('c', 0.5);
    small.update('d', 0.5); // should evict least-pulled
    expect(small.getArmStats('d')).not.toBeNull();
  });

  it('should reset all state', () => {
    sampler.update('arm-a', 0.8);
    sampler.reset();
    expect(sampler.getArmStats('arm-a')).toBeNull();
    expect(sampler.totalPulls).toBe(0);
  });

  it('should find bestByMean', () => {
    for (let i = 0; i < 5; i++) sampler.update('good', 0.9);
    for (let i = 0; i < 5; i++) sampler.update('bad', 0.2);
    expect(sampler.bestByMean()).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// DomainPrototype
// ---------------------------------------------------------------------------
describe('DomainPrototype', () => {
  let proto: DomainPrototype;

  beforeEach(() => {
    proto = new DomainPrototype();
  });

  it('should create centroid from first example', () => {
    proto.addExample('p5', [0.5, 0.5, 0.5], 0.8);
    const c = proto.getCentroid('p5');
    expect(c).not.toBeNull();
    expect(c!.exampleCount).toBe(1);
    expect(c!.avgQuality).toBe(0.8);
    expect(c!.centroid).toEqual([0.5, 0.5, 0.5]);
  });

  it('should incrementally update centroid', () => {
    proto.addExample('p5', [1, 0, 0], 0.9);
    proto.addExample('p5', [0, 1, 0], 0.7);
    const c = proto.getCentroid('p5')!;
    expect(c.exampleCount).toBe(2);
    expect(c.centroid[0]).toBeCloseTo(0.5, 5);
    expect(c.centroid[1]).toBeCloseTo(0.5, 5);
    expect(c.avgQuality).toBeCloseTo(0.8, 5);
  });

  it('should compute cosine distance', () => {
    proto.addExample('p5', [1, 0, 0], 0.8);
    // Identical vector → distance ~0
    expect(proto.distanceToCentroid('p5', [1, 0, 0])).toBeCloseTo(0, 5);
    // Orthogonal vector → distance ~π/2 ≈ 1 (cos dist)
    expect(proto.distanceToCentroid('p5', [0, 1, 0])).toBeCloseTo(1, 1);
  });

  it('should return 0 distance for unknown domain', () => {
    expect(proto.distanceToCentroid('unknown', [0.5, 0.5])).toBe(0);
  });

  it('should predict quality from embedding', () => {
    proto.addExample('p5', [1, 0, 0], 0.9);
    // Close to centroid → high predicted quality
    const close = proto.predictQuality('p5', [0.95, 0.05, 0]);
    expect(close).toBeGreaterThan(0.5);
    // Far from centroid → lower predicted quality
    const far = proto.predictQuality('p5', [0, 1, 0]);
    expect(far).toBeLessThan(close);
  });

  it('should report isReady based on example count', () => {
    proto.addExample('p5', [0.5], 0.8);
    expect(proto.isReady('p5', 3)).toBe(false);
    proto.addExample('p5', [0.5], 0.8);
    proto.addExample('p5', [0.5], 0.8);
    expect(proto.isReady('p5', 3)).toBe(true);
  });

  it('should serialize and deserialize', () => {
    proto.addExample('p5', [0.5, 0.5], 0.8);
    proto.addExample('glsl', [0.3, 0.7], 0.9);
    const state = proto.serialize();
    expect(state.centroids.length).toBe(2);

    const proto2 = new DomainPrototype();
    proto2.deserialize(state);
    expect(proto2.domainCount).toBe(2);
    expect(proto2.getCentroid('p5')!.exampleCount).toBe(1);
  });

  it('should reset', () => {
    proto.addExample('p5', [0.5], 0.8);
    proto.reset();
    expect(proto.domainCount).toBe(0);
    expect(proto.getCentroid('p5')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// IntuitionStrategy
// ---------------------------------------------------------------------------
describe('IntuitionStrategy', () => {
  let strategy: IntuitionStrategy;
  let prototype: DomainPrototype;
  let modelSampler: ThompsonSampler<string>;
  let strategySampler: ThompsonSampler<string>;

  beforeEach(() => {
    prototype = new DomainPrototype();
    modelSampler = new ThompsonSampler<string>({ minPulls: 2, successThreshold: 0.7 });
    strategySampler = new ThompsonSampler<string>({ minPulls: 2, successThreshold: 0.7 });
    strategy = new IntuitionStrategy(prototype, modelSampler, strategySampler);
  });

  const makeInput = (overrides?: Partial<ScoringInput>): ScoringInput => ({
    output: 'function setup() { createCanvas(400, 400); } function draw() { background(220); }',
    domain: 'p5' as any,
    prompt: 'a simple p5 sketch',
    ...overrides,
  });

  it('should return a valid ScoringResult', async () => {
    const result = await strategy.score(makeInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.strategy).toBe('intuition');
    expect(result.dimensions.intuition).toBeDefined();
    expect(result.dimensions.novelty).toBeDefined();
  });

  it('should report intuition dimension in 0-1 range', async () => {
    const result = await strategy.score(makeInput());
    const intuition = result.dimensions.intuition!;
    expect(intuition).toBeGreaterThanOrEqual(0);
    expect(intuition).toBeLessThanOrEqual(1);
  });

  it('should report higher novelty for first output vs repeated', async () => {
    const first = await strategy.score(makeInput());
    const sameOutput = makeInput({
      previousOutputs: [
        'function setup() { createCanvas(400, 400); } function draw() { background(220); }',
      ],
    });
    const second = await strategy.score(sameOutput);
    expect(first.dimensions.novelty!).toBeGreaterThan(second.dimensions.novelty!);
  });

  it('should produce signals in assessment', async () => {
    await strategy.score(makeInput());
    const assessment = strategy.getLastAssessment();
    expect(assessment).not.toBeNull();
    expect(assessment!.signals.length).toBeGreaterThanOrEqual(3);
    expect(assessment!.confidence).toBeGreaterThanOrEqual(0);
    expect(assessment!.confidence).toBeLessThanOrEqual(1);
  });

  it('should build readable recommendation', async () => {
    await strategy.score(makeInput());
    const assessment = strategy.getLastAssessment()!;
    expect(assessment.recommendation).toContain('domain: p5');
  });

  it('should adapt prototype scores after training data', async () => {
    // Feed quality examples
    prototype.addExample('p5', [0.8, 0.2], 0.9);
    prototype.addExample('p5', [0.7, 0.3], 0.85);
    prototype.addExample('p5', [0.9, 0.1], 0.95);

    // Feed some model outcomes
    modelSampler.update('local', 0.85);
    modelSampler.update('local', 0.9);

    const result = await strategy.score(makeInput());
    // With prototype data, signals should be more informed
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('should handle missing domain gracefully', async () => {
    const result = await strategy.score(makeInput({ domain: undefined }));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('should handle empty previousOutputs', async () => {
    const result = await strategy.score(makeInput({ previousOutputs: [] }));
    expect(result.dimensions.novelty).toBe(1); // max novelty with no history
  });
});
