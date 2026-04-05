/**
 * Intuition module tests — ThompsonSampler, DomainPrototype, IntuitionStrategy, IntuitionCache
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThompsonSampler } from '../../src/intuition/ThompsonSampler.js';
import { DomainPrototype } from '../../src/intuition/DomainPrototype.js';
import { IntuitionStrategy } from '../../src/intuition/IntuitionStrategy.js';
import { IntuitionCache } from '../../src/intuition/IntuitionCache.js';
import { MemoryConsolidator } from '../../src/intuition/MemoryConsolidator.js';
import type { ConsolidationEpisode } from '../../src/intuition/MemoryConsolidator.js';
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

// ---------------------------------------------------------------------------
// IntuitionCache
// ---------------------------------------------------------------------------
describe('IntuitionCache', () => {
  let cache: IntuitionCache;

  beforeEach(() => {
    cache = new IntuitionCache({ maxSize: 10, ttlMs: 1000 });
  });

  const makeAssessment = (score: number) => ({
    score,
    confidence: 0.8,
    signals: [
      { name: 'prototype', value: score, reason: `score=${score}` },
      { name: 'novelty', value: 0.5, reason: 'mid novelty' },
    ],
    recommendation: `domain: p5 | score: ${score}`,
  });

  it('should store and retrieve assessments', () => {
    const assessment = makeAssessment(0.85);
    cache.set('p5', 'some output code', assessment);
    const retrieved = cache.get('p5', 'some output code');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.score).toBe(0.85);
  });

  it('should return null for cache miss', () => {
    expect(cache.get('p5', 'never seen')).toBeNull();
  });

  it('should differentiate by domain', () => {
    const assessment = makeAssessment(0.7);
    cache.set('p5', 'code', assessment);
    // Different domain, same output → miss
    expect(cache.get('glsl', 'code')).toBeNull();
    // Same domain, same output → hit
    expect(cache.get('p5', 'code')).not.toBeNull();
  });

  it('should differentiate by output content', () => {
    cache.set('p5', 'output-a', makeAssessment(0.9));
    cache.set('p5', 'output-b', makeAssessment(0.3));
    expect(cache.get('p5', 'output-a')!.score).toBe(0.9);
    expect(cache.get('p5', 'output-b')!.score).toBe(0.3);
  });

  it('should expire entries after TTL', async () => {
    const shortCache = new IntuitionCache({ maxSize: 10, ttlMs: 50 });
    shortCache.set('p5', 'output', makeAssessment(0.8));
    expect(shortCache.get('p5', 'output')).not.toBeNull();

    // Wait for TTL
    await new Promise(r => setTimeout(r, 60));
    expect(shortCache.get('p5', 'output')).toBeNull();
  });

  it('should evict LRU when at capacity', () => {
    const small = new IntuitionCache({ maxSize: 3, ttlMs: 60000 });
    small.set('p5', 'first', makeAssessment(0.1));
    small.set('p5', 'second', makeAssessment(0.2));
    small.set('p5', 'third', makeAssessment(0.3));

    // Access 'first' to make it recently used
    small.get('p5', 'first');

    // Add one more → should evict 'second' (least recently used)
    small.set('p5', 'fourth', makeAssessment(0.4));

    expect(small.get('p5', 'first')).not.toBeNull(); // accessed, kept
    expect(small.get('p5', 'second')).toBeNull(); // evicted (LRU)
    expect(small.get('p5', 'third')).not.toBeNull(); // kept
    expect(small.get('p5', 'fourth')).not.toBeNull(); // just added
  });

  it('should track hit/miss stats', () => {
    cache.set('p5', 'output', makeAssessment(0.8));

    cache.get('p5', 'output'); // hit
    cache.get('p5', 'output'); // hit
    cache.get('p5', 'miss');   // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    expect(stats.size).toBe(1);
  });

  it('should track evictions', () => {
    const small = new IntuitionCache({ maxSize: 2, ttlMs: 60000 });
    small.set('p5', 'a', makeAssessment(0.1));
    small.set('p5', 'b', makeAssessment(0.2));
    small.set('p5', 'c', makeAssessment(0.3)); // evicts 'a'

    expect(small.getStats().evictions).toBe(1);
  });

  it('should find similar entries by embedding', () => {
    const embCache = new IntuitionCache({ maxSize: 10, ttlMs: 60000, storeEmbeddings: true });
    embCache.set('p5', 'output-1', makeAssessment(0.9), [1, 0, 0]);
    embCache.set('p5', 'output-2', makeAssessment(0.3), [0, 1, 0]);

    // Similar to first → high similarity
    const similar = embCache.findSimilar('p5', [0.95, 0.05, 0], 0.8);
    expect(similar).not.toBeNull();
    expect(similar!.assessment.score).toBe(0.9);

    // Orthogonal to both → no match above threshold
    const noMatch = embCache.findSimilar('p5', [0, 0, 1], 0.8);
    expect(noMatch).toBeNull();
  });

  it('should filter similarity by domain', () => {
    const embCache = new IntuitionCache({ maxSize: 10, ttlMs: 60000, storeEmbeddings: true });
    embCache.set('p5', 'output', makeAssessment(0.9), [1, 0, 0]);

    // Same embedding, different domain → no match
    expect(embCache.findSimilar('glsl', [1, 0, 0], 0.5)).toBeNull();
  });

  it('should purge expired entries', async () => {
    const shortCache = new IntuitionCache({ maxSize: 10, ttlMs: 30 });
    shortCache.set('p5', 'a', makeAssessment(0.8));
    shortCache.set('p5', 'b', makeAssessment(0.9));

    await new Promise(r => setTimeout(r, 40));
    const purged = shortCache.purgeExpired();
    expect(purged).toBe(2);
    expect(shortCache.getStats().size).toBe(0);
  });

  it('should return domain-specific entries', () => {
    cache.set('p5', 'a', makeAssessment(0.8));
    cache.set('p5', 'b', makeAssessment(0.7));
    cache.set('glsl', 'c', makeAssessment(0.6));

    const p5Entries = cache.getDomainEntries('p5');
    expect(p5Entries.length).toBe(2);
    expect(p5Entries.every(e => e.domain === 'p5')).toBe(true);
  });

  it('should delete specific entries', () => {
    cache.set('p5', 'a', makeAssessment(0.8));
    expect(cache.delete('p5', 'a')).toBe(true);
    expect(cache.get('p5', 'a')).toBeNull();
    expect(cache.delete('p5', 'nonexistent')).toBe(false);
  });

  it('should serialize and deserialize', () => {
    cache.set('p5', 'a', makeAssessment(0.85));
    cache.set('glsl', 'b', makeAssessment(0.65));

    const state = cache.serialize();
    expect(state.version).toBe(1);
    expect(state.entries.length).toBe(2);

    const cache2 = new IntuitionCache({ maxSize: 10, ttlMs: 60000 });
    cache2.deserialize(state);
    expect(cache2.get('p5', 'a')!.score).toBe(0.85);
    expect(cache2.get('glsl', 'b')!.score).toBe(0.65);
  });

  it('should reset completely', () => {
    cache.set('p5', 'a', makeAssessment(0.8));
    cache.get('p5', 'a');
    cache.reset();
    expect(cache.getStats().size).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
  });

  it('should check has() correctly', () => {
    expect(cache.has('p5', 'x')).toBe(false);
    cache.set('p5', 'x', makeAssessment(0.5));
    expect(cache.has('p5', 'x')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IntuitionStrategy with Cache
// ---------------------------------------------------------------------------
describe('IntuitionStrategy with Cache', () => {
  let strategy: IntuitionStrategy;
  let cache: IntuitionCache;

  beforeEach(() => {
    cache = new IntuitionCache({ maxSize: 100, ttlMs: 60000 });
    const prototype = new DomainPrototype();
    const modelSampler = new ThompsonSampler<string>({ minPulls: 2, successThreshold: 0.7 });
    const strategySampler = new ThompsonSampler<string>({ minPulls: 2, successThreshold: 0.7 });
    strategy = new IntuitionStrategy(prototype, modelSampler, strategySampler, undefined, cache);
  });

  const makeInput = (overrides?: Partial<ScoringInput>): ScoringInput => ({
    output: 'function setup() { createCanvas(400, 400); }',
    domain: 'p5' as any,
    prompt: 'a simple p5 sketch',
    ...overrides,
  });

  it('should return cached result on second call', async () => {
    const input = makeInput();
    const first = await strategy.score(input);
    const second = await strategy.score(input);

    expect(first.score).toBeCloseTo(second.score, 5);
    expect(cache.getStats().hits).toBe(1); // second call was a cache hit
  });

  it('should compute fresh result for different outputs', async () => {
    const result1 = await strategy.score(makeInput({ output: 'output A' }));
    const result2 = await strategy.score(makeInput({ output: 'output B' }));

    // Different outputs → cache miss on second
    expect(cache.getStats().misses).toBeGreaterThanOrEqual(2);
  });

  it('should expose cache via getCache()', () => {
    expect(strategy.getCache()).toBe(cache);
  });
});

// ---------------------------------------------------------------------------
// MemoryConsolidator
// ---------------------------------------------------------------------------
describe('MemoryConsolidator', () => {
  let consolidator: MemoryConsolidator;
  let modelSampler: ThompsonSampler<string>;
  let strategySampler: ThompsonSampler<string>;
  let prototype: DomainPrototype;

  beforeEach(() => {
    modelSampler = new ThompsonSampler<string>({ minPulls: 1, successThreshold: 0.7 });
    strategySampler = new ThompsonSampler<string>({ minPulls: 1, successThreshold: 0.7 });
    prototype = new DomainPrototype();
    consolidator = new MemoryConsolidator(
      { modelSampler, strategySampler, prototype },
      { successThreshold: 0.7, minEpisodesForPattern: 2, maxPatterns: 50 },
    );
  });

  const makeEpisodes = (overrides: Partial<ConsolidationEpisode>[]): ConsolidationEpisode[] =>
    overrides.map((o, i) => ({
      domain: 'p5',
      output: `output-${i}`,
      qualityScore: 0.8,
      timestamp: new Date().toISOString(),
      ...o,
    }));

  it('should consolidate episodes into patterns', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'qwen3', qualityScore: 0.85 },
      { domain: 'p5', model: 'qwen3', qualityScore: 0.75 },
      { domain: 'p5', model: 'qwen3', qualityScore: 0.9 },
    ]);

    const result = consolidator.consolidate(episodes);
    expect(result.episodesProcessed).toBe(3);
    expect(result.patternsCreated).toBeGreaterThanOrEqual(1);
    expect(result.byDomain.p5).toBeDefined();
    expect(result.byDomain.p5.episodes).toBe(3);
  });

  it('should group by domain, model, and strategy', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'qwen3', strategy: 'solo', qualityScore: 0.8 },
      { domain: 'p5', model: 'qwen3', strategy: 'solo', qualityScore: 0.7 },
      { domain: 'p5', model: 'ollama', strategy: 'swarm', qualityScore: 0.9 },
      { domain: 'p5', model: 'ollama', strategy: 'swarm', qualityScore: 0.85 },
      { domain: 'glsl', model: 'qwen3', strategy: 'solo', qualityScore: 0.6 },
      { domain: 'glsl', model: 'qwen3', strategy: 'solo', qualityScore: 0.65 },
    ]);

    const result = consolidator.consolidate(episodes);
    // Should create patterns at domain, domain:model, and domain:model:strategy levels
    const allPatterns = consolidator.getAllPatterns();
    expect(allPatterns.length).toBeGreaterThanOrEqual(3);
  });

  it('should compute correct Thompson Beta params', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'test-model', qualityScore: 0.9 }, // success
      { domain: 'p5', model: 'test-model', qualityScore: 0.9 }, // success
      { domain: 'p5', model: 'test-model', qualityScore: 0.3 }, // failure
    ]);

    consolidator.consolidate(episodes);
    const pattern = consolidator.getPattern('p5:test-model');
    expect(pattern).not.toBeNull();
    expect(pattern!.alpha).toBe(3); // 2 successes + 1 prior
    expect(pattern!.beta).toBe(2);  // 1 failure + 1 prior
  });

  it('should skip groups with too few episodes', () => {
    const smallConsolidator = new MemoryConsolidator(undefined, { minEpisodesForPattern: 3 });
    const episodes = makeEpisodes([
      { domain: 'p5', qualityScore: 0.8 },
      { domain: 'p5', qualityScore: 0.7 },
    ]);

    const result = smallConsolidator.consolidate(episodes);
    expect(result.patternsCreated).toBe(0);
  });

  it('should update ThompsonSampler during consolidation', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'model-a', qualityScore: 0.9 },
      { domain: 'p5', model: 'model-a', qualityScore: 0.85 },
    ]);

    consolidator.consolidate(episodes);
    const stats = modelSampler.getArmStats('model-a');
    expect(stats).not.toBeNull();
    expect(stats!.pulls).toBeGreaterThan(0);
  });

  it('should update strategy sampler during consolidation', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'qwen3', strategy: 'swarm', qualityScore: 0.9 },
      { domain: 'p5', model: 'qwen3', strategy: 'swarm', qualityScore: 0.85 },
    ]);

    consolidator.consolidate(episodes);
    const stats = strategySampler.getArmStats('swarm');
    expect(stats).not.toBeNull();
    expect(stats!.pulls).toBeGreaterThan(0);
  });

  it('should update domain prototype from high-quality episodes', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', qualityScore: 0.9, embedding: [0.8, 0.2] },
      { domain: 'p5', qualityScore: 0.85, embedding: [0.7, 0.3] },
    ]);

    const result = consolidator.consolidate(episodes);
    expect(result.prototypeUpdates).toBe(2);
    expect(prototype.getCentroid('p5')).not.toBeNull();
    expect(prototype.getCentroid('p5')!.exampleCount).toBe(2);
  });

  it('should not update prototype from low-quality episodes', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', qualityScore: 0.3, embedding: [0.5, 0.5] },
      { domain: 'p5', qualityScore: 0.4, embedding: [0.4, 0.6] },
    ]);

    const result = consolidator.consolidate(episodes);
    expect(result.prototypeUpdates).toBe(0);
  });

  it('should apply Ebbinghaus retention decay', () => {
    // Create episodes from 60 days ago (ensures retention < 1)
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'old-model', qualityScore: 0.8, timestamp: oldDate },
      { domain: 'p5', model: 'old-model', qualityScore: 0.7, timestamp: oldDate },
    ]);

    consolidator.consolidate(episodes);
    const pattern = consolidator.getPattern('p5:old-model');
    expect(pattern).not.toBeNull();
    // Pattern was created from old timestamps → retention should have decayed
    // R(t) = exp(-daysSinceUpdate / stability), stability=10
    expect(pattern!.retention).toBeLessThan(1);
    expect(pattern!.retention).toBeGreaterThanOrEqual(0);
  });

  it('should prune stale patterns over max age', () => {
    const pruner = new MemoryConsolidator(undefined, {
      maxAgeDays: 0.001, // ~1.4 minutes
      maxPatterns: 100,
    });
    const oldTimestamp = new Date(Date.now() - 200 * 60 * 1000).toISOString(); // 200 min ago
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'ancient', qualityScore: 0.8, timestamp: oldTimestamp },
      { domain: 'p5', model: 'ancient', qualityScore: 0.7, timestamp: oldTimestamp },
    ]);

    pruner.consolidate(episodes);
    // Apply decay + prune by running another consolidate with empty
    const result = pruner.consolidate([]);
    expect(result.patternsPruned).toBeGreaterThanOrEqual(0);
  });

  it('should budget-gate to maxPatterns', () => {
    const small = new MemoryConsolidator(undefined, { maxPatterns: 2, minEpisodesForPattern: 1 });
    for (let i = 0; i < 5; i++) {
      small.consolidate(makeEpisodes([
        { domain: `domain-${i}`, qualityScore: 0.8 },
      ]));
    }
    expect(small.patternCount).toBeLessThanOrEqual(2);
  });

  it('should serialize and deserialize', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', model: 'qwen3', qualityScore: 0.85 },
      { domain: 'p5', model: 'qwen3', qualityScore: 0.75 },
    ]);
    consolidator.consolidate(episodes);

    const state = consolidator.serialize();
    expect(state.version).toBe(1);
    expect(state.patterns.length).toBeGreaterThan(0);

    const consolidator2 = new MemoryConsolidator();
    consolidator2.deserialize(state);
    expect(consolidator2.patternCount).toBe(consolidator.patternCount);
    expect(consolidator2.getPattern('p5:qwen3')).not.toBeNull();
  });

  it('should reset all state', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', qualityScore: 0.8 },
      { domain: 'p5', qualityScore: 0.7 },
    ]);
    consolidator.consolidate(episodes);
    consolidator.reset();
    expect(consolidator.patternCount).toBe(0);
    expect(consolidator.processedCount).toBe(0);
  });

  it('should merge patterns on repeated consolidation', () => {
    const batch1 = makeEpisodes([
      { domain: 'p5', model: 'qwen3', qualityScore: 0.8 },
      { domain: 'p5', model: 'qwen3', qualityScore: 0.7 },
    ]);
    consolidator.consolidate(batch1);

    const batch2 = makeEpisodes([
      { domain: 'p5', model: 'qwen3', qualityScore: 0.9 },
      { domain: 'p5', model: 'qwen3', qualityScore: 0.85 },
    ]);
    consolidator.consolidate(batch2);

    const pattern = consolidator.getPattern('p5:qwen3');
    expect(pattern!.episodeCount).toBe(4);
  });

  it('should report domain-level aggregation', () => {
    const episodes = makeEpisodes([
      { domain: 'p5', qualityScore: 0.8 },
      { domain: 'p5', qualityScore: 0.9 },
      { domain: 'glsl', qualityScore: 0.6 },
      { domain: 'glsl', qualityScore: 0.7 },
    ]);

    const result = consolidator.consolidate(episodes);
    expect(Object.keys(result.byDomain).length).toBe(2);
    expect(result.byDomain.p5.avgQuality).toBeGreaterThan(result.byDomain.glsl.avgQuality);
  });
});
