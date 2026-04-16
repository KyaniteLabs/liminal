/**
 * Phase 16 Tests — Autonomous Gardener, Self-Improvement, Product Surface
 */

import { describe, it, expect } from 'vitest';
import { AutonomousGardener } from '../../src/autonomy/AutonomousGardener.js';
import { GardenScheduler, type GardenMode } from '../../src/autonomy/GardenScheduler.js';
import { LoopMixPolicy } from '../../src/autonomy/LoopMixPolicy.js';
import { CreativeWeaknessEmitter } from '../../src/autonomy/CreativeWeaknessEmitter.js';
import { ChallengeGenerator } from '../../src/autonomy/ChallengeGenerator.js';
import { PolicyExperimentRunner } from '../../src/autonomy/PolicyExperimentRunner.js';
import { PolicyChangeManifest } from '../../src/release/PolicyChangeManifest.js';
import { CreativeRuntimeCandidateBuilder } from '../../src/release/CreativeRuntimeCandidateBuilder.js';
import { GardenPromotionGate } from '../../src/release/GardenPromotionGate.js';
import { GardenRollbackController } from '../../src/release/GardenRollbackController.js';
import { ProvenanceNarrativeBuilder } from '../../src/reporting/ProvenanceNarrativeBuilder.js';
import { LaunchSummaryBuilder } from '../../src/reporting/LaunchSummaryBuilder.js';
import { DemoScenarioRunner } from '../../src/product/DemoScenarioRunner.js';
import { GalleryBuilder } from '../../src/product/GalleryBuilder.js';
import { GardenPolicy } from '../../src/autonomy/GardenPolicy.js';
import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../../src/emergence/types.js';

// ── Helpers ──

const AXES: DescriptorAxis[] = ['order-chaos', 'sparse-dense'];

function makeEntry(id: string, quality: number, fertility = 0.5, novelty = 0.5): ArchiveEntry {
  return {
    id,
    artifactRef: { uri: `test://${id}`, kind: 'generated-code' },
    descriptor: { values: [{ axis: 'order-chaos', value: 0.5 }], source: 'test', extractedAt: '' },
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: '' },
    qualityScore: quality,
    signals: { novelty, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility, aesthetic: 0.5 },
    archivedAt: '',
  };
}

function makeCell(cellId: string, elite?: ArchiveEntry): ArchiveCell {
  return {
    cellId,
    coordinates: [{ axis: 'order-chaos', value: 0.5 }],
    elite,
    nearElites: [],
    capacity: 5,
  };
}

// ── LoopMixPolicy ──

