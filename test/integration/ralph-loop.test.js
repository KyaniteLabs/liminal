import { describe, it, expect, beforeAll, afterEach, test } from 'vitest';
/**
 * Integration tests for RalphLoop iteration engine
 *
 * Tests the complete Ralph-Wiggum Loop:
 * - Loop terminates on promise detection
 * - Loop terminates on max-iterations
 * - Context correctly passes between iterations
 * - Safety mechanisms work
 * - Integration with all core components
 */

import { RalphLoop } from '../../src/core/RalphLoop.js';
import { PromiseDetector } from '../../src/core/PromiseDetector.js';
import { PromptStore } from '../../src/core/PromptStore.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';
import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';
import { P5Generator } from '../../src/generators/p5/P5Generator.js';
import { Gallery } from '../../src/gallery/Gallery.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import fs from 'fs/promises';
import path from 'path';

/** Skip when LLM not configured (template fallback returns same code, no promise). */
function skipIfNoLLM() {
  if (!LLMClient.isConfigured()) {
    console.warn('Skipping test: LLM not configured (template fallback does not emit promise or vary code).');
    return true;
  }
  return false;
}

describe('RalphLoop Integration Tests', () => {
  let testGalleryDir;
  let gallery;

  beforeAll(() => {
    // Create a test gallery directory
    testGalleryDir = path.join(process.cwd(), 'test-gallery');
    gallery = new Gallery(testGalleryDir);
  });

  afterEach(async () => {
    // Clean up test gallery directory after each test
    try {
      await fs.rm(testGalleryDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    // Clear context accumulation between tests
    ContextAccumulation.clear();
  });

  describe('Basic Loop Functionality', () => {
    test('should run single iteration', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate a simple p5.js sketch';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(1);

      expect(typeof result.code).toBe('string');
      expect(result.code?.length).toBeGreaterThan(0);
    });

    test('should run multiple iterations', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate a particle system';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(3);
      expect(result.code).not.toBeNull();
    });

    test('should terminate on promise detection', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate a sketch and output <promise>COMPLETE</promise> when done';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 20,
        galleryDir: testGalleryDir
      });

      expect(result?.completed).toBe(true);
      expect(result.reason).toContain('promise');
    });

    test('should terminate on max iterations', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate a sketch but never complete it';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(5);
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('max iterations');
    });
  });

  describe('Context Accumulation', () => {
    test('should pass context between iterations', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate and improve a sketch';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      expect(history?.length).toBe(3);

      // Each context entry should have expected structure
      history.forEach((context, index) => {

        expect(context?.iteration).toBe(index + 1);
        expect(context.code).not.toBeNull();
        expect(context.timestamp).not.toBeNull();
      });
    });

    test('should include previous code in context', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Iterate on this sketch';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Second iteration should have access to first iteration's code
      expect(history.length).toBe(2);
      expect(history[0].code).not.toBeNull();
      expect(history[1].code).not.toBeNull();

      // When LLM is configured, code should evolve; when template fallback is used, same code each time
      if (LLMClient.isConfigured()) {
        expect(history[0].code).not.toBe(history[1].code);
      }
    });

    test('should maintain context immutability', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test context';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      const history1 = ContextAccumulation.getHistory();
      const history2 = ContextAccumulation.getHistory();

      // getHistory should return copies, not references
      expect(history1).not.toBe(history2);
      expect(history1[0]).not.toBe(history2[0]);
    });
  });

  describe('Safety Mechanisms', () => {
    test('should enforce max iterations limit', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Run forever';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      expect(result.iterations).toBeLessThanOrEqual(5);
    });

    test('should handle empty prompt gracefully', async () => {
      if (skipIfNoLLM()) return;
      const prompt = '';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(1);
    });

    test('should handle null/undefined options', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test';

      // Should not throw with null options
      const result = await RalphLoop.run(prompt, null);

      expect(result).not.toBeNull();
    });

    test('should handle generator errors gracefully', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test error handling';

      // Mock a scenario where generation might fail
      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir,
        tolerateErrors: true
      });

      expect(result).not.toBeNull();
    });
  });

  describe('Gallery Integration', () => {
    test('should save iterations to gallery', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Save my iterations';
      const projectName = 'test-project';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir,
        project: projectName
      });

      const history = await gallery.loadHistory(projectName);

      expect(history?.length).toBe(3);

      history.forEach((iteration, index) => {
        expect(iteration.version).toBe(index + 1);

        expect(iteration.code?.length).toBeGreaterThan(0);
      });
    });

    test('should create gallery directory structure', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create directory structure';
      const projectName = 'directory-test';

      await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir,
        project: projectName
      });

      const projectPath = gallery.getProjectPath(projectName);

      // Check directory exists
      const stats = await fs.stat(projectPath);
      expect(stats).not.toBeNull();
      expect(stats.isDirectory()).toBe(true);
    });

    test('should handle gallery save failures gracefully', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Handle save failures';

      // Use invalid gallery directory to trigger save error
      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: '/invalid/path/that/cannot/be/created',
        tolerateErrors: true
      });

      // Should complete iteration even if save fails

      expect(result?.iterations).toBe(1);
    });

    test('should throw error when gallery save fails and tolerateErrors is false', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Throw on save failure';

      // Use invalid gallery directory to trigger save error and expect error to be thrown
      await expect(RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: '/invalid/path/that/cannot/be/created',
        tolerateErrors: false,
        project: 'test-project'
      })).rejects.toThrow();
    });
  });

  describe('Quality Evaluation', () => {
    test('should evaluate each iteration', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate quality code';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      expect(result).not.toBeNull();

      // Check that quality was evaluated
      const history = ContextAccumulation.getHistory();
      history.forEach(context => {
        expect(context.evaluation).not.toBeNull();
        expect(context.evaluation.score).toBeGreaterThanOrEqual(0);
        expect(context.evaluation.score).toBeLessThanOrEqual(1);
      });
    });

    test('should track quality improvement', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Improve quality over iterations';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Quality scores should be tracked
      const scores = history.map(h => h.evaluation.score);

      expect(scores?.length).toBe(5);

      // All scores should be valid
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Quality gate', () => {
    test('should break loop when score below minQualityScore', async () => {
      if (skipIfNoLLM()) return;
      RalphLoop.reset();
      // Mock evaluator to return low score so loop exits on quality gate
      const origAssess = CreativeEvaluator.assess;
      CreativeEvaluator.assess = () => ({
        score: 0.5,
        passed: false,
        issues: ['low quality'],
        technicalScore: 0.5,
        creativeScore: 0.5,
        metrics: {}
      });
      try {
        const result = await RalphLoop.run('generate bad code', {
          maxIterations: 5,
          galleryDir: testGalleryDir,
          minQualityScore: 1.0
        });
        expect(result.reason).toContain('quality threshold');
        expect(result.iterations).toBeLessThanOrEqual(2);
      } finally {
        CreativeEvaluator.assess = origAssess;
      }
    });
  });

  describe('Promise Detection', () => {
    test('should detect exact promise string', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Complete this task <promise>COMPLETE</promise>';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 10,
        galleryDir: testGalleryDir
      });

      expect(result.completed).toBe(true);
      expect(result.reason).toContain('promise');
    });

    test('should not detect partial promise matches', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Almost complete but not quite promise COMPLETE almost';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      // Should hit max iterations, not promise detection
      expect(result.iterations).toBe(2);
      expect(result.completed).toBe(false);
    });

    test('should require exact formatting', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'complete with wrong format PROMISE COMPLETE';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      // Should not detect incorrectly formatted promise
      expect(result.iterations).toBe(2);
      expect(result.completed).toBe(false);
    });
  });

  describe('Prompt Consistency', () => {
    test('should use same prompt every iteration', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Use this exact prompt every time';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // All iterations should have the same original prompt
      history.forEach(context => {
        expect(context.prompt).toBe(prompt);
      });
    });

    test('should inject context into prompt', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate {{context}}';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Context should be injected
      expect(history.length).toBe(2);

      // usedPrompt should contain the injected context, not the placeholder
      expect(history[0].usedPrompt).not.toContain('{{context}}');
      expect(history[0].usedPrompt).toContain('Iteration: 1');

      // Original prompt should be preserved
      expect(history[0].prompt).toBe(prompt);
    });
  });

  describe('Result Object', () => {
    test('should return comprehensive result object', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate comprehensive result';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir,
        project: 'result-test'
      });

      expect(result).toMatchObject({
        code: expect.any(String),
        iterations: 3,
        completed: expect.any(Boolean),
        reason: expect.any(String),
        timestamp: expect.any(String),
        finalScore: expect.any(Number)
      });
    });

    test('should include final code in result', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Return final code';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      expect(result.code?.length).toBeGreaterThan(0);

      // Final code should be valid JavaScript
      expect(() => {
        // Should not throw syntax error
        Function(result.code);
      }).not.toThrow();
    });

    test('should track completion time', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Track time';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      expect(result.timestamp).not.toBeNull();
      expect(result.duration).not.toBeNull();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long prompts', async () => {
      if (skipIfNoLLM()) return;
      const longPrompt = 'A'.repeat(10000);

      const result = await RalphLoop.run(longPrompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(1);
    });

    test('should handle unicode in prompts', async () => {
      if (skipIfNoLLM()) return;
      const unicodePrompt = 'Generate art with emoji 🎨 and unicode café';

      const result = await RalphLoop.run(unicodePrompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(1);
    });

    test('should handle special characters in project name', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test special chars';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir,
        project: 'test-project-123'
      });

      expect(result).not.toBeNull();
    });

    test('should handle concurrent loop executions', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Concurrent test';

      // Run multiple loops concurrently
      const results = await Promise.all([
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-1' }),
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-2' }),
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-3' })
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {

        expect(result?.iterations).toBe(1);
      });
    });
  });

  describe('Utility Methods', () => {
    afterEach(() => {
      ContextAccumulation.clear();
    });

    test('getState should return current loop state', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test getState';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const state = RalphLoop.getState();

      expect(state?.iteration).toBe(3);

      expect(state.history?.length).toBe(3);
    });

    test('getState should return empty state when no loop run', () => {
      const state = RalphLoop.getState();

      expect(state?.iteration).toBe(0);
      expect(state.history).toEqual([]);
    });

    test('reset should clear loop state', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test reset';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      expect(RalphLoop.getState().iteration).toBe(3);

      RalphLoop.reset();

      expect(RalphLoop.getState().iteration).toBe(0);
      expect(RalphLoop.getState().history).toEqual([]);
    });

    test('isRunning should return true when loop has run', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test isRunning';

      expect(RalphLoop.isRunning()).toBe(false);

      await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(RalphLoop.isRunning()).toBe(true);
    });

    test('isRunning should return false when no loop has run', () => {
      expect(RalphLoop.isRunning()).toBe(false);
    });

    test('getProgress should return null when no loop running', () => {
      const progress = RalphLoop.getProgress();
      expect(progress).toBeNull();
    });

    test('getProgress should return progress when loop is running', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test getProgress';

      await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      const progress = RalphLoop.getProgress();

      expect(progress).not.toBeNull();
      expect(progress?.iteration).toBe(5);
      expect(progress.maxIterations).not.toBeNull();
      expect(progress.progress).toBe(1); // 5/5 = 1 (complete)
    });

    test('getProgress should calculate progress correctly', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test progress calculation';
      const maxIter = 10;

      await RalphLoop.run(prompt, {
        maxIterations: maxIter,
        galleryDir: testGalleryDir
      });

      const progress = RalphLoop.getProgress();

      expect(progress?.iteration).toBeGreaterThan(0);
      expect(progress.iteration).toBeLessThanOrEqual(maxIter);
      expect(progress.maxIterations).toBe(maxIter);
      // Progress should be 1.0 if loop ran to completion (max iterations or promise detected)
      expect(progress.progress).toBeLessThanOrEqual(1);
    });
  });
});