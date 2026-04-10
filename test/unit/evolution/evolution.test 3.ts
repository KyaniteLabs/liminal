import { describe, it, expect } from 'vitest';
import {
  FitnessCombiner,
  DEFAULT_FITNESS_WEIGHTS,
} from '../../../src/evolution/FitnessCombiner.js';
import {
  crossoverReasoning,
  combineReasoning,
  DOMAIN_MAPPINGS,
} from '../../../src/evolution/CrossDomainCrossover.js';
import {
  classifyTier,
  getNextTierGoal,
  TIERS,
} from '../../../src/evolution/ProgressiveDesignTiers.js';
import { NoveltyArchive } from '../../../src/evolution/NoveltyArchive.js';
import { AestheticModel } from '../../../src/evolution/AestheticModel.js';
import { MapElites } from '../../../src/evolution/MapElites.js';
import { extractBehavior, detectDomain } from '../../../src/evolution/BehaviorVectors.js';
import { MetaMode } from '../../../src/evolution/MetaMode.js';

// ─── FitnessCombiner ────────────────────────────────────────────────────

describe('FitnessCombiner', () => {
  it('calculates weighted fitness from components', () => {
    const combiner = new FitnessCombiner();
    const result = combiner.calculate({
      novelty: 0.8,
      quality: 0.5,
      technical: 0.5,
      diversity: 0.5,
    });
    // 0.4*0.8 + 0.3*0.5 + 0.2*0.5 + 0.1*0.5 = 0.32 + 0.15 + 0.1 + 0.05 = 0.62
    expect(result).toBeCloseTo(0.62, 5);
  });

  it('clamps component values to 0-1 range', () => {
    const combiner = new FitnessCombiner();
    // -1 clamped to 0, 2 clamped to 1: 0.4*0 + 0.3*1 + 0.2*0.5 + 0.1*0.5 = 0 + 0.3 + 0.1 + 0.05 = 0.45
    expect(combiner.calculate({ novelty: -1, quality: 2, technical: 0.5, diversity: 0.5 })).toBeCloseTo(0.45, 5);
    expect(combiner.calculate({ novelty: 0, quality: 0, technical: 0, diversity: 0 })).toBeCloseTo(0, 5);
  });

  it('validates weights must sum to 1.0', () => {
    // Sum = 0.5+0.5+0.5+0.5 = 2.0, should throw
    expect(() => new FitnessCombiner({ novelty: 0.5, quality: 0.5, technical: 0.5, diversity: 0.5 })).toThrow(/sum to 1/);
    // Sum = 0.6+0.1+0.2+0.1 = 1.0 (defaults fill in technical, diversity), should not throw
    expect(() => new FitnessCombiner({ novelty: 0.6, quality: 0.1 })).not.toThrow();
  });

  it('rank orders items by fitness descending', () => {
    const combiner = new FitnessCombiner();
    const items = [
      { id: 'a', components: { novelty: 0.8, quality: 0.8, technical: 0.8, diversity: 0.8 } },
      { id: 'b', components: { novelty: 0.7, quality: 0.7, technical: 0.7, diversity: 0.7 } },
      { id: 'c', components: { novelty: 0.2, quality: 0.2, technical: 0.2, diversity: 0.2 } },
    ];
    const ranked = combiner.rank(items);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].id).toBe('a');
    expect(ranked[1].id).toBe('b');
    expect(ranked[2].id).toBe('c');
    expect(ranked[0].fitness).toBeGreaterThan(ranked[1].fitness);
    expect(ranked[1].fitness).toBeGreaterThan(ranked[2].fitness);
  });

  it('calculateBatch maps items with fitness', () => {
    const combiner = new FitnessCombiner();
    const items = [
      { id: 'a', components: { novelty: 1, quality: 1, technical: 1, diversity: 1 } },
      { id: 'b', components: { novelty: 0.5, quality: 0.5, technical: 0.5, diversity: 0.5 } },
    ];
    const result = combiner.calculateBatch(items);
    expect(result).toHaveLength(2);
    expect(result[0].fitness).toBeCloseTo(1.0, 5);
    expect(result[1].fitness).toBeCloseTo(0.5, 5);
  });

  it('setWeights updates weights and validates', () => {
    const combiner = new FitnessCombiner();
    // novelty: 0.6 + quality: 0.3 + default technical: 0.2 + default diversity: 0.1 = 1.2 -> should throw
    expect(() => combiner.setWeights({ novelty: 0.6, quality: 0.3 })).toThrow(/sum to 1/);
    // Valid: 0.5 + 0.2 + 0.2 + 0.1 = 1.0
    combiner.setWeights({ novelty: 0.5, quality: 0.2 });
    const weights = combiner.getWeights();
    expect(weights.novelty).toBe(0.5);
    expect(weights.quality).toBe(0.2);
  });

  it('DEFAULT_FITNESS_WEIGHTS sums to 1.0', () => {
    const sum = DEFAULT_FITNESS_WEIGHTS.novelty + DEFAULT_FITNESS_WEIGHTS.quality +
      DEFAULT_FITNESS_WEIGHTS.technical + DEFAULT_FITNESS_WEIGHTS.diversity;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ─── CrossDomainCrossover ────────────────────────────────────────────────

describe('CrossDomainCrossover', () => {
  it('transfers technique from music to visual domain', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', { bpm: 120 });
    expect(result.sourceDomain).toBe('music');
    expect(result.targetDomain).toBe('visual');
    expect(result.transferredTechniques).toEqual(['animation_speed']);
    // bpm: 120/160 = 0.75
    expect(result.adaptedDecisions.bpm).toBeCloseTo(0.75, 5);
  });

  it('transfers technique from visual to music domain', () => {
    const result = crossoverReasoning('visual', 'music', 'animation_speed', { animation_speed: 0.75 });
    expect(result.transferredTechniques).toEqual(['tempo']);
    // Reverse: 0.75 * 160 = 120
    expect(result.adaptedDecisions.animation_speed).toBeCloseTo(120, 1);
  });

  it('transfers technique from visual to code domain with low hue', () => {
    const result = crossoverReasoning('visual', 'code', 'color', { hue: 30 });
    // hue < 180 -> 'descriptive'
    expect(result.adaptedDecisions.hue).toBe('descriptive');
  });

  it('transfers technique from visual to code domain with high hue', () => {
    const result = crossoverReasoning('visual', 'code', 'color', { hue: 200 });
    // hue >= 180 -> 'concise'
    expect(result.adaptedDecisions.hue).toBe('concise');
  });

  it('falls back to identity transfer for unmapped domain pair', () => {
    const result = crossoverReasoning('music', 'code', 'unknown_technique', { bpm: 120 });
    // No mapping for music→code in DOMAIN_MAPPINGS
    expect(result.transferredTechniques).toEqual(['unknown_technique_as_code']);
    // bpm should pass through unchanged
    expect(result.adaptedDecisions.bpm).toBe(120);
    // Creativity should be higher for unmapped (distance bonus)
    expect(result.creativityLevel).toBeGreaterThan(0.4);
  });

  it('respects explicit creativity hint', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', { bpm: 120 }, 0.2);
    expect(result.creativityLevel).toBeCloseTo(0.2, 5);
  });

  it('combines reasoning from multiple sources', () => {
    const result = combineReasoning([
      { domain: 'music', technique: 'rhythm', weight: 0.7 },
      { domain: 'visual', technique: 'pattern_repeat', weight: 0.3 },
    ]);
    expect(result.hybridTechnique).toBe('rhythm-pattern_repeat');
    expect(result.domains).toEqual(['music', 'visual']);
  });

  it('returns empty result for empty sources', () => {
    const result = combineReasoning([]);
    expect(result.hybridTechnique).toBe('');
    expect(result.domains).toEqual([]);
  });

  it('DOMAIN_MAPPINGS has expected key structure', () => {
    expect(Object.keys(DOMAIN_MAPPINGS).length).toBeGreaterThan(0);
    for (const [key, mapping] of Object.entries(DOMAIN_MAPPINGS)) {
      expect(mapping.source).toBeTruthy();
      expect(mapping.target).toBeTruthy();
      expect(typeof mapping.techniqueMap).toBe('object');
      expect(typeof mapping.decisionMap).toBe('object');
    }
    // Keys use arrow notation
    expect(Object.keys(DOMAIN_MAPPINGS)).toContain('music\u2192visual');
    expect(Object.keys(DOMAIN_MAPPINGS)).toContain('visual\u2192music');
  });
});

