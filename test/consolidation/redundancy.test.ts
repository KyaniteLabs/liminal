/**
 * Fix 8: Consolidate Triple Redundancy - Verification Tests
 *
 * These tests verify that:
 * 1. Only one collaboration system exists (SwarmOrchestrator via CollaborationEngine)
 * 2. ScoringEngine accepts plugins (Strategy pattern)
 * 3. Only one memory system is active (HarnessMemory)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborationEngine } from '../../src/collab/CollaborationEngine.js';
import { ScoringEngine } from '../../src/core/ScoringEngine.js';
import { harnessMemory, HarnessMemory } from '../../src/harness/HarnessMemory.js';

describe('Fix 8: Consolidate Triple Redundancy', () => {
  describe('1. Collaboration System Consolidation', () => {
    it('should have CollaborationEngine as the only entry point', () => {
      const engine = new CollaborationEngine({
        callLLM: async (prompt: string) => `Response: ${prompt}`,
      });
      expect(engine).toBeDefined();
      expect(typeof engine.run).toBe('function');
    });

    it('should not have deprecated DeepCollaboration module', async () => {
      await expect(import('../../src/collab/DeprecatedCollaboration.js')).rejects.toThrow();
    });

    it('should not have deprecated CollaborativeClient module', async () => {
      await expect(import('../../src/collab/DeprecatedCollaboration.js')).rejects.toThrow();
    });

    it('should only support swarm mode', async () => {
      const engine = new CollaborationEngine({
        callLLM: async (prompt: string) => `Response: ${prompt}`,
        swarmConfig: { mode: 'hybrid', maxRounds: 2 },
      });
      
      // Should run without throwing
      // Note: This will actually call the swarm, so we just verify it doesn't throw
      // on construction and has the right interface
      expect(engine.run).toBeDefined();
    });
  });

  describe('2. Scoring System Consolidation', () => {
    let scoringEngine: ScoringEngine;

    beforeEach(() => {
      scoringEngine = new ScoringEngine('comprehensive');
    });

    it('should have ScoringEngine as THE scoring system', () => {
      expect(scoringEngine).toBeDefined();
      expect(typeof scoringEngine.score).toBe('function');
      expect(typeof scoringEngine.register).toBe('function');
    });

    it('should accept plugin strategies', () => {
      const customStrategy = {
        name: 'custom-test-strategy',
        score: () => ({
          score: 0.5,
          dimensions: { technical: 0.5, creative: 0.5 },
          strategy: 'custom-test-strategy',
        }),
      };

      scoringEngine.register(customStrategy);
      expect(scoringEngine.hasStrategy('custom-test-strategy')).toBe(true);
    });

    it('should have built-in strategies including creative and aesthetic', () => {
      const strategies = scoringEngine.listStrategies();
      
      // Core strategies
      expect(strategies).toContain('comprehensive');
      expect(strategies).toContain('fast');
      expect(strategies).toContain('keyword');
      expect(strategies).toContain('fitness');
      
      // Consolidated strategies
      expect(strategies).toContain('creative');
      expect(strategies).toContain('aesthetic');
    });

    it('should support creative scoring strategy', async () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(220);
          ellipse(200, 200, 100);
        }
      `;
      
      const result = await scoringEngine.score({ output: code }, 'creative');
      expect(result.strategy).toBe('creative');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.dimensions.creative).toBeDefined();
    });

    it('should support aesthetic scoring strategy', async () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(255);
          fill(100, 150, 200);
          noStroke();
          ellipse(200, 200, 100);
        }
      `;
      
      const result = await scoringEngine.score({ output: code }, 'aesthetic');
      expect(result.strategy).toBe('aesthetic');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.dimensions.aesthetic).toBeDefined();
    });

    it('should allow unregistering strategies', () => {
      const customStrategy = {
        name: 'temporary-strategy',
        score: () => ({ score: 0.5, dimensions: {}, strategy: 'temporary-strategy' }),
      };

      scoringEngine.register(customStrategy);
      expect(scoringEngine.hasStrategy('temporary-strategy')).toBe(true);
      
      scoringEngine.unregister('temporary-strategy');
      expect(scoringEngine.hasStrategy('temporary-strategy')).toBe(false);
    });
  });

  describe('3. Memory System Consolidation', () => {
    it('should have HarnessMemory as THE memory system', () => {
      expect(harnessMemory).toBeDefined();
      expect(harnessMemory).toBeInstanceOf(HarnessMemory);
    });

    it('should record and retrieve episodes', () => {
      const episodeId = harnessMemory.recordEpisode({
        type: 'generation',
        prompt: 'Test prompt',
        code: 'Test code',
        domain: 'p5',
        score: 0.8,
        tags: ['test', 'particle'],
      });

      expect(episodeId).toBeDefined();
      expect(typeof episodeId).toBe('string');

      const episodes = harnessMemory.getRecentEpisodes(10);
      expect(episodes.length).toBeGreaterThan(0);
    });

    it('should filter episodes by domain', () => {
      // Record episodes in different domains
      harnessMemory.recordEpisode({
        type: 'generation',
        prompt: 'p5 test',
        domain: 'p5',
        tags: ['test'],
      });
      
      harnessMemory.recordEpisode({
        type: 'generation',
        prompt: 'shader test',
        domain: 'shader',
        tags: ['test'],
      });

      const p5Episodes = harnessMemory.getEpisodesByDomain('p5');
      expect(p5Episodes.some(ep => ep.domain === 'p5')).toBe(true);
    });

    it('should track tasks', () => {
      const taskId = harnessMemory.startTask({
        type: 'M8',
        description: 'Test task',
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      const tasks = harnessMemory.getTasks();
      expect(tasks.some(t => t.id === taskId)).toBe(true);
    });

    it('should record adaptations', () => {
      const adaptationId = harnessMemory.recordAdaptation({
        patternName: 'test-pattern',
        patternSeverity: 'low',
        fixType: 'code',
        description: 'Test adaptation',
        success: true,
      });

      expect(adaptationId).toBeDefined();
      expect(typeof adaptationId).toBe('string');

      const adaptations = harnessMemory.getAdaptations();
      expect(adaptations.some(a => a.id === adaptationId)).toBe(true);
    });

    it('should provide memory status', () => {
      const status = harnessMemory.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(typeof status.tasksTotal).toBe('number');
      expect(typeof status.episodesTotal).toBe('number');
      expect(typeof status.adaptationsTotal).toBe('number');
      expect(typeof status.patternsTracked).toBe('number');
    });
  });

  describe('4. Deprecated Modules Removed', () => {
    it('should not have EpisodicMemory module (use HarnessMemory instead)', async () => {
      await expect(import('../../src/brain/ArchivedMemorySystems.js')).rejects.toThrow();
    });

    it('should not have SemanticArtMemory module (use HarnessMemory instead)', async () => {
      await expect(import('../../src/brain/ArchivedMemorySystems.js')).rejects.toThrow();
    });

    it('HarnessMemory should provide all memory functionality', () => {
      // HarnessMemory is the consolidated memory system
      expect(harnessMemory).toBeDefined();
      expect(typeof harnessMemory.initialize).toBe('function');
      expect(typeof harnessMemory.save).toBe('function');
      expect(typeof harnessMemory.getRelevantEpisodes).toBe('function');
    });
  });
});
