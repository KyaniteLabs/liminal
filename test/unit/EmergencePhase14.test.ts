import { describe, it, expect } from 'vitest';
import { NoveltyIndex } from '../../src/emergence/NoveltyIndex.js';
import { TemporalStructureAnalyzer } from '../../src/emergence/TemporalStructureAnalyzer.js';
import { PerturbationProbe } from '../../src/emergence/PerturbationProbe.js';
import { EmergenceCritic } from '../../src/emergence/EmergenceCritic.js';
import { BehaviorDescriptorExtractor } from '../../src/emergence/BehaviorDescriptorExtractor.js';
import { EmergenceScorecard } from '../../src/evaluation/EmergenceScorecard.js';
import { NicheQuotaPolicy } from '../../src/autonomy/NicheQuotaPolicy.js';
import { ArchiveTaskPlanner } from '../../src/autonomy/ArchiveTaskPlanner.js';
import type { ArchiveEntry, BehaviorDescriptor } from '../../src/emergence/types.js';
import type { LiminalObjectRef } from '../../src/fs/types.js';

function makeEntry(id: string, descValues: Array<{ axis: string; value: number }>): ArchiveEntry {
  const descriptor: BehaviorDescriptor = {
    values: descValues.map(d => ({ axis: d.axis as any, value: d.value })),
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
  return {
    id,
    artifactRef: { uri: `test://${id}`, kind: 'generated-code' } as LiminalObjectRef,
    descriptor,
    lineage: { artifactId: id, parentIds: [], provenance: 'fresh-generation', createdAt: '' },
    qualityScore: 0.7,
    signals: { novelty: 0.5, structure: 0.5, temporalRichness: 0.5, perturbationResilience: 0.5, fertility: 0.5, aesthetic: 0.5 },
    archivedAt: new Date().toISOString(),
  };
}

// ── NoveltyIndex ──

describe('NoveltyIndex', () => {
  it('returns default novelty for empty archive', () => {
    const index = new NoveltyIndex();
    const desc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: '',
    };
    expect(index.score(desc, [])).toBe(1.0);
  });

  it('returns high novelty for descriptor far from archive', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('a', [{ axis: 'order-chaos', value: 0.1 }]),
      makeEntry('b', [{ axis: 'order-chaos', value: 0.15 }]),
    ];
    const novelDesc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.9 }],
      source: 'test',
      extractedAt: '',
    };
    const similarDesc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.12 }],
      source: 'test',
      extractedAt: '',
    };

    const novelScore = index.score(novelDesc, archive);
    const similarScore = index.score(similarDesc, archive);
    expect(novelScore).toBeGreaterThan(similarScore);
    expect(novelScore).toBeGreaterThan(0.5);
    expect(similarScore).toBeLessThan(0.5);
  });

  it('finds nearest neighbors correctly', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('near', [{ axis: 'order-chaos', value: 0.3 }]),
      makeEntry('mid', [{ axis: 'order-chaos', value: 0.6 }]),
      makeEntry('far', [{ axis: 'order-chaos', value: 0.9 }]),
    ];
    const desc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.31 }],
      source: 'test',
      extractedAt: '',
    };

    const nearest = index.findNearest(desc, archive, 2);
    expect(nearest).toHaveLength(2);
    expect(nearest[0].entry.id).toBe('near');
    expect(nearest[0].distance).toBeLessThan(nearest[1].distance);
  });

  it('computes coverage as fraction of descriptor space', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('a', [{ axis: 'order-chaos', value: 0.05 }]),
      makeEntry('b', [{ axis: 'order-chaos', value: 0.95 }]),
    ];
    const coverage = index.computeCoverage(archive, 10);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(1);
  });

  it('returns 0 coverage for empty archive', () => {
    const index = new NoveltyIndex();
    expect(index.computeCoverage([], 10)).toBe(0);
  });

  it('handles descriptors with different axis sets', () => {
    const index = new NoveltyIndex();
    const archive = [
      makeEntry('a', [
        { axis: 'order-chaos', value: 0.5 },
        { axis: 'sparse-dense', value: 0.5 },
      ]),
    ];
    const desc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.9 }],
      source: 'test',
      extractedAt: '',
    };
    const score = index.score(desc, archive);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ── TemporalStructureAnalyzer ──

describe('TemporalStructureAnalyzer', () => {
  it('returns flat structure for very short input', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const result = analyzer.analyze('short');
    expect(result.structureLevel).toBe('flat');
    expect(result.structure).toBeLessThan(0.3);
    expect(result.phaseCount).toBe(0);
  });

  it('detects higher structure in well-formatted code', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const ordered = 'function draw() {\n  background(0);\n  circle(100, 100, 50);\n  stroke(255);\n  line(0, 0, 200, 200);\n}\n\nfunction setup() {\n  createCanvas(400, 400);\n  frameRate(30);\n}\n\nfunction mousePressed() {\n  background(random(255));\n}\n';
    const flat = 'a b c d e f g h i j k l m n o p';

    const orderedResult = analyzer.analyze(ordered);
    const flatResult = analyzer.analyze(flat);
    expect(orderedResult.structure).toBeGreaterThan(flatResult.structure);
  });

  it('detects temporal richness in animation code', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const animated = 'function draw() {\n  let t = frameCount * 0.01;\n  let x = width / 2 + cos(t) * 100;\n  let y = height / 2 + sin(t) * 100;\n  circle(x, y, 50);\n  background(0, 10);\n  animate(t);\n  if (frameCount % 60 === 0) {\n    phase = (phase + 1) % 3;\n  }\n  for (let i = 0; i < 10; i++) {\n    let offset = i * 20;\n    circle(x + offset, y, 10);\n  }\n}\n';
    const staticCode = 'const x = 5;\nconst y = 10;\nconsole.log(x + y);\n';

    const animatedResult = analyzer.analyze(animated);
    const staticResult = analyzer.analyze(staticCode);
    expect(animatedResult.temporalRichness).toBeGreaterThan(staticResult.temporalRichness);
  });

  it('counts phase transitions between segments', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const bursty = 'aaaa\n\n\naaaa\n\n\naaaa\n\n\naaaa\n\n\n';
    const result = analyzer.analyze(bursty);
    expect(result.phaseCount).toBeGreaterThanOrEqual(0);
  });

  it('classifies structure levels correctly', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const result = analyzer.analyze('function draw() {\n  background(0);\n  for (let i = 0; i < 10; i++) {\n    for (let j = 0; j < 10; j++) {\n      circle(i * 20, j * 20, 5);\n    }\n  }\n}\n\nfunction setup() {\n  createCanvas(400, 400);\n}\n');
    expect(['flat', 'single-scale', 'multi-scale', 'fractal']).toContain(result.structureLevel);
  });

  it('respects custom segment count', () => {
    const defaultAnalyzer = new TemporalStructureAnalyzer();
    const customAnalyzer = new TemporalStructureAnalyzer({ segmentCount: 16 });
    const input = 'a'.repeat(500);
    expect(() => defaultAnalyzer.analyze(input)).not.toThrow();
    expect(() => customAnalyzer.analyze(input)).not.toThrow();
  });
});

// ── PerturbationProbe ──

