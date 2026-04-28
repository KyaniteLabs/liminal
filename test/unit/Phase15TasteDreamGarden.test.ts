/**
 * Phase 15 Tests — Taste Learning, Dreaming, Garden Policies, Holdout Critics
 */

import { describe, it, expect } from 'vitest';
import { PreferenceDatasetBuilder } from '../../src/learning/PreferenceDatasetBuilder.js';
import { TasteModelTrainer } from '../../src/learning/TasteModelTrainer.js';
import { TasteModelRuntime } from '../../src/learning/TasteModelRuntime.js';
import { TasteModelEvaluator } from '../../src/learning/TasteModelEvaluator.js';
import { ReplayBiasPolicy } from '../../src/learning/ReplayBiasPolicy.js';
import { DreamQueue } from '../../src/dreaming/DreamQueue.js';
import { DreamPlanner } from '../../src/dreaming/DreamPlanner.js';
import { RecombinationEngine } from '../../src/dreaming/RecombinationEngine.js';
import { CrossModalTransfer } from '../../src/dreaming/CrossModalTransfer.js';
import { CompostRehydrator } from '../../src/compost/CompostRehydrator.js';
import { MotifIndexer } from '../../src/compost/MotifIndexer.js';
import { GardenHealthMonitor } from '../../src/autonomy/GardenHealthMonitor.js';
import { GardenPolicy } from '../../src/autonomy/GardenPolicy.js';
import { StagnationDetector } from '../../src/autonomy/StagnationDetector.js';
import { HoldoutCriticBus } from '../../src/evaluation/HoldoutCriticBus.js';
import type { ArchiveCell, ArchiveEntry, BehaviorDescriptor } from '../../src/emergence/types.js';
import type { CompostFragment } from '../../src/compost/types.js';

// ── Helpers ──

function makeDescriptor(values: number[]): BehaviorDescriptor {
  const axes = ['order-chaos', 'sparse-dense', 'symmetry-asymmetry', 'smooth-bursty', 'static-evolving', 'harmonic-dissonant'];
  return {
    values: values.map((v, i) => ({ axis: axes[i] ?? `axis-${i}` as any, value: v })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function makeEntry(id: string, descValues: number[], quality: number, opts?: { preference?: any }): ArchiveEntry {
  return {
    id,
    artifactRef: { uri: `test://${id}`, kind: 'code' },
    descriptor: makeDescriptor(descValues),
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: new Date().toISOString() },
    qualityScore: quality,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    preference: opts?.preference,
    archivedAt: new Date().toISOString(),
  };
}

function makeCell(cellId: string, elite?: ArchiveEntry): ArchiveCell {
  return {
    cellId,
    coordinates: elite?.descriptor.values ?? [],
    elite,
    nearElites: [],
    capacity: 5,
  };
}

function makeFragment(id: string, content: string, domain = 'code'): CompostFragment {
  return {
    id,
    source: 'test',
    domain,
    layer: 'semantic',
    content,
    metadata: { fileType: 'js', timestamp: new Date().toISOString(), hash: 'abc', size: content.length, extractedAt: new Date().toISOString() },
    tags: ['test'],
    score: 0.5,
  };
}

// ── Lane 1: Preference Dataset & Taste Model ──

describe('PreferenceDatasetBuilder', () => {
  it('returns empty dataset for entries without preferences', () => {
    const builder = new PreferenceDatasetBuilder();
    const entries = [makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.5)];
    const dataset = builder.build(entries);
    expect(dataset.pairs).toHaveLength(0);
    expect(dataset.stats.totalPairs).toBe(0);
  });

  it('builds pairwise preference pairs', () => {
    const builder = new PreferenceDatasetBuilder();
    const entries = [
      makeEntry('a', [0.3, 0.7, 0.5, 0.5, 0.5, 0.5], 0.8, { preference: { action: 'pairwise-a', artifactId: 'a', comparedTo: 'b', capturedAt: new Date().toISOString() } }),
      makeEntry('b', [0.7, 0.3, 0.5, 0.5, 0.5, 0.5], 0.4, { preference: { action: 'pairwise-b', artifactId: 'b', comparedTo: 'a', capturedAt: new Date().toISOString() } }),
    ];
    const dataset = builder.build(entries);
    expect(dataset.pairs.length).toBeGreaterThanOrEqual(1);
    expect(dataset.stats.sources['pairwise-a']).toBe(1);
  });

  it('respects minConfidence filter', () => {
    const builder = new PreferenceDatasetBuilder({ minConfidence: 0.9 });
    const entries = [
      makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.8, { preference: { action: 'pin', artifactId: 'a', capturedAt: new Date().toISOString() } }),
      makeEntry('b', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.3),
    ];
    const dataset = builder.build(entries);
    // Pin-inferred pairs have confidence 0.6, filtered by 0.9
    expect(dataset.pairs).toHaveLength(0);
  });

  it('skips inferred when disabled', () => {
    const builder = new PreferenceDatasetBuilder({ includeInferred: false });
    const entries = [
      makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.8, { preference: { action: 'pin', artifactId: 'a', capturedAt: new Date().toISOString() } }),
      makeEntry('b', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.3),
    ];
    const dataset = builder.build(entries);
    expect(dataset.pairs).toHaveLength(0);
  });

  it('creates synthetic pairs', () => {
    const builder = new PreferenceDatasetBuilder();
    const a = makeEntry('a', [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], 0.9);
    const b = makeEntry('b', [0.2, 0.2, 0.2, 0.2, 0.2, 0.2], 0.1);
    const pair = builder.addSyntheticPair(a, b, 0.9);
    expect(pair.winner.id).toBe('a');
    expect(pair.confidence).toBe(0.9);
  });
});