describe('LoopMixPolicy', () => {
  it('returns a mix that sums to 1.0', () => {
    const policy = new LoopMixPolicy();
    const mix = policy.computeMix();
    const sum = mix.reduce((s, m) => s + m.fraction, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(mix).toHaveLength(5);
  });

  it('shifts toward exploration during stagnation', () => {
    const policy = new LoopMixPolicy();
    const normal = policy.computeMix();
    const normalExploration = normal.find(m => m.activity === 'exploration')!.fraction;

    const stagnant = policy.computeMix(undefined, {
      isStagnant: true,
      severity: 0.8,
      signals: [{ metric: 'fertility', value: 0, threshold: 0.01, description: 'test' }],
      recommendations: [],
    });
    const stagnantExploration = stagnant.find(m => m.activity === 'exploration')!.fraction;

    expect(stagnantExploration).toBeGreaterThan(normalExploration);
  });

  it('samples activities weighted by mix', () => {
    const policy = new LoopMixPolicy();
    const samples = policy.sampleActivities(20);
    expect(samples).toHaveLength(20);
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

// ── GardenScheduler ──

describe('GardenScheduler', () => {
  it('schedules actions respecting mode limits', () => {
    const scheduler = new GardenScheduler();
    const decisions = new GardenPolicy().decide(
      [makeCell('c1', makeEntry('e1', 0.7, 0.8))],
      AXES,
    );
    const activities = LoopMixPolicy.prototype.sampleActivities.call(
      new LoopMixPolicy(), 5,
    );

    const scheduled = scheduler.schedule(decisions, activities, 'assist');
    expect(scheduled.length).toBeLessThanOrEqual(2); // assist limit
  });

  it('tracks running count and frees on complete', () => {
    const scheduler = new GardenScheduler();
    const decisions = [{ action: 'frontier-seeking' as const, priority: 0.9, reason: 'test' }];
    const scheduled = scheduler.schedule(decisions, ['exploration'], 'autopilot');
    expect(scheduler.getRunningCount()).toBe(scheduled.length);
    scheduler.complete(scheduled[0]);
    expect(scheduler.getRunningCount()).toBe(scheduled.length - 1);
  });

  it('reports capacity correctly', () => {
    const scheduler = new GardenScheduler({ maxConcurrent: 1 });
    expect(scheduler.hasCapacity('assist')).toBe(true);
    scheduler.schedule(
      [{ action: 'frontier-seeking', priority: 0.9, reason: 'test' }],
      ['exploration'], 'assist',
    );
    expect(scheduler.hasCapacity('assist')).toBe(false);
  });
});

// ── AutonomousGardener ──

describe('AutonomousGardener', () => {
  it('runs a single cycle', () => {
    const gardener = new AutonomousGardener({ mode: 'co-create', totalBudget: 50 });
    const cells = [makeCell('c1', makeEntry('e1', 0.6, 0.7))];

    const result = gardener.cycle(cells, AXES);
    expect(result).not.toBeNull();
    expect(result!.cycle).toBe(1);
    expect(result!.mode).toBe('co-create');
    expect(result!.budgetRemaining).toBeLessThan(50);
  });

  it('returns null when budget exhausted', () => {
    const gardener = new AutonomousGardener({ totalBudget: 25 });
    const cells = [makeCell('c1', makeEntry('e1', 0.6, 0.7))];

    // Drain budget — each action costs 10, so 2 actions max (budget 25 → 5)
    for (let i = 0; i < 50; i++) gardener.cycle(cells, AXES);
    const result = gardener.cycle(cells, AXES);
    expect(result).toBeNull();
    // Budget is properly managed (never goes negative), remainder is insufficient for any action
    expect(gardener.getBudgetRemaining()).toBeGreaterThanOrEqual(0);
    expect(gardener.getBudgetRemaining()).toBeLessThan(10);
  });

  it('starts and stops', async () => {
    const gardener = new AutonomousGardener({ mode: 'assist', totalBudget: 30 });
    const cells = [makeCell('c1', makeEntry('e1', 0.5))];
    const cycles: number[] = [];

    const promise = gardener.start(
      () => cells,
      () => AXES,
      (r) => cycles.push(r.cycle),
    );

    setTimeout(() => gardener.stop(), 200);
    await promise;

    expect(gardener.isActive()).toBe(false);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes mode and scheduler', () => {
    const gardener = new AutonomousGardener({ mode: 'autopilot' });
    expect(gardener.getMode()).toBe('autopilot');
    expect(gardener.getScheduler()).toBeInstanceOf(GardenScheduler);
    expect(gardener.getPolicy()).toBeInstanceOf(GardenPolicy);
  });
});

// ── CreativeWeaknessEmitter ──

describe('CreativeWeaknessEmitter', () => {
  it('detects novelty collapse', () => {
    const emitter = new CreativeWeaknessEmitter();
    const weaknesses = emitter.analyze(
      { archiveSize: 20, nicheOccupancy: 0.9, avgLineageDepth: 2, fertilityYield: 0.2, tasteAlignment: 0.5, healthScore: 0.4, healthLevel: 'stagnant', measuredAt: '' },
      { isStagnant: false, severity: 0, signals: [], recommendations: [] },
    );
    expect(weaknesses.some(w => w.category === 'novelty-collapse')).toBe(true);
  });

  it('filters by minimum severity', () => {
    const emitter = new CreativeWeaknessEmitter({ minSeverity: 0.9 });
    const weaknesses = emitter.analyze(
      { archiveSize: 20, nicheOccupancy: 0.9, avgLineageDepth: 2, fertilityYield: 0.2, tasteAlignment: 0.5, healthScore: 0.4, healthLevel: 'stagnant', measuredAt: '' },
      { isStagnant: false, severity: 0, signals: [], recommendations: [] },
    );
    expect(weaknesses).toHaveLength(0);
  });

  it('resolves a weakness', () => {
    const emitter = new CreativeWeaknessEmitter();
    emitter.analyze(
      { archiveSize: 20, nicheOccupancy: 0.9, avgLineageDepth: 2, fertilityYield: 0.2, tasteAlignment: 0.5, healthScore: 0.4, healthLevel: 'stagnant', measuredAt: '' },
      { isStagnant: false, severity: 0, signals: [], recommendations: [] },
    );
    expect(emitter.resolve('novelty-collapse')).toBe(true);
    expect(emitter.getEmitted()).toHaveLength(0);
  });
});

// ── ChallengeGenerator ──

describe('ChallengeGenerator', () => {
  it('generates challenges from archive state', () => {
    const gen = new ChallengeGenerator();
    const cells = [
      makeCell('c1'), // empty
      makeCell('c2', makeEntry('e1', 0.3)), // weak
    ];
    const challenges = gen.generate(cells, AXES);
    expect(challenges.length).toBeGreaterThanOrEqual(1);
    expect(challenges[0].id).toBeTruthy();
  });

  it('generates from user prompt', () => {
    const gen = new ChallengeGenerator();
    const challenge = gen.fromPrompt('Make something chaotic', AXES);
    expect(challenge.origin).toBe('user-prompt');
    expect(challenge.title).toContain('chaotic');
  });

  it('generates stagnation break', () => {
    const gen = new ChallengeGenerator();
    const challenge = gen.stagnationBreak(AXES);
    expect(challenge.origin).toBe('stagnation-break');
    expect(challenge.difficulty).toBe(0.9);
  });
});

// ── PolicyExperimentRunner ──

describe('PolicyExperimentRunner', () => {
  it('creates and evaluates an experiment', () => {
    const runner = new PolicyExperimentRunner({ minSamples: 3, confidenceThreshold: 0.5 });
    const expId = runner.createExperiment(
      { id: 'ctrl', kind: 'loop-mix', label: 'control', config: { exploration: 0.35 } },
      { id: 'treat', kind: 'loop-mix', label: 'treatment', config: { exploration: 0.5 } },
    );

    // Record enough samples
    for (let i = 0; i < 5; i++) {
      runner.recordResult(expId, 'ctrl', 'quality', 0.5 + Math.random() * 0.1);
      runner.recordResult(expId, 'treat', 'quality', 0.6 + Math.random() * 0.1);
    }

    const outcome = runner.evaluate(expId);
    expect(outcome).not.toBeNull();
    expect(outcome!.winner).toBe('treatment');
  });

  it('returns inconclusive with insufficient samples', () => {
    const runner = new PolicyExperimentRunner({ minSamples: 10 });
    const expId = runner.createExperiment(
      { id: 'c', kind: 'critic-prompt', label: 'c', config: {} },
      { id: 't', kind: 'critic-prompt', label: 't', config: {} },
    );
    runner.recordResult(expId, 'c', 'score', 0.5);
    runner.recordResult(expId, 't', 'score', 0.6);

    const outcome = runner.evaluate(expId);
    expect(outcome!.winner).toBe('inconclusive');
  });
});

// ── PolicyChangeManifest ──

describe('PolicyChangeManifest', () => {
  it('stages, promotes, and tracks changes', () => {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('loop-mix', 'Increase exploration', { quality: 0.5 });
    expect(record.status).toBe('staged');

    manifest.promote(record.id, { quality: 0.6 });
    const promoted = manifest.getLatest('loop-mix');
    expect(promoted?.status).toBe('promoted');
    expect(promoted?.metricsAfter.quality).toBe(0.6);
  });

  it('rolls back a promoted change', () => {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('critic-prompt', 'Update prompt', { score: 0.5 });
    manifest.promote(record.id, { score: 0.6 });

    const target = manifest.rollback(record.id);
    expect(target).toBeNull(); // no rollback target set
    expect(manifest.getRecord(record.id)?.status).toBe('rolled-back');
  });

  it('filters by status', () => {
    const manifest = new PolicyChangeManifest();
    manifest.stage('a', 'change a', {});
    const r2 = manifest.stage('b', 'change b', {});
    manifest.promote(r2.id, {});

    expect(manifest.getByStatus('staged')).toHaveLength(1);
    expect(manifest.getByStatus('promoted')).toHaveLength(1);
  });
});

// ── CreativeRuntimeCandidateBuilder ──

describe('CreativeRuntimeCandidateBuilder', () => {
  it('builds a candidate from promoted changes', () => {
    const builder = new CreativeRuntimeCandidateBuilder();
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('loop-mix', 'test', { quality: 0.3 });
    manifest.promote(record.id, { quality: 0.7 });

    const candidate = builder.build([record], 'Test candidate');
    expect(candidate.passed).toBe(true);
    expect(candidate.changes).toHaveLength(1);
  });

  it('fails candidate with non-promoted changes', () => {
    const builder = new CreativeRuntimeCandidateBuilder();
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('a', 'staged only', { quality: 0.5 });

    const candidate = builder.build([record], 'Bad candidate');
    expect(candidate.validationScore).toBe(0);
    expect(candidate.passed).toBe(false);
  });
});

// ── GardenPromotionGate ──

describe('GardenPromotionGate', () => {
  it('passes candidate with improvements and no regressions', () => {
    const gate = new GardenPromotionGate();
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('loop-mix', 'test', { quality: 0.3 });
    manifest.promote(record.id, { quality: 0.7 });

    const builder = new CreativeRuntimeCandidateBuilder();
    const candidate = builder.build([record], 'test');

    const result = gate.check(candidate);
    expect(result.passed).toBe(true);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('blocks candidate with regressions', () => {
    const gate = new GardenPromotionGate({ maxRegressions: 0 });
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('critic', 'bad change', { quality: 0.8, novelty: 0.5 });
    manifest.promote(record.id, { quality: 0.6, novelty: 0.3 });

    const candidate: any = {
      id: 'c1',
      description: 'test',
      changes: [record],
      builtAt: '',
      validationScore: 0.5,
      passed: true,
    };

    const result = gate.check(candidate);
    expect(result.passed).toBe(false);
    expect(result.regressions.length).toBeGreaterThan(0);
  });
});

// ── GardenRollbackController ──

describe('GardenRollbackController', () => {
  it('rolls back a promoted change', () => {
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('a', 'test', { quality: 0.5 });
    manifest.promote(record.id, { quality: 0.6 });

    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback(record.id, 'Regression detected');
    expect(result.rolledBack).toBe(true);
  });

  it('refuses to roll back non-promoted changes', () => {
    const manifest = new PolicyChangeManifest();
    const controller = new GardenRollbackController(manifest);
    const result = controller.rollback('nonexistent', 'test');
    expect(result.rolledBack).toBe(false);
  });
});

// ── ProvenanceNarrativeBuilder ──

describe('ProvenanceNarrativeBuilder', () => {
  it('builds a narrative from changes and weaknesses', () => {
    const builder = new ProvenanceNarrativeBuilder();
    const manifest = new PolicyChangeManifest();
    const record = manifest.stage('loop-mix', 'Increase exploration', { quality: 0.5 });
    manifest.promote(record.id, { quality: 0.6 });

    const narrative = builder.build(
      [record],
      [{ id: 'w1', category: 'novelty-collapse', severity: 0.7, description: 'test', evidence: [], suggestedFix: 'fix', detectedAt: '' }],
    );

    expect(narrative.title).toBe('Garden Provenance Report');
    expect(narrative.sections.length).toBeGreaterThanOrEqual(2);
    expect(narrative.summary).toContain('policy changes');
  });

  it('handles empty state', () => {
    const builder = new ProvenanceNarrativeBuilder();
    const narrative = builder.build([], []);
    expect(narrative.summary).toContain('stable');
  });
});

// ── LaunchSummaryBuilder ──

describe('LaunchSummaryBuilder', () => {
  it('assesses launch readiness as ready for healthy garden', () => {
    const builder = new LaunchSummaryBuilder();
    const readiness = builder.assess(
      { archiveSize: 20, nicheOccupancy: 0.5, avgLineageDepth: 3, fertilityYield: 0.6, tasteAlignment: 0.5, healthScore: 0.7, healthLevel: 'healthy', measuredAt: '' },
      [],
      [],
    );
    expect(readiness.ready).toBe(true);
    expect(readiness.score).toBe(1);
  });

  it('flags blockers for unhealthy garden', () => {
    const builder = new LaunchSummaryBuilder();
    const readiness = builder.assess(
      { archiveSize: 3, nicheOccupancy: 0.1, avgLineageDepth: 1, fertilityYield: 0.1, tasteAlignment: 0.1, healthScore: 0.2, healthLevel: 'declining', measuredAt: '' },
      [],
      [{ id: 'w1', category: 'novelty-collapse', severity: 0.8, description: 'test', evidence: [], suggestedFix: 'fix', detectedAt: '' }],
    );
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });
});

// ── DemoScenarioRunner ──

describe('DemoScenarioRunner', () => {
  it('runs the creative-codex demo end to end', () => {
    const runner = new DemoScenarioRunner();
    const result = runner.runCreativeCodex();
    expect(result.scenarioName).toBe('creative-codex');
    expect(result.totalSteps).toBe(8);
    expect(result.passed).toBe(true);
    expect(result.durationMs).toBeLessThan(1000);
  });

  it('demo steps follow expected sequence', () => {
    const runner = new DemoScenarioRunner();
    const result = runner.runCreativeCodex();
    const labels = result.steps.map(s => s.label);
    expect(labels).toContain('Generate family');
    expect(labels).toContain('Garden policy');
    expect(labels).toContain('Steer taste');
    expect(labels).toContain('Self-improve');
  });
});

// ── GalleryBuilder ──

describe('GalleryBuilder', () => {
  it('builds gallery from archive cells', () => {
    const builder = new GalleryBuilder();
    const cells = [
      makeCell('c1', makeEntry('e1', 0.8)),
      makeCell('c2', makeEntry('e2', 0.5)),
    ];

    const gallery = builder.build(cells);
    expect(gallery.totalItems).toBe(2);
    expect(gallery.topItem!.entry.qualityScore).toBe(0.8);
    expect(gallery.avgQuality).toBeCloseTo(0.65, 5);
  });

  it('groups by provenance', () => {
    const builder = new GalleryBuilder();
    const e1 = makeEntry('e1', 0.7);
    e1.lineage.provenance = 'remix';
    const e2 = makeEntry('e2', 0.6);
    e2.lineage.provenance = 'dream-recombination';

    const gallery = builder.build([makeCell('c1', e1), makeCell('c2', e2)]);
    expect(gallery.groups.length).toBe(2);
  });

  it('handles empty archive', () => {
    const builder = new GalleryBuilder();
    const gallery = builder.build([]);
    expect(gallery.totalItems).toBe(0);
    expect(gallery.topItem).toBeNull();
    expect(gallery.avgQuality).toBe(0);
  });
});
