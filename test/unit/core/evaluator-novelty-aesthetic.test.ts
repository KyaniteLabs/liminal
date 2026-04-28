import { describe, it, expect } from 'vitest';
import { CreativeEvaluator } from '../../../src/core/CreativeEvaluator.js';
import { NoveltyArchive } from '../../../src/evolution/NoveltyArchive.js';
import { AestheticModel } from '../../../src/evolution/AestheticModel.js';
import { extractBehavior } from '../../../src/evolution/BehaviorVectors.js';

const sampleCode = `function setup() { createCanvas(800, 600); } function draw() { background(220); ellipse(mouseX, mouseY, 50); }`;

describe('CreativeEvaluator novelty + aesthetic integration', () => {
  describe('novelty scoring via archive', () => {
    it('returns noveltyScore when noveltyArchive is provided', () => {
      const archive = new NoveltyArchive();
      archive.add(new Array(32).fill(0));

      const result = CreativeEvaluator.assess(sampleCode, { noveltyArchive: archive });

      expect(result.noveltyScore).not.toBeNull();
      expect(typeof result.noveltyScore).toBe('number');
      expect(result.noveltyScore).toBeGreaterThanOrEqual(0);
      expect(result.noveltyScore).toBeLessThanOrEqual(1);
    });

    it('returns undefined noveltyScore when noveltyArchive is not provided', () => {
      const result = CreativeEvaluator.assess(sampleCode);

      expect(result.noveltyScore).toBeUndefined();
    });
  });

  describe('aesthetic scoring via model', () => {
    it('returns aestheticScore when aestheticModel is provided', () => {
      const model = new AestheticModel();
      model.update([
        { behavior: new Array(32).fill(0.5), rating: 4, domain: 'p5' },
        { behavior: new Array(32).fill(0.3), rating: 3, domain: 'p5' },
      ]);

      const result = CreativeEvaluator.assess(sampleCode, { aestheticModel: model });

      expect(result.aestheticScore).not.toBeNull();
      expect(typeof result.aestheticScore).toBe('number');
      expect(result.aestheticScore).toBeGreaterThanOrEqual(0);
      expect(result.aestheticScore).toBeLessThanOrEqual(1);
    });

    it('returns undefined aestheticScore when aestheticModel is not provided', () => {
      const result = CreativeEvaluator.assess(sampleCode);

      expect(result.aestheticScore).toBeUndefined();
    });
  });

  describe('novelty criterion uses archive score', () => {
    it('novelty criterion uses noveltyScore from archive when available', () => {
      const archive = new NoveltyArchive();
      // Add a behavior vector identical to what extractBehavior would produce
      // so the novelty score will be 0 (not novel — already in archive)
      const behavior = extractBehavior(sampleCode);
      archive.add(behavior);

      const withArchive = CreativeEvaluator.assess(sampleCode, {
        evaluationCriteria: ['novelty'],
        noveltyArchive: archive,
      });
      const withoutArchive = CreativeEvaluator.assess(sampleCode, {
        evaluationCriteria: ['novelty'],
      });

      // When the behavior is already in the archive, novelty should be 0
      expect(withArchive.noveltyScore).toBe(0);
      expect(withArchive.score).toBe(0);
      // Without archive, novelty falls back to creativeScore which should be > 0
      expect(withoutArchive.score).toBeGreaterThan(0);
    });

    it('aesthetic criterion uses aestheticScore from model when available', () => {
      const model = new AestheticModel();
      // Train with a low rating near the sample behavior
      const behavior = extractBehavior(sampleCode);
      model.update([
        { behavior, rating: 1, domain: 'p5' },
        { behavior: new Array(32).fill(1), rating: 1, domain: 'p5' },
      ]);

      const withModel = CreativeEvaluator.assess(sampleCode, {
        evaluationCriteria: ['aesthetic'],
        aestheticModel: model,
      });

      expect(withModel.aestheticScore).not.toBeNull();
      expect(withModel.score).toBe(withModel.aestheticScore!);
    });
  });

  describe('backward compatibility', () => {
    it('assess works without novelty/aesthetic options', () => {
      const result = CreativeEvaluator.assess(sampleCode);

      expect(result.passed).not.toBeNull();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.technicalScore).toBeGreaterThanOrEqual(0);
      expect(result.creativeScore).toBeGreaterThanOrEqual(0);
      expect(result.issues).not.toBeNull();
      expect(result.metrics).not.toBeNull();
      expect(result.noveltyScore).toBeUndefined();
      expect(result.aestheticScore).toBeUndefined();
    });

    it('assess with evaluationCriteria still works without novelty/aesthetic models', () => {
      const result = CreativeEvaluator.assess(sampleCode, {
        evaluationCriteria: ['technical', 'aesthetic', 'novelty'],
      });

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.noveltyScore).toBeUndefined();
      expect(result.aestheticScore).toBeUndefined();
      // novelty criterion falls back to creativeScore, aesthetic to (creative+sound)/2
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('behaviorVector option', () => {
    it('behaviorVector option overrides auto-extraction', () => {
      const archive = new NoveltyArchive();
      const customBehavior = new Array(32).fill(1);
      archive.add(customBehavior);

      // When we provide the exact same behavior, novelty should be 0
      const result = CreativeEvaluator.assess(sampleCode, {
        noveltyArchive: archive,
        behaviorVector: customBehavior,
      });

      expect(result.noveltyScore).toBe(0);
    });

    it('omitting behaviorVector triggers auto-extraction', () => {
      const archive = new NoveltyArchive();
      const behavior = extractBehavior(sampleCode);
      archive.add(behavior);

      const result = CreativeEvaluator.assess(sampleCode, {
        noveltyArchive: archive,
      });

      // Auto-extracted behavior matches the archived one, so novelty = 0
      expect(result.noveltyScore).toBe(0);
    });
  });
});