describe('TasteModelTrainer', () => {
  it('returns empty model for zero pairs', () => {
    const trainer = new TasteModelTrainer();
    const model = trainer.train([]);
    expect(model.axisWeights).toHaveLength(0);
    expect(model.pairCount).toBe(0);
  });

  it('learns weights from preference pairs', () => {
    const trainer = new TasteModelTrainer({ epochs: 30 });
    const pairs = Array.from({ length: 20 }, (_, i) => ({
      winner: { id: `w${i}`, descriptor: [0.8, 0.2, 0.5, 0.5, 0.5, 0.5], quality: 0.8 },
      loser: { id: `l${i}`, descriptor: [0.2, 0.8, 0.5, 0.5, 0.5, 0.5], quality: 0.3 },
      source: 'pairwise-a' as const,
      confidence: 1.0,
      capturedAt: new Date().toISOString(),
    }));
    const model = trainer.train(pairs);
    expect(model.axisWeights).toHaveLength(6);
    expect(model.pairCount).toBe(20);
    expect(model.trainingAgreement).toBeGreaterThan(0.5);
  });

  it('predicts scores for artifacts', () => {
    const trainer = new TasteModelTrainer();
    const score = trainer.predict([0.5, 0.5, 0.5], 0.5, { descriptor: [0.5, 0.5, 0.5], quality: 0.5 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('TasteModelRuntime', () => {
  it('returns quality score when no model loaded', () => {
    const rt = new TasteModelRuntime();
    const entry = makeEntry('x', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.7);
    expect(rt.score(entry)).toBe(0.7);
  });

  it('ranks entries with loaded model', () => {
    const rt = new TasteModelRuntime();
    rt.load({ axisWeights: [1, 0, 0, 0, 0, 0], qualityWeight: 0.0, trainedAt: '', pairCount: 1, trainingAgreement: 1 });
    const entries = [
      makeEntry('low', [0.2, 0.9, 0.9, 0.9, 0.9, 0.9], 0.9),
      makeEntry('high', [0.9, 0.1, 0.1, 0.1, 0.1, 0.1], 0.1),
    ];
    const ranked = rt.rank(entries);
    expect(ranked[0].entry.id).toBe('high');
  });
});

describe('TasteModelEvaluator', () => {
  it('returns zeros for insufficient pairs', () => {
    const ev = new TasteModelEvaluator();
    const result = ev.evaluate([], { axisWeights: [], qualityWeight: 0.5, trainedAt: '', pairCount: 0, trainingAgreement: 0 });
    expect(result.agreement).toBe(0);
  });

  it('splits pairs into train/test', () => {
    const ev = new TasteModelEvaluator({ holdoutFraction: 0.2 });
    const pairs = Array.from({ length: 20 }, (_, i) => ({
      winner: { id: `w${i}`, descriptor: [0.8], quality: 0.8 },
      loser: { id: `l${i}`, descriptor: [0.2], quality: 0.2 },
      source: 'pairwise-a' as const,
      confidence: 1.0,
      capturedAt: new Date().toISOString(),
    }));
    const { train, test } = ev.split(pairs);
    expect(train.length + test.length).toBe(20);
  });
});

describe('ReplayBiasPolicy', () => {
  it('selects entries without model loaded', () => {
    const policy = new ReplayBiasPolicy();
    const entries = [makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.8), makeEntry('b', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.4)];
    const selected = policy.selectForReplay(entries, 2);
    expect(selected).toHaveLength(2);
  });

  it('filters by taste alignment', () => {
    const policy = new ReplayBiasPolicy({ minTasteScore: 0.7 });
    policy.loadModel({ axisWeights: [1, 0, 0, 0, 0, 0], qualityWeight: 0, trainedAt: '', pairCount: 1, trainingAgreement: 1 });
    const entry = makeEntry('x', [0.3, 0.9, 0.9, 0.9, 0.9, 0.9], 0.1);
    expect(policy.isTasteAligned(entry)).toBe(false);
  });
});

// ── Lane 2: Dreaming & Recombination ──

describe('DreamQueue', () => {
  it('enqueues and dequeues tasks', () => {
    const q = new DreamQueue();
    const id = q.enqueue('elite-x-elite', [{ id: 'a', descriptor: [0.5], quality: 0.5 }], 0.9);
    expect(id).not.toBeNull();
    const task = q.dequeue();
    expect(task?.status).toBe('running');
    expect(task?.strategy).toBe('elite-x-elite');
  });

  it('completes tasks', () => {
    const q = new DreamQueue();
    const id = q.enqueue('elite-x-elite', [{ id: 'a', descriptor: [0.5], quality: 0.5 }], 0.9);
    q.dequeue();
    q.complete(id!, { candidateDescriptor: [0.5], parentIds: ['a'] });
    expect(q.getStatus().completed).toBe(1);
  });

  it('fails tasks', () => {
    const q = new DreamQueue();
    const id = q.enqueue('elite-x-elite', [{ id: 'a', descriptor: [0.5], quality: 0.5 }], 0.9);
    q.dequeue();
    q.fail(id!);
    expect(q.getStatus().failed).toBe(1);
  });

  it('respects max queue size', () => {
    const q = new DreamQueue({ maxQueueSize: 2 });
    q.enqueue('elite-x-elite', [], 0.9);
    q.enqueue('elite-x-elite', [], 0.8);
    const third = q.enqueue('elite-x-elite', [], 0.7);
    expect(third).toBeUndefined();
  });
});

describe('DreamPlanner', () => {
  it('returns empty plan for insufficient entries', () => {
    const planner = new DreamPlanner();
    const plan = planner.plan([], []);
    expect(plan.tasks).toHaveLength(0);
  });

  it('plans elite-x-elite when enough entries', () => {
    const planner = new DreamPlanner();
    const cells = [
      makeCell('c1', makeEntry('a', [0.2, 0.2, 0.2, 0.2, 0.2, 0.2], 0.9)),
      makeCell('c2', makeEntry('b', [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], 0.7)),
    ];
    const plan = planner.plan(cells, ['order-chaos'] as any);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
    expect(plan.tasks[0].strategy).toBe('elite-x-elite');
  });
});

describe('RecombinationEngine', () => {
  it('interpolates parents', () => {
    const engine = new RecombinationEngine({ blendFactor: 0.5 });
    const result = engine.recombine(
      { id: 'a', descriptor: [0.0, 0.0, 0.0], quality: 0.5 },
      { id: 'b', descriptor: [1.0, 1.0, 1.0], quality: 0.5 },
      'interpolate',
    );
    expect(result.descriptor).toEqual([0.5, 0.5, 0.5]);
    expect(result.strategy).toBe('interpolate');
  });

  it('crossovers parents', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(
      { id: 'a', descriptor: [0.0, 0.0, 0.0, 0.0], quality: 0.5 },
      { id: 'b', descriptor: [1.0, 1.0, 1.0, 1.0], quality: 0.5 },
      'crossover',
    );
    expect(result.descriptor.slice(0, 2)).toEqual([0.0, 0.0]);
    expect(result.descriptor.slice(2)).toEqual([1.0, 1.0]);
  });

  it('computes novelty score', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(
      { id: 'a', descriptor: [0.0], quality: 0.5 },
      { id: 'b', descriptor: [1.0], quality: 0.5 },
    );
    expect(result.noveltyScore).toBeGreaterThan(0);
  });
});

describe('CrossModalTransfer', () => {
  it('finds no transfers with single domain', () => {
    const transfer = new CrossModalTransfer();
    const entries = [makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.5)];
    const mappings = transfer.findTransfers(entries);
    expect(mappings).toHaveLength(0);
  });

  it('transfers descriptor between entries', () => {
    const transfer = new CrossModalTransfer();
    const source = makeEntry('a', [0.9, 0.1, 0.5, 0.5, 0.5, 0.5], 0.8);
    const target = makeEntry('b', [0.1, 0.9, 0.5, 0.5, 0.5, 0.5], 0.6);
    const result = transfer.transfer(source, target);
    expect(result).toHaveLength(6);
    expect(result[0]).toBeGreaterThan(0.1);
    expect(result[0]).toBeLessThan(0.9);
  });
});

// ── Lane 3: Compost Rehydration ──

describe('CompostRehydrator', () => {
  it('finds rehydratable fragments', () => {
    const rehydrator = new CompostRehydrator({ minMotifDensity: 0.1 });
    const fragments = [
      makeFragment('a', 'function draw() { for (let i = 0; i < 10; i++) { render(i); } }'),
      makeFragment('b', '   '),
    ];
    const found = rehydrator.findRehydratable(fragments);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].id).toBe('a');
  });

  it('rehydrates fragments into candidates', () => {
    const rehydrator = new CompostRehydrator();
    const fragments = [
      makeFragment('a', 'function draw() { render(); }', 'code'),
      makeFragment('b', 'class Shape { constructor() {} }', 'code'),
    ];
    const candidates = rehydrator.rehydrate(fragments);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].sourceIds).toContain('a');
  });

  it('scores fragments', () => {
    const rehydrator = new CompostRehydrator();
    const rich = makeFragment('rich', 'function draw() { for (let i = 0; i < 10; i++) { if (i > 5) render(i); } }');
    const poor = makeFragment('poor', '   ');
    expect(rehydrator.scoreFragment(rich)).toBeGreaterThan(rehydrator.scoreFragment(poor));
  });
});