// ─── ProgressiveDesignTiers ────────────────────────────────────────────

describe('ProgressiveDesignTiers', () => {
  it('classifies score 0 as glitch tier', () => {
    const tier = classifyTier(0);
    expect(tier.name).toBe('glitch');
    expect(tier.level).toBe(0);
  });

  it('classifies score 0.25 as basic tier', () => {
    expect(classifyTier(0.25).name).toBe('basic');
  });

  it('classifies score 0.5 as functional tier', () => {
    expect(classifyTier(0.5).name).toBe('functional');
  });

  it('classifies score 0.75 as refined tier', () => {
    expect(classifyTier(0.75).name).toBe('refined');
  });

  it('classifies score 0.95 as perfect tier', () => {
    expect(classifyTier(0.95).name).toBe('perfect');
  });

  it('classifies score 1.0 as perfect tier', () => {
    expect(classifyTier(1).name).toBe('perfect');
  });

  it('clamps negative scores to glitch tier', () => {
    expect(classifyTier(-0.5).name).toBe('glitch');
  });

  it('clamps scores > 1 to perfect tier', () => {
    expect(classifyTier(1.5).name).toBe('perfect');
  });

  it('returns null for next tier beyond max level', () => {
    expect(getNextTierGoal(4)).toBeNull();
  });

  it('returns the next tier for level 0', () => {
    const next = getNextTierGoal(0);
    expect(next).not.toBeNull();
    expect(next!.level).toBe(1);
    expect(next!.name).toBe('basic');
  });

  it('returns the next tier for level 3', () => {
    const next = getNextTierGoal(3);
    expect(next!.level).toBe(4);
    expect(next!.name).toBe('perfect');
  });

  it('TIERS has 5 entries with increasing required scores', () => {
    expect(TIERS).toHaveLength(5);
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].requiredScore).toBeGreaterThan(TIERS[i - 1].requiredScore);
    }
  });

  it('each tier has allowed complexity', () => {
    for (const tier of TIERS) {
      expect(tier.allowedComplexity).toBeGreaterThan(0);
      expect(tier.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── NoveltyArchive extended ────────────────────────────────────────────

describe('NoveltyArchive extended', () => {
  it('retrieveNovelExamples returns empty for empty archive', () => {
    const archive = new NoveltyArchive();
    expect(archive.retrieveNovelExamples(5)).toEqual([]);
  });

  it('retrieveNovelFromReference returns empty for empty archive', () => {
    const archive = new NoveltyArchive();
    expect(archive.retrieveNovelFromReference([0.5, 0.5], 3)).toEqual([]);
  });

  it('retrieveNovelExamples returns items sorted by novelty', () => {
    const archive = new NoveltyArchive(100, 3);
    // Add 5 items with varying spread to ensure different novelty scores
    [[0.0, 0.0], [0.5, 0.5], [1.0, 1.0], [0.25, 0.75], [0.75, 0.25]].forEach(vec => archive.add(vec));
    const examples = archive.retrieveNovelExamples(3);
    expect(examples).toHaveLength(3);
    // Should be sorted descending by novelty
    for (let i = 1; i < examples.length; i++) {
      expect(examples[i - 1].noveltyScore).toBeGreaterThanOrEqual(examples[i].noveltyScore);
    }
  });

  it('retrieveNovelFromReference returns items most different from reference', () => {
    const archive = new NoveltyArchive(100, 3);
    archive.add([0.1, 0.1]);
    archive.add([0.5, 0.5]);
    archive.add([0.9, 0.9]);
    const results = archive.retrieveNovelFromReference([0.0, 0.0], 2);
    expect(results).toHaveLength(2);
    expect(results[0].behavior).toEqual([0.9, 0.9]);
  });
});

// ─── AestheticModel extended ────────────────────────────────────────────

describe('AestheticModel extended', () => {
  it('handles exact match with zero distance giving high score', () => {
    const model = new AestheticModel(3);
    model.update([
      { behavior: [0.5, 0.5], rating: 5, domain: 'test' },
      { behavior: [0.5, 0.5], rating: 4, domain: 'test' },
    ]);
    const score = model.predict([0.5, 0.5], { domain: 'test' });
    // Average of 5 and 4 = 4.5, normalized by /5 = 0.9
    expect(score).toBeCloseTo(0.9, 5);
  });

  it('handles different dimension vectors with zero-padding', () => {
    const model = new AestheticModel(2);
    model.update([
      { behavior: [0.5, 0.5], rating: 5, domain: 'test' },
      { behavior: [0.5, 0.5], rating: 4, domain: 'test' },
    ]);
    // Query with 3D vector — extra dimension padded with 0 in training data
    const score = model.predict([0.5, 0.5, 0.5], { domain: 'test' });
    expect(score).toBeCloseTo(0.9, 5);
  });
});

// ─── MapElites extended ──────────────────────────────────────────────────

describe('MapElites extended', () => {
  it('insert returns true for new cell', () => {
    const grid = new MapElites([5, 5]);
    expect(grid.insert('c1', [0.5, 0.5], 0.8)).toBe(true);
    expect(grid.size()).toBe(1);
  });

  it('insert returns true when replacing with higher fitness', () => {
    const grid = new MapElites([5, 5]);
    grid.insert('c1', [0.5, 0.5], 0.5);
    expect(grid.insert('c2', [0.5, 0.5], 0.9)).toBe(true);
    expect(grid.size()).toBe(1);
  });

  it('insert returns false when fitness is lower', () => {
    const grid = new MapElites([5, 5]);
    grid.insert('c1', [0.5, 0.5], 0.9);
    expect(grid.insert('c2', [0.5, 0.5], 0.5)).toBe(false);
    expect(grid.size()).toBe(1);
  });

  it('get returns null for empty cell', () => {
    const grid = new MapElites();
    expect(grid.get(5, 5)).toBeNull();
  });

  it('get returns cell for occupied cell', () => {
    const grid = new MapElites([10, 10]);
    grid.insert('c1', [0.0, 0.0], 0.7);
    const cell = grid.get(0, 0);
    expect(cell).not.toBeNull();
    expect(cell!.creationId).toBe('c1');
    expect(cell!.fitness).toBe(0.7);
  });

  it('coverage is 0 for empty grid', () => {
    const grid = new MapElites([10, 10]);
    expect(grid.coverage()).toBe(0);
  });

  it('coverage increases with inserts', () => {
    const grid = new MapElites([4, 4]);
    grid.insert('a', [0.0, 0.0], 1);
    expect(grid.coverage()).toBeCloseTo(1 / 16, 5);
    grid.insert('b', [1.0, 1.0], 1);
    expect(grid.coverage()).toBeCloseTo(2 / 16, 5);
  });

  it('clear empties the grid', () => {
    const grid = new MapElites();
    grid.insert('a', [0.5, 0.5], 1);
    expect(grid.size()).toBe(1);
    grid.clear();
    expect(grid.size()).toBe(0);
    expect(grid.coverage()).toBe(0);
  });

  it('getElites returns top N sorted by fitness descending', () => {
    const grid = new MapElites([10, 10]);
    grid.insert('low', [0.1, 0.1], 0.2);
    grid.insert('mid', [0.5, 0.5], 0.5);
    grid.insert('high', [0.9, 0.9], 0.9);
    const elites = grid.getElites(2);
    expect(elites).toHaveLength(2);
    expect(elites[0].creationId).toBe('high');
    expect(elites[0].fitness).toBe(0.9);
    expect(elites[1].creationId).toBe('mid');
  });

  it('getAllCells returns all occupied cells', () => {
    const grid = new MapElites([10, 10]);
    grid.insert('a', [0.2, 0.2], 0.6);
    grid.insert('b', [0.8, 0.8], 0.7);
    const cells = grid.getAllCells();
    expect(cells).toHaveLength(2);
  });

  it('getRandomElite returns null for empty grid', () => {
    const grid = new MapElites();
    expect(grid.getRandomElite()).toBeNull();
  });

  it('getRandomElite returns occupied cell for non-empty grid', () => {
    const grid = new MapElites([5, 5]);
    grid.insert('c1', [0.5, 0.5], 0.8);
    const elite = grid.getRandomElite();
    expect(elite).not.toBeNull();
    expect(elite!.creationId).toBe('c1');
  });

  it('getBehaviorDiversity returns 0 for fewer than 2 cells', () => {
    const grid = new MapElites([5, 5]);
    expect(grid.getBehaviorDiversity()).toBe(0);
    grid.insert('c1', [0.5, 0.5], 0.8);
    expect(grid.getBehaviorDiversity()).toBe(0);
  });

  it('getBehaviorDiversity returns positive value for 2+ cells', () => {
    const grid = new MapElites([10, 10]);
    grid.insert('c1', [0.1, 0.1], 0.8);
    grid.insert('c2', [0.9, 0.9], 0.7);
    const diversity = grid.getBehaviorDiversity();
    expect(diversity).toBeGreaterThan(0);
  });

  it('insertWithEmbedding derives behavior from embedding', () => {
    const grid = new MapElites([5, 5]);
    const result = grid.insertWithEmbedding('c1', 0.8, [0.1, 0.2, 0.3, 0.4]);
    expect(result).toBe(true);
    expect(grid.size()).toBe(1);
  });

  it('setEmbeddingOptions updates options', () => {
    const grid = new MapElites([5, 5]);
    grid.setEmbeddingOptions(true, 0.7);
    const options = grid.getEmbeddingOptions();
    expect(options.useEmbeddings).toBe(true);
    expect(options.embeddingWeight).toBe(0.7);
  });

  it('findSimilarByEmbedding returns empty when no embeddings stored', () => {
    const grid = new MapElites([5, 5]);
    grid.insert('c1', [0.5, 0.5], 0.8);
    expect(grid.findSimilarByEmbedding([0.5, 0.5], 3)).toEqual([]);
  });

  it('getDiverseElite returns empty for empty grid', () => {
    const grid = new MapElites();
    expect(grid.getDiverseElite(3)).toEqual([]);
  });

  it('getDiverseElite returns all cells when count >= size', () => {
    const grid = new MapElites([5, 5]);
    grid.insert('c1', [0.5, 0.5], 0.8);
    expect(grid.getDiverseElite(5)).toHaveLength(1);
  });
});

// ─── BehaviorVectors ────────────────────────────────────────────────────

describe('BehaviorVectors', () => {
  it('detectDomain identifies glsl code', () => {
    expect(detectDomain('void main() { gl_FragColor = vec4(1.0); }')).toBe('glsl');
  });

  it('detectDomain identifies three code', () => {
    expect(detectDomain('const scene = new THREE.Scene();')).toBe('three');
  });

  it('detectDomain identifies hydra code', () => {
    expect(detectDomain('osc(10).out(o0)')).toBe('hydra');
  });

  it('detectDomain identifies strudel code', () => {
    expect(detectDomain('s ("bd $:") |')).toBe('strudel');
  });

  it('detectDomain identifies remotion code', () => {
    expect(detectDomain('import { useCurrentFrame } from "remotion"')).toBe('remotion');
  });

  it('detectDomain identifies html code', () => {
    expect(detectDomain('<!DOCTYPE html><html><body><div>test</div></body></html>')).toBe('html');
  });

  it('detectDomain identifies music code', () => {
    expect(detectDomain('const osc = new OscillatorNode(); osc.frequency.value = 440;')).toBe('music');
  });

  it('detectDomain identifies p5 code', () => {
    expect(detectDomain('function setup() { createCanvas(400, 400); }')).toBe('p5');
  });

  it('detectDomain defaults to p5 for unrecognized code', () => {
    expect(detectDomain('console.log("hello")')).toBe('p5');
  });

  it('extractBehavior returns 72-dimensional vector', () => {
    const vec = extractBehavior('function setup() { createCanvas(400, 400); }');
    expect(vec).toHaveLength(72);
    for (const v of vec) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('extractBehavior with explicit domain uses that domain features', () => {
    const vec = extractBehavior('uniform float u_time;', 'glsl');
    // GLSL features at indices 8-15: index 14 is usesTime, which should be 1 for u_time
    expect(vec[14]).toBe(1); // usesTime
    // index 9 is hasUniforms, should be > 0
    expect(vec[9]).toBeGreaterThan(0); // hasUniforms
  });

  it('extractBehavior for p5 code activates p5 features', () => {
    const code = 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(0); fill(255, 0, 0); }';
    const vec = extractBehavior(code, 'p5');
    expect(vec[0]).toBe(1); // hasSetup
    expect(vec[1]).toBe(1); // hasDraw
    expect(vec[3]).toBe(1); // usesColor
  });
});

// ─── MetaMode extended ──────────────────────────────────────────────────

describe('MetaMode extended', () => {
  it('runExperiment produces score in [0, 1] range', async () => {
    const meta = new MetaMode();
    const experiments = meta.generateHypotheses(0.5);
    const score = await meta.runExperiment(experiments[0]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('runExperiment calculates improvement correctly', async () => {
    const meta = new MetaMode();
    const experiments = meta.generateHypotheses(0.3);
    await meta.runExperiment(experiments[0]);
    const exp = experiments[0];
    expect(exp.improvement).toBeCloseTo(exp.experimentScore! - exp.baselineScore, 10);
  });

  it('full workflow generates, runs, and finds best', async () => {
    const meta = new MetaMode();
    const experiments = meta.generateHypotheses(0.5);
    const scores: number[] = [];
    for (const exp of experiments) {
      scores.push(await meta.runExperiment(exp));
    }
    expect(meta.getCompletedCount()).toBe(6);
    const best = meta.getBestExperiment();
    expect(best).not.toBeNull();
    expect(best!.experimentScore).toBe(Math.max(...scores));
  });
});