describe('PerturbationProbe', () => {
  it('classifies artifact resilience', () => {
    const probe = new PerturbationProbe();
    const extractor = new BehaviorDescriptorExtractor();

    const desc = extractor.extract('function draw() { background(0); circle(100, 100, 50); }');
    const result = probe.probe(
      'function draw() { background(0); circle(100, 100, 50); }',
      desc,
      (t) => extractor.extract(t),
    );

    expect(['brittle', 'stable', 'resilient']).toContain(result.classification);
    expect(result.resilience).toBeGreaterThanOrEqual(0);
    expect(result.resilience).toBeLessThanOrEqual(1);
    expect(result.perturbations).toHaveLength(5);
  });

  it('returns correct perturbation types', () => {
    const probe = new PerturbationProbe();
    const extractor = new BehaviorDescriptorExtractor();

    const desc = extractor.extract('let x = 100; let y = 200; circle(x, y, 30);');
    const result = probe.probe('let x = 100; let y = 200; circle(x, y, 30);', desc, (t) => extractor.extract(t));

    const types = result.perturbations.map(p => p.type);
    expect(types).toContain('value-shift');
    expect(types).toContain('line-reorder');
    expect(types).toContain('noise-injection');
    expect(types).toContain('truncation');
    expect(types).toContain('redundancy');
  });

  it('quick estimate returns mid-range for balanced descriptors', () => {
    const probe = new PerturbationProbe();
    const desc: BehaviorDescriptor = {
      values: [
        { axis: 'order-chaos', value: 0.5 },
        { axis: 'sparse-dense', value: 0.5 },
      ],
      source: 'test',
      extractedAt: '',
    };

    const estimate = probe.quickEstimate(desc);
    expect(estimate).toBeGreaterThan(0.5);
    expect(estimate).toBeLessThanOrEqual(1);
  });

  it('quick estimate penalizes extreme descriptors', () => {
    const probe = new PerturbationProbe();
    const balanced: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: '',
    };
    const extreme: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.05 }],
      source: 'test',
      extractedAt: '',
    };

    expect(probe.quickEstimate(balanced)).toBeGreaterThan(probe.quickEstimate(extreme));
  });

  it('handles short output gracefully', () => {
    const probe = new PerturbationProbe();
    const extractor = new BehaviorDescriptorExtractor();
    const desc = extractor.extract('x');
    const result = probe.probe('x', desc, (t) => extractor.extract(t));
    expect(result.resilience).toBeGreaterThanOrEqual(0);
  });
});

// ── EmergenceCritic ──

describe('EmergenceCritic', () => {
  it('evaluatesQuick returns all signals in 0–1 range', () => {
    const critic = new EmergenceCritic();
    const desc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: '',
    };
    const result = critic.evaluateQuick({
      descriptor: desc,
      qualityScore: 0.7,
      archive: [],
      output: 'function draw() { circle(100, 100, 50); }',
    });

    for (const key of Object.keys(result.signals) as Array<keyof typeof result.signals>) {
      expect(result.signals[key]).toBeGreaterThanOrEqual(0);
      expect(result.signals[key]).toBeLessThanOrEqual(1);
    }
    expect(result.composite).toBeGreaterThanOrEqual(0);
    expect(result.composite).toBeLessThanOrEqual(1);
    expect(result.mode).toBe('quick');
    expect(result.breakdown).toHaveLength(6);
  });

  it('evaluateFull returns mode=full', async () => {
    const critic = new EmergenceCritic();
    const extractor = new BehaviorDescriptorExtractor();
    const output = 'function draw() { background(0); circle(100, 100, 50); }';
    const desc = extractor.extract(output);

    const result = await critic.evaluateFull({
      output,
      descriptor: desc,
      qualityScore: 0.8,
      archive: [],
      extractFn: (t) => extractor.extract(t),
    });
    expect(result.mode).toBe('full');
    expect(result.signals.perturbationResilience).toBeGreaterThanOrEqual(0);
  });

  it('gives higher novelty to unique descriptors vs common ones', () => {
    const critic = new EmergenceCritic();

    const archive = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`e-${i}`, [{ axis: 'order-chaos', value: 0.5 }]),
    );

    const common: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: '',
    };
    const unique: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.95 }],
      source: 'test',
      extractedAt: '',
    };

    const commonResult = critic.evaluateQuick({ descriptor: common, qualityScore: 0.7, archive, output: 'test' });
    const uniqueResult = critic.evaluateQuick({ descriptor: unique, qualityScore: 0.7, archive, output: 'test' });
    expect(uniqueResult.signals.novelty).toBeGreaterThan(commonResult.signals.novelty);
  });

  it('breakdown contributions sum to composite', () => {
    const critic = new EmergenceCritic();
    const desc: BehaviorDescriptor = {
      values: [{ axis: 'order-chaos', value: 0.5 }],
      source: 'test',
      extractedAt: '',
    };
    const result = critic.evaluateQuick({ descriptor: desc, qualityScore: 0.6, archive: [], output: 'test' });
    const sum = result.breakdown.reduce((s, b) => s + b.contribution, 0);
    expect(sum).toBeCloseTo(result.composite, 5);
  });

  it('exposes sub-components', () => {
    const critic = new EmergenceCritic();
    expect(critic.getNoveltyIndex()).toBeInstanceOf(NoveltyIndex);
    expect(critic.getTemporalAnalyzer()).toBeInstanceOf(TemporalStructureAnalyzer);
    expect(critic.getPerturbationProbe()).toBeInstanceOf(PerturbationProbe);
  });
});