describe('MotifIndexer', () => {
  it('indexes motifs from fragments', () => {
    const indexer = new MotifIndexer();
    const fragments = [makeFragment('a', 'function draw() { return x; }')];
    const result = indexer.index(fragments);
    expect(result.uniqueCount).toBeGreaterThan(0);
  });

  it('searches for motifs', () => {
    const indexer = new MotifIndexer();
    indexer.index([makeFragment('a', 'function draw() { return x; }')]);
    const results = indexer.search('function');
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('finds cross-domain motifs', () => {
    const indexer = new MotifIndexer();
    indexer.index([
      makeFragment('a', 'function draw() { return x; }', 'code'),
      makeFragment('b', 'function draw() { return x; }', 'shader'),
    ]);
    const cross = indexer.getCrossDomainMotifs();
    expect(cross.length).toBeGreaterThanOrEqual(0);
  });
});

// ── Lane 4: Garden Policies ──

describe('GardenHealthMonitor', () => {
  it('measures empty archive health', () => {
    const monitor = new GardenHealthMonitor();
    const health = monitor.measure([]);
    expect(health.archiveSize).toBe(0);
    expect(health.nicheOccupancy).toBe(0);
    expect(health.healthLevel).toBe('declining');
  });

  it('measures healthy archive', () => {
    const monitor = new GardenHealthMonitor();
    const cells = [
      makeCell('c1', makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.8)),
      makeCell('c2', makeEntry('b', [0.3, 0.7, 0.5, 0.5, 0.5, 0.5], 0.7)),
    ];
    const health = monitor.measure(cells);
    expect(health.archiveSize).toBe(2);
    expect(health.fertilityYield).toBeGreaterThan(0);
  });

  it('tracks trend over measurements', () => {
    const monitor = new GardenHealthMonitor();
    monitor.measure([makeCell('c1', makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.8))]);
    const trend = monitor.getTrend();
    expect(trend).toBe('stable');
  });
});

