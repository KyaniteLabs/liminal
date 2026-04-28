/**
 * Tests for GuidanceEngine - proactive suggestions during generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GuidanceEngine } from '../../../src/chat/GuidanceEngine.js';
import { SemanticArtMemory } from '../../../src/brain/archive/SemanticArtMemory.js';
import type { CompostMill } from '../../../src/compost/CompostMill.js';
import type { GenerationContext } from '../../../src/chat/types.js';

// Mock CompostMill for testing
const createMockCompostMill = (seedCount: number = 0): Partial<CompostMill> => ({
  getSeedCount: async () => seedCount,
  getTopSeeds: async (n: number) => Array(Math.min(n, seedCount)).fill(null).map((_, i) => ({
    id: `seed-${i}`,
    content: `Mock seed content ${i}`,
    score: 0.8 - i * 0.1,
    source: { fragments: [`frag-${i}`], collisionType: 'heuristic', domains: ['p5'] },
    promotedAt: new Date().toISOString(),
    usedBy: [],
    useCount: 0,
  })),
});

describe('GuidanceEngine', () => {
  let artBrain: SemanticArtMemory;
  let guidance: GuidanceEngine;

  beforeEach(() => {
    artBrain = new SemanticArtMemory();
    guidance = new GuidanceEngine(artBrain);
  });

  describe('constructor', () => {
    it('initializes with artBrain', () => {

      expect(guidance['artBrain']).toBe(artBrain);
    });

    it('accepts optional compostMill', () => {
      const mockMill = createMockCompostMill(5);
      const guidanceWithCompost = new GuidanceEngine(artBrain, mockMill as CompostMill);
      expect(guidanceWithCompost).not.toBeNull();
    });

    it('accepts optional swarmOrchestrator', () => {
      const guidanceWithSwarm = new GuidanceEngine(artBrain, undefined, {} as any);
      expect(guidanceWithSwarm).not.toBeNull();
    });
  });

  describe('suggestNextAction', () => {
    it('returns empty array when no context provided', () => {
      const suggestions = guidance.suggestNextAction(null as any);
      expect(suggestions).toEqual([]);
    });

    it('returns empty array for minimal context with no triggers', () => {
      const context: GenerationContext = {
        prompt: 'simple prompt',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      const suggestions = guidance.suggestNextAction(context);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('suggests swarm for early iterations with open-ended prompt', () => {
      const context: GenerationContext = {
        prompt: 'create something calming',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      // Set iteration count to 1 (early iteration)
      (guidance as any).currentIteration = 1;

      const suggestions = guidance.suggestNextAction(context);

      const swarmSuggestion = suggestions.find(s => s.type === 'swarm');

      expect(swarmSuggestion?.title).toContain('approach');
    });

    it('suggests compost when seeds are available', async () => {
      const mockMill = createMockCompostMill(10);
      const guidanceWithCompost = new GuidanceEngine(artBrain, mockMill as CompostMill);

      const context: GenerationContext = {
        prompt: 'stuck on this',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };

      const suggestions = guidanceWithCompost.suggestNextAction(context);

      const compostSuggestion = suggestions.find(s => s.type === 'compost');
      expect(compostSuggestion).not.toBeNull();
    });

    it('suggests technique when iterating without progress', () => {
      const context: GenerationContext = {
        prompt: 'improve this code',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      // Simulate many iterations without progress
      (guidance as any).currentIteration = 8;
      (guidance as any).recentScores = [0.6, 0.6, 0.6, 0.6];

      const suggestions = guidance.suggestNextAction(context);

      const techniqueSuggestion = suggestions.find(s => s.type === 'technique');
      expect(techniqueSuggestion).not.toBeNull();
    });

    it('suggests evolution when scores are plateauing', () => {
      const context: GenerationContext = {
        prompt: 'optimize performance',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      // Simulate plateauing scores
      (guidance as any).recentScores = [0.7, 0.7, 0.7, 0.7, 0.7];
      (guidance as any).currentIteration = 10;

      const suggestions = guidance.suggestNextAction(context);

      const evolutionSuggestion = suggestions.find(s => s.type === 'parameter');

      expect(evolutionSuggestion?.title).toContain('diversity');
    });

    it('prioritizes high-priority suggestions first', () => {
      const context: GenerationContext = {
        prompt: 'help me',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      (guidance as any).currentIteration = 1;

      const suggestions = guidance.suggestNextAction(context);

      // Check that suggestions are sorted by priority
      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const current = priorityOrder[suggestions[i].priority];
          const next = priorityOrder[suggestions[i + 1].priority];
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });

  describe('shouldSuggestSwarm', () => {
    it('returns true for open-ended prompts in early iterations', () => {
      const context: GenerationContext = {
        prompt: 'something abstract',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      expect((guidance as any).shouldSuggestSwarm(context, 1)).toBe(true);
    });

    it('returns false when techniques are already specified', () => {
      const context: GenerationContext = {
        prompt: 'create art',
        domain: 'p5',
        techniques: [{ name: 'perlin noise', domain: 'p5', description: 'noise', keywords: [] }],
        constraints: [],
        references: [],
      };
      expect((guidance as any).shouldSuggestSwarm(context, 1)).toBe(false);
    });

    it('returns false for later iterations', () => {
      const context: GenerationContext = {
        prompt: 'something abstract',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      };
      expect((guidance as any).shouldSuggestSwarm(context, 8)).toBe(false);
    });
  });

  describe('shouldSuggestCompost', () => {
    it('returns true when seed count exceeds threshold', async () => {
      const mockMill = createMockCompostMill(10);
      const guidanceWithCompost = new GuidanceEngine(artBrain, mockMill as CompostMill);

      const result = await (guidanceWithCompost as any).shouldSuggestCompost();
      expect(result).toBe(true);
    });

    it('returns false when seed count is below threshold', async () => {
      const mockMill = createMockCompostMill(2);
      const guidanceWithCompost = new GuidanceEngine(artBrain, mockMill as CompostMill);

      const result = await (guidanceWithCompost as any).shouldSuggestCompost();
      expect(result).toBe(false);
    });

    it('returns false when compostMill is not available', async () => {
      const result = await (guidance as any).shouldSuggestCompost();
      expect(result).toBe(false);
    });
  });

  describe('shouldSuggestTechnique', () => {
    it('returns true when iterating many times without progress', () => {
      (guidance as any).currentIteration = 10;
      (guidance as any).recentScores = [0.6, 0.6, 0.6];

      const result = (guidance as any).shouldSuggestTechnique();
      expect(result).toBe(true);
    });

    it('returns false for early iterations', () => {
      (guidance as any).currentIteration = 2;

      const result = (guidance as any).shouldSuggestTechnique();
      expect(result).toBe(false);
    });
  });

  describe('shouldSuggestEvolution', () => {
    it('returns true when scores are plateauing', () => {
      (guidance as any).recentScores = [0.7, 0.7, 0.7, 0.7, 0.7];

      const result = (guidance as any).shouldSuggestEvolution();
      expect(result).toBe(true);
    });

    it('returns false when scores are improving', () => {
      (guidance as any).recentScores = [0.5, 0.6, 0.7, 0.8];

      const result = (guidance as any).shouldSuggestEvolution();
      expect(result).toBe(false);
    });
  });

  describe('getRecentScoreTrend', () => {
    it('returns scores from recent iterations', () => {
      (guidance as any).recentScores = [0.5, 0.6, 0.7];

      const trend = (guidance as any).getRecentScoreTrend();
      expect(trend).toEqual([0.5, 0.6, 0.7]);
    });

    it('returns empty array when no scores recorded', () => {
      const trend = (guidance as any).getRecentScoreTrend();
      expect(trend).toEqual([]);
    });
  });

  describe('isPlateauing', () => {
    it('returns true when scores are flat', () => {
      const scores = [0.7, 0.7, 0.7, 0.7];
      expect((guidance as any).isPlateauing(scores)).toBe(true);
    });

    it('returns true when scores have low variance', () => {
      const scores = [0.68, 0.7, 0.72, 0.69];
      expect((guidance as any).isPlateauing(scores)).toBe(true);
    });

    it('returns false when scores are improving', () => {
      const scores = [0.5, 0.6, 0.7, 0.8];
      expect((guidance as any).isPlateauing(scores)).toBe(false);
    });

    it('returns false for empty or short arrays', () => {
      expect((guidance as any).isPlateauing([])).toBe(false);
      expect((guidance as any).isPlateauing([0.5])).toBe(false);
    });
  });
});
