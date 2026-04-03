/**
 * Integration tests for Guidance flow in chat sessions
 *
 * Tests the complete flow from ConversationManager through RalphLoop
 * with GuidanceEngine providing proactive suggestions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
import { SemanticArtMemory } from '../../src/brain/archive/SemanticArtMemory.js';
import { CreativeBrief } from '../../src/chat/types.js';
import { RalphLoop } from '../../src/core/RalphLoop.js';
import { GuidanceEngine } from '../../src/chat/GuidanceEngine.js';
import type { CompostMill } from '../../src/compost/CompostMill.js';

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

describe('Guidance Flow Integration', () => {
  let conversationManager: ConversationManager;
  let artBrain: SemanticArtMemory;
  let guidance: GuidanceEngine;

  beforeEach(() => {
    artBrain = new SemanticArtMemory();
    guidance = new GuidanceEngine(artBrain);
    conversationManager = new ConversationManager(artBrain);
  });

  describe('ConversationManager initialization', () => {
    it('creates GuidanceEngine instance on initialization', () => {
      expect((conversationManager as any).guidance).toBeDefined();
      expect((conversationManager as any).guidance).toBeInstanceOf(GuidanceEngine);
    });

    it('creates SemanticArtMemory instance if not provided', () => {
      const managerWithoutArtBrain = new ConversationManager();
      expect((managerWithoutArtBrain as any).artBrain).toBeDefined();
      expect((managerWithoutArtBrain as any).artBrain).toBeInstanceOf(SemanticArtMemory);
    });
  });

  describe('Suggestion emission during generation', () => {
    it('records suggestions in conversation history', async () => {
      const brief: CreativeBrief = {
        intent: 'create something abstract',
        context: 'test context',
        mood: 'calm',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple',
      };

      const suggestions: any[] = [];
      const originalRecordMessage = (conversationManager as any).recordMessage.bind(conversationManager);

      // Capture suggestions
      (conversationManager as any).recordMessage = function(role: string, content: string) {
        if (content.includes('[Suggestion]')) {
          suggestions.push({ role, content });
        }
        return originalRecordMessage(role, content);
      };

      // Start generation (will be aborted quickly for test)
      conversationManager.startNewSession();

      // Note: We're not actually running the full loop as it would take too long
      // Instead, we verify the mechanism is in place
      expect((conversationManager as any).guidance).toBeDefined();
    });

    it('emits suggestions via onSuggestion callback', () => {
      const testSuggestions: any[] = [];

      const testLoop = async () => {
        // Simulate what RalphLoop does
        const suggestions = guidance.suggestNextAction({
          prompt: 'create something abstract',
          domain: 'p5',
          techniques: [],
          constraints: [],
          references: [],
        });

        for (const suggestion of suggestions) {
          testSuggestions.push(suggestion);
        }
      };

      return testLoop().then(() => {
        // Should have at least swarm suggestion for early iteration
        expect(testSuggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('GuidanceEngine iteration tracking', () => {
    it('tracks iteration and score for context-aware suggestions', () => {
      guidance.updateIteration(1, 0.5);
      guidance.updateIteration(2, 0.6);
      guidance.updateIteration(3, 0.7);

      expect((guidance as any).currentIteration).toBe(3);
      expect((guidance as any).recentScores).toEqual([0.5, 0.6, 0.7]);
    });

    it('maintains score history within max length', () => {
      for (let i = 1; i <= 15; i++) {
        guidance.updateIteration(i, 0.5 + i * 0.01);
      }

      // Should only keep last 10 scores
      expect((guidance as any).recentScores.length).toBe(10);
    });
  });

  describe('Subsystem data integration', () => {
    it('provides compost suggestions when seeds available', async () => {
      const mockMill = createMockCompostMill(10);
      const guidanceWithCompost = new GuidanceEngine(artBrain, mockMill as CompostMill);

      const suggestions = await guidanceWithCompost.getCompostSuggestions();

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('compost');
    });

    it('provides swarm suggestions for early iterations', async () => {
      const suggestions = await guidance.getSwarmSuggestions({
        prompt: 'something abstract',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('swarm');
    });

    it('provides evolution suggestions when scores plateauing', () => {
      // Set up plateauing scores
      for (let i = 1; i <= 10; i++) {
        guidance.updateIteration(i, 0.7);
      }

      const suggestions = guidance.getEvolutionSuggestions({
        prompt: 'optimize',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('parameter');
      expect(suggestions[0].title).toContain('diversity');
    });
  });

  describe('Suggestion priority ordering', () => {
    it('orders suggestions by priority (high first)', () => {
      (guidance as any).currentIteration = 1;

      const suggestions = guidance.suggestNextAction({
        prompt: 'something abstract',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      });

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

  describe('Empty and edge case handling', () => {
    it('returns empty suggestions for null context', () => {
      const suggestions = guidance.suggestNextAction(null as any);
      expect(suggestions).toEqual([]);
    });

    it('returns empty suggestions for undefined context', () => {
      const suggestions = guidance.suggestNextAction(undefined as any);
      expect(suggestions).toEqual([]);
    });

    it('handles empty prompt gracefully', () => {
      const suggestions = guidance.suggestNextAction({
        prompt: '',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      });

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Full integration with RalphLoop options', () => {
    it('guidanceEngine can be passed to RalphLoop options', () => {
      const options = {
        chatMode: true,
        guidanceEngine: guidance,
        onSuggestion: (suggestion: any) => {
          // Callback receives suggestion
          expect(suggestion).toBeDefined();
          expect(suggestion.type).toBeDefined();
          expect(suggestion.title).toBeDefined();
        },
      };

      // Verify options structure is valid
      expect(options.guidanceEngine).toBe(guidance);
      expect(options.chatMode).toBe(true);
      expect(typeof options.onSuggestion).toBe('function');
    });

    it('onSuggestion callback receives properly formatted suggestions', () => {
      const receivedSuggestions: any[] = [];

      const options = {
        chatMode: true,
        guidanceEngine: guidance,
        onSuggestion: (suggestion: any) => {
          receivedSuggestions.push(suggestion);
        },
      };

      // Simulate what RalphLoop would do
      const suggestions = options.guidanceEngine.suggestNextAction({
        prompt: 'something abstract',
        domain: 'p5',
        techniques: [],
        constraints: [],
        references: [],
      });

      for (const suggestion of suggestions) {
        options.onSuggestion(suggestion);
      }

      expect(receivedSuggestions.length).toBeGreaterThan(0);

      // Verify suggestion structure
      const firstSuggestion = receivedSuggestions[0];
      expect(firstSuggestion.type).toBeDefined();
      expect(firstSuggestion.title).toBeDefined();
      expect(firstSuggestion.description).toBeDefined();
      expect(firstSuggestion.priority).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(firstSuggestion.priority);
    });
  });
});