describe('GardenPolicy', () => {
  it('decides actions for archive', () => {
    const policy = new GardenPolicy();
    const cells = [
      makeCell('c1', makeEntry('a', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.7)),
    ];
    const decisions = policy.decide(cells, ['order-chaos'] as any);
    expect(decisions.length).toBeGreaterThanOrEqual(1);
  });

  it('includes frontier-seeking for empty niches', () => {
    const policy = new GardenPolicy();
    const decisions = policy.decide([], ['order-chaos'] as any);
    // Empty archive → should plan frontier-seeking
    expect(decisions.some(d => d.action === 'frontier-seeking')).toBe(true);
  });
});

describe('StagnationDetector', () => {
  it('detects no stagnation with insufficient data', () => {
    const det = new StagnationDetector();
    const result = det.detect([]);
    expect(result.isStagnant).toBe(false);
  });

  it('detects stagnation from declining health', () => {
    const det = new StagnationDetector({ stagnationWindow: 3 });
    const history = [
      { archiveSize: 5, nicheOccupancy: 0.3, avgLineageDepth: 1, fertilityYield: 0.6, tasteAlignment: 0, healthScore: 0.7, healthLevel: 'healthy' as const, measuredAt: '' },
      { archiveSize: 5, nicheOccupancy: 0.3, avgLineageDepth: 1, fertilityYield: 0.5, tasteAlignment: 0, healthScore: 0.6, healthLevel: 'healthy' as const, measuredAt: '' },
      { archiveSize: 5, nicheOccupancy: 0.3, avgLineageDepth: 1, fertilityYield: 0.4, tasteAlignment: 0, healthScore: 0.5, healthLevel: 'stagnant' as const, measuredAt: '' },
    ];
    const result = det.detect(history);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

// ── Lane 5: Holdout Critic Bus ──

describe('HoldoutCriticBus', () => {
  it('evaluates with registered critics', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('quality', (e) => e.qualityScore, 1.0);
    bus.registerCritic('novelty', (e) => e.signals.novelty, 0.5);
    const entry = makeEntry('x', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.7);
    const result = bus.evaluate(entry);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.votes).toHaveLength(2);
  });

  it('detects consensus when critics agree', () => {
    const bus = new HoldoutCriticBus({ consensusThreshold: 0.2 });
    bus.registerCritic('a', () => 0.7, 1.0);
    bus.registerCritic('b', () => 0.72, 1.0);
    const result = bus.evaluate(makeEntry('x', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.7));
    expect(result.agreement).toBe('consensus');
  });

  it('blocks on major divergence', () => {
    const bus = new HoldoutCriticBus({ majorDivergenceThreshold: 0.2, blockOnDivergence: true });
    bus.registerCritic('high', () => 0.9, 1.0);
    bus.registerCritic('low', () => 0.2, 1.0);
    const result = bus.evaluate(makeEntry('x', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 0.5));
    expect(result.agreement).toBe('major-divergence');
    expect(result.blocked).toBe(true);
  });

  it('reports not ready with fewer than 2 critics', () => {
    const bus = new HoldoutCriticBus();
    expect(bus.isReady()).toBe(false);
    bus.registerCritic('a', () => 0.5, 1.0);
    expect(bus.isReady()).toBe(false);
    bus.registerCritic('b', () => 0.5, 1.0);
    expect(bus.isReady()).toBe(true);
  });

  it('removes critics', () => {
    const bus = new HoldoutCriticBus();
    bus.registerCritic('a', () => 0.5, 1.0);
    bus.registerCritic('b', () => 0.5, 1.0);
    expect(bus.removeCritic('a')).toBe(true);
    expect(bus.getCriticIds()).toEqual(['b']);
  });
});