// ── EmergenceScorecard ──

describe('EmergenceScorecard', () => {
  it('grades signals correctly', () => {
    const scorecard = new EmergenceScorecard();
    const result = scorecard.score({
      novelty: 0.85,
      structure: 0.7,
      temporalRichness: 0.6,
      perturbationResilience: 0.5,
      fertility: 0.4,
      aesthetic: 0.3,
    });

    expect(result.entries).toHaveLength(6);
    expect(result.entries[0].grade).toBe('A'); // 0.85
    expect(result.entries[5].grade).toBe('D'); // 0.3
  });

  it('computes overall grade', () => {
    const scorecard = new EmergenceScorecard();
    const result = scorecard.score({
      novelty: 0.9,
      structure: 0.8,
      temporalRichness: 0.7,
      perturbationResilience: 0.6,
      fertility: 0.5,
      aesthetic: 0.4,
    });

    expect(result.overall.score).toBeGreaterThan(0.5);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.overall.grade);
    expect(result.overall.verdict).toBeTruthy();
  });

  it('identifies strengths and weaknesses', () => {
    const scorecard = new EmergenceScorecard();
    const result = scorecard.score({
      novelty: 0.9,
      structure: 0.8,
      temporalRichness: 0.1,
      perturbationResilience: 0.05,
      fertility: 0.6,
      aesthetic: 0.7,
    });

    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('generates recommendations for low signals', () => {
    const scorecard = new EmergenceScorecard();
    const result = scorecard.score({
      novelty: 0.1,
      structure: 0.1,
      temporalRichness: 0.1,
      perturbationResilience: 0.1,
      fertility: 0.5,
      aesthetic: 0.5,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('formats as readable string', () => {
    const scorecard = new EmergenceScorecard();
    const result = scorecard.score({
      novelty: 0.5,
      structure: 0.5,
      temporalRichness: 0.5,
      perturbationResilience: 0.5,
      fertility: 0.5,
      aesthetic: 0.5,
    });

    const text = scorecard.format(result);
    expect(text).toContain('Emergence Scorecard');
    expect(text).toContain('Overall:');
    expect(text).toContain('[C]'); // 0.5 = C grade
  });
});

// ── NicheQuotaPolicy ──

describe('NicheQuotaPolicy', () => {
  it('identifies over-represented niches', () => {
    const policy = new NicheQuotaPolicy({ maxNicheFraction: 0.3 });

    const cell: any = {
      cellId: 'order-chaos:5',
      coordinates: [],
      elite: makeEntry('e1', [{ axis: 'order-chaos', value: 0.55 }]),
      nearElites: [
        makeEntry('e2', [{ axis: 'order-chaos', value: 0.52 }]),
        makeEntry('e3', [{ axis: 'order-chaos', value: 0.58 }]),
      ],
      capacity: 4,
    };

    const allocations = policy.computeAllocations([cell], ['order-chaos']);
    const overRep = allocations.find(a => a.reason === 'over-represented');
    expect(overRep).toBeDefined();
  });

  it('marks empty niches for exploration', () => {
    const policy = new NicheQuotaPolicy({ binsPerAxis: 3 });

    const cell: any = {
      cellId: 'order-chaos:1',
      coordinates: [],
      elite: makeEntry('e1', [{ axis: 'order-chaos', value: 0.4 }]),
      nearElites: [],
      capacity: 4,
    };

    const allocations = policy.computeAllocations([cell], ['order-chaos']);
    const empty = allocations.filter(a => a.reason === 'empty');
    expect(empty.length).toBeGreaterThan(0);
  });

  it('getTargetNiches returns empty/under-represented only', () => {
    const policy = new NicheQuotaPolicy({ binsPerAxis: 3 });
    const targets = policy.getTargetNiches([], ['order-chaos'], 5);
    for (const t of targets) {
      expect(t.reason).toBe('empty');
    }
  });

  it('balance score is 0 for 0-1 cells', () => {
    const policy = new NicheQuotaPolicy();
    expect(policy.getBalanceScore([])).toBe(0);
    expect(policy.getBalanceScore([{
      cellId: 'x:0',
      coordinates: [],
      elite: makeEntry('a', [{ axis: 'order-chaos', value: 0.5 }]),
      nearElites: [],
      capacity: 4,
    }] as any)).toBe(0);
  });

  it('balance score approaches 1 for balanced archive', () => {
    const policy = new NicheQuotaPolicy();
    const cells = [0, 1, 2].map(i => ({
      cellId: `order-chaos:${i}`,
      coordinates: [],
      elite: makeEntry(`e-${i}`, [{ axis: 'order-chaos', value: (i + 0.5) / 3 }]),
      nearElites: [],
      capacity: 4,
    })) as any;

    const balance = policy.getBalanceScore(cells);
    expect(balance).toBe(1); // Perfectly balanced
  });
});

// ── ArchiveTaskPlanner ──

describe('ArchiveTaskPlanner', () => {
  it('plans empty-niche filling tasks', () => {
    const planner = new ArchiveTaskPlanner();
    const plan = planner.plan([], ['order-chaos']);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks[0].type).toBe('fresh-exploration');
  });

  it('plans improvement tasks for low-quality cells', () => {
    const planner = new ArchiveTaskPlanner();

    const entry = makeEntry('improve-me', [{ axis: 'order-chaos', value: 0.5 }]);
    entry.qualityScore = 0.6;
    const cells = [{
      cellId: 'order-chaos:5',
      coordinates: [],
      elite: entry,
      nearElites: [],
      capacity: 4,
    }] as any;

    const plan = planner.plan(cells, ['order-chaos']);
    const improvement = plan.tasks.find(t => t.type === 'perturbation-probe');
    expect(improvement).toBeDefined();
  });

  it('plans replay for user-pinned entries', () => {
    const planner = new ArchiveTaskPlanner();

    const entry = makeEntry('pinned', [{ axis: 'order-chaos', value: 0.5 }]);
    const prefs = new Map<string, { positive: number; negative: number }>();
    prefs.set('pinned', { positive: 5, negative: 0 });

    const cells = [{
      cellId: 'order-chaos:5',
      coordinates: [],
      elite: entry,
      nearElites: [],
      capacity: 4,
    }] as any;

    const plan = planner.plan(cells, ['order-chaos'], prefs);
    const replay = plan.tasks.find(t => t.type === 'replay-promising');
    expect(replay).toBeDefined();
    expect(replay!.reason).toContain('user-pinned');
  });

  it('respects maxTasks limit', () => {
    const planner = new ArchiveTaskPlanner({ maxTasks: 2 });
    const plan = planner.plan([], ['order-chaos']);
    expect(plan.tasks.length).toBeLessThanOrEqual(2);
  });

  it('includes archive summary', () => {
    const planner = new ArchiveTaskPlanner();
    const plan = planner.plan([], ['order-chaos']);
    expect(plan.archiveSummary).toBeDefined();
    expect(typeof plan.archiveSummary.totalCells).toBe('number');
    expect(typeof plan.archiveSummary.balanceScore).toBe('number');
  });
});
