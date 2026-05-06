import { describe, it, expect, beforeAll, afterAll, afterEach, test, vi } from 'vitest';
/**
 * Full-Loop Integration Tests for RalphLoop
 *
 * End-to-end tests that verify the complete Ralph-Wiggum Loop:
 * - Real p5.js code generation
 * - Iteration accumulation and context passing
 * - Promise detection and termination
 * - Gallery persistence
 * - Quality evaluation
 * - Complete workflow from start to finish
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
import { installIntegrationProofLLMEnv } from './helpers/proof-llm-server.js';

vi.setConfig({ testTimeout: 60_000 });

/** Skip test when LLM is not configured (template fallback returns same code, no promise). */
function skipIfNoLLM() {
  if (!LLMClient.isConfigured()) {
    console.warn('Skipping test: LLM not configured (template fallback does not emit promise or vary code).');
    return true;
  }
  return false;
}

describe('Full-Loop Integration Tests', () => {
  let testGalleryDir;
  let gallery;
  let proofLLMCleanup;

  beforeAll(async () => {
    proofLLMCleanup = await installIntegrationProofLLMEnv();
    testGalleryDir = path.join(process.cwd(), 'test-full-loop-gallery');
    gallery = new Gallery(testGalleryDir);
  });

  afterAll(async () => {
    await proofLLMCleanup?.();
  });

  afterEach(async () => {
    try {
      await fs.rm(testGalleryDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
    ContextAccumulation.clear();
    RalphLoop.reset();
  });

  describe('Complete Loop Workflow', () => {
    test('should run complete loop with real p5.js generation', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a simple p5.js sketch with a circle that changes color';
      const projectName = 'complete-loop-test';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Verify basic result structure

      expect(result.code).not.toBeNull();
      expect(result?.iterations).toBe(3);
      expect(result.completed).toBe(false); // Max iterations, no promise
      expect(result.reason).toContain('max iterations');
      expect(result.timestamp).not.toBeNull();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(1);

      // Verify generated code is valid p5.js
      expect(result.code).toContain('function setup');
      expect(result.code).toContain('function draw');
      expect(result.code).toContain('createCanvas');
    });

    test('should run complete loop and terminate on COMPLETE promise', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch and include <promise>COMPLETE</promise> when finished';
      const projectName = 'promise-termination-test';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 10,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Verify promise-based termination

      expect(result?.completed).toBe(true);
      expect(result.reason).toContain('promise');
      expect(result.iterations).toBeLessThanOrEqual(10);
      expect(result.code).toContain('<promise>COMPLETE</promise>');

      // Verify generated code is valid
      expect(result.code).toContain('function setup');
      expect(result.code).toContain('function draw');
    });

    test('should verify iterations accumulate in context', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create and improve a p5.js particle system';
      const projectName = 'context-accumulation-test';

      const initialHistory = ContextAccumulation.getHistory();
      expect(initialHistory.length).toBe(0);

      await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir,
        project: projectName
      });

      const finalHistory = ContextAccumulation.getHistory();

      // Verify iterations accumulated
      expect(finalHistory.length).toBe(5);

      // Verify each iteration has proper structure
      finalHistory.forEach((context, index) => {
        expect(context.iteration).toBe(index + 1);
        expect(context.prompt).toBe(prompt);
        expect(context.usedPrompt).not.toBeNull();

        expect(context.code?.length).toBeGreaterThan(0);
        expect(context.evaluation).not.toBeNull();
        expect(context.evaluation.score).toBeGreaterThanOrEqual(0);
        expect(context.evaluation.score).toBeLessThanOrEqual(1);
        expect(context.timestamp).not.toBeNull();
        expect(context.maxIterations).toBe(5);
      });

      // Code evolution: when LLM is used we expect variation; when template is used (no LLM), same code each time
      const codes = finalHistory.map(h => h.code);
      const uniqueCodes = new Set(codes);
      if (LLMClient.isConfigured()) {
        expect(uniqueCodes.size).toBeGreaterThan(1);
      }
      // when not configured, template returns same code so we only assert structure above
    });

    test('should save all iterations to gallery', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js animated sketch';
      const projectName = 'gallery-persistence-test';

      await RalphLoop.run(prompt, {
        maxIterations: 4,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Verify gallery saved iterations
      const history = await gallery.loadHistory(projectName);

      expect(history?.length).toBe(4);

      // Verify each saved iteration
      history.forEach((iteration, index) => {
        expect(iteration.version).toBe(index + 1);

        expect(iteration.code?.length).toBeGreaterThan(0);
        expect(iteration.timestamp).not.toBeNull();
      });

      // Verify gallery directory structure
      const projectPath = gallery.getProjectPath(projectName);
      const stats = await fs.stat(projectPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify individual iteration files exist
      for (let i = 1; i <= 4; i++) {
        const iterationPath = path.join(projectPath, `v${i}.js`);
        const fileExists = await fs.access(iterationPath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    test('should evaluate quality of each iteration', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a high-quality p5.js sketch';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Verify each iteration was evaluated
      expect(history.length).toBe(3);
      history.forEach(context => {
        expect(context.evaluation).not.toBeNull();
        expect(context.evaluation.score).not.toBeNull();
        expect(context.evaluation.score).toBeGreaterThanOrEqual(0);
        expect(context.evaluation.score).toBeLessThanOrEqual(1);

        // Check for issues array
        expect(context.evaluation.issues).not.toBeNull();
        expect(Array.isArray(context.evaluation.issues)).toBe(true);
      });

      // Verify final score matches last iteration
      expect(result.finalScore).toBe(history[history.length - 1].evaluation.score);
    });
  });

  describe('Real p5.js Code Generation', () => {
    test('should generate valid p5.js setup function', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with setup()';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result.code).toContain('function setup');
      expect(result.code).toContain('createCanvas');
      expect(result.code).toContain('background');
    });

    test('should generate valid p5.js draw function', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with draw()';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result.code).toContain('function draw');
      expect(result.code).toMatch(/draw\s*\(\s*\)/);
    });

    test('should generate p5.js sketches with proper syntax', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a syntactically correct p5.js sketch';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      // Test that generated code is valid JavaScript
      expect(() => {
        // Should not throw syntax errors
        Function(result.code);
      }).not.toThrow();

      // Test for balanced brackets and parentheses
      const openBraces = (result.code.match(/\{/g) || []).length;
      const closeBraces = (result.code.match(/\}/g) || []).length;
      expect(openBraces).toBe(closeBraces);

      const openParens = (result.code.match(/\(/g) || []).length;
      const closeParens = (result.code.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });

    test('should generate different code on each iteration', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();
      const codes = history.map(h => h.code);

      // All codes should be defined
      codes.forEach(code => {

        expect(code?.length).toBeGreaterThan(0);
      });

      // When LLM is configured we expect variation; when template fallback is used, same code each time
      const uniqueCodes = new Set(codes);
      if (LLMClient.isConfigured()) {
        expect(uniqueCodes.size).toBeGreaterThan(1);
      }
    });

    test('should include p5.js specific functions and methods', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with various p5.js methods';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      // Look for common p5.js functions/methods
      const p5Functions = [
        'createCanvas', 'background', 'fill', 'stroke', 'rect',
        'ellipse', 'line', 'point', 'triangle', 'quad'
      ];

      const foundFunctions = p5Functions.filter(func => result.code.includes(func));
      expect(foundFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('Context Injection and Evolution', () => {
    test('should inject context into prompt when placeholder exists', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create {{context}}'; // Contains context placeholder

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // First iteration should have context injected
      expect(history[0].usedPrompt).not.toContain('{{context}}');
      expect(history[0].usedPrompt.toLowerCase()).toContain('iteration');

      // Original prompt should be preserved
      expect(history[0].prompt).toBe(prompt);

      // Second iteration should have more context
      expect(history[1].usedPrompt.toLowerCase()).toContain('iteration');
      expect(history[1].usedPrompt).toContain('Previous iterations');
    });

    test('should build proper context for injection', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Improve based on context {{context}}';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Second iteration should reference first
      expect(history[1].usedPrompt).toContain('Previous iterations: 1');
      expect(history[1].usedPrompt).toContain('Last iteration (1)');

      // Third iteration should reference previous
      expect(history[2].usedPrompt).toContain('Previous iterations: 2');
      expect(history[2].usedPrompt).toContain('Last iteration (2)');

      // Context should include quality trends
      expect(history[2].usedPrompt).toContain('Quality trend');
    });

    test('should maintain prompt consistency across iterations', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Use this exact same prompt every iteration';

      await RalphLoop.run(prompt, {
        maxIterations: 4,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // All iterations should have the same original prompt
      history.forEach(context => {
        expect(context.prompt).toBe(prompt);
      });
    });
  });

  describe('Safety Mechanisms', () => {
    test('should enforce max iterations hard limit', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Keep generating forever';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      expect(result.iterations).toBeLessThanOrEqual(5);
      expect(result.iterations).toBe(5); // Should hit max
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('max iterations');
    });

    test('should handle generator failures gracefully', async () => {
      if (skipIfNoLLM()) return;
      const prompt = ''; // Empty prompt that might cause issues

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir,
        tolerateErrors: true
      });

      expect(result).not.toBeNull();
      expect(result.iterations).toBeLessThanOrEqual(2);
    });

    test('should maintain state immutability', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test immutability';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      const history1 = ContextAccumulation.getHistory();
      const history2 = ContextAccumulation.getHistory();

      // Should return copies, not same references
      expect(history1).not.toBe(history2);
      expect(history1[0]).not.toBe(history2[0]);

      // But content should be the same
      expect(history1[0].code).toBe(history2[0].code);
    });
  });

  describe('Promise Detection Integration', () => {
    test('should terminate immediately on COMPLETE promise', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate and finish with <promise>COMPLETE</promise>';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 20, // High limit
        galleryDir: testGalleryDir
      });

      expect(result.completed).toBe(true);
      expect(result.reason).toContain('promise');
      expect(result.code).toContain('<promise>COMPLETE</promise>');
      expect(result.iterations).toBeLessThanOrEqual(20);
    });

    test('should not terminate on partial promise matches', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Generate code but do not include the exact promise format';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      expect(result.completed).toBe(false);
      expect(result.iterations).toBe(3);
      expect(result.reason).toContain('max iterations');
    });

    test('should preserve promise in final output', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create sketch and complete with <promise>COMPLETE</promise>';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 10,
        galleryDir: testGalleryDir
      });

      expect(result.code).toContain('<promise>COMPLETE</promise>');

      // Promise should be in the generated code, not just metadata
      expect(result.code.length).toBeGreaterThan('<promise>COMPLETE</promise>'.length);
    });
  });

  describe('Gallery Integration', () => {
    test('should save complete iteration history to gallery', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a complex p5.js animation';
      const projectName = 'complete-history-test';

      await RalphLoop.run(prompt, {
        maxIterations: 6,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Verify gallery has complete history
      const history = await gallery.loadHistory(projectName);

      expect(history?.length).toBe(6);

      // Verify version sequence
      history.forEach((iteration, index) => {
        expect(iteration.version).toBe(index + 1);
      });

      // Verify timestamps are sequential
      const timestamps = history.map(h => new Date(h.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    test('should create proper directory structure', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test directory structure';
      const projectName = 'directory-structure-test';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Check that gallery directory was created
      const galleryExists = await fs.access(testGalleryDir).then(() => true).catch(() => false);
      expect(galleryExists).toBe(true);

      // Check that project directory was created using Gallery's getProjectPath
      const projectPath = gallery.getProjectPath(projectName);
      const projectExists = await fs.access(projectPath).then(() => true).catch(() => false);
      expect(projectExists).toBe(true);

      // Check that individual iteration files exist
      const v1Path = path.join(projectPath, 'v1.js');
      const v2Path = path.join(projectPath, 'v2.js');

      expect(await fs.access(v1Path).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(v2Path).then(() => true).catch(() => false)).toBe(true);
    });

    test('should save valid JavaScript to gallery files', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create valid p5.js code';
      const projectName = 'valid-code-test';

      await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir,
        project: projectName
      });

      const history = await gallery.loadHistory(projectName);

      // Verify each saved file contains valid JavaScript
      history.forEach(iteration => {
        expect(() => {
          Function(iteration.code);
        }).not.toThrow();
      });
    });
  });

  describe('Result Object Completeness', () => {
    test('should return comprehensive result object', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Create a comprehensive test result';
      const projectName = 'result-completeness-test';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir,
        project: projectName
      });

      // Verify all expected fields exist
      expect(result).toMatchObject({
        code: expect.any(String),
        iterations: 3,
        completed: expect.any(Boolean),
        reason: expect.any(String),
        timestamp: expect.any(String),
        duration: expect.any(Number),
        finalScore: expect.any(Number),
        project: projectName
      });

      // Verify data types and constraints
      expect(typeof result.code).toBe('string');
      expect(typeof result.iterations).toBe('number');
      expect(result.completed === true || result.completed === false).toBe(true);
      expect(typeof result.reason).toBe('string');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.finalScore).toBe('number');

      // Verify constraints
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.iterations).toBe(3);
      expect(result.duration).toBeGreaterThanOrEqual(0); // Changed from > to >= since duration could be 0
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(1);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    test('should track execution duration accurately', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test duration tracking';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 2,
        galleryDir: testGalleryDir
      });

      expect(result.duration).not.toBeNull();
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Duration should be reasonable - just check it's not excessively long
      expect(result.duration).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle very long prompts', async () => {
      if (skipIfNoLLM()) return;
      const longPrompt = 'Create a p5.js sketch '.repeat(1000);

      const result = await RalphLoop.run(longPrompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result?.iterations).toBe(1);
      expect(result.code).not.toBeNull();
    });

    test('should handle unicode in prompts', async () => {
      if (skipIfNoLLM()) return;
      const unicodePrompt = 'Create p5.js art with emoji 🎨 and café and 中文';

      const result = await RalphLoop.run(unicodePrompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir
      });

      expect(result).not.toBeNull();
      expect(result.code).not.toBeNull();
    });

    test('should handle special characters in project names', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test special characters';
      const projectName = 'test-project-123_abc';

      const result = await RalphLoop.run(prompt, {
        maxIterations: 1,
        galleryDir: testGalleryDir,
        project: projectName
      });

      expect(result?.project).toBe(projectName);
    });

    test('should handle concurrent loop executions', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Concurrent execution test';

      // Run multiple loops concurrently with different projects
      const results = await Promise.all([
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-1' }),
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-2' }),
        RalphLoop.run(prompt, { maxIterations: 1, galleryDir: testGalleryDir, project: 'concurrent-3' })
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {

        expect(result?.iterations).toBe(1);
      });

      // Verify each project saved correctly
      const history1 = await gallery.loadHistory('concurrent-1');
      const history2 = await gallery.loadHistory('concurrent-2');
      const history3 = await gallery.loadHistory('concurrent-3');

      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
      expect(history3.length).toBe(1);
    });
  });

  describe('Quality Evolution Tracking', () => {
    test('should track quality scores across iterations', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Improve quality over iterations';

      await RalphLoop.run(prompt, {
        maxIterations: 4,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();
      const scores = history.map(h => h.evaluation.score);

      // Verify we have scores for all iterations
      expect(scores).toHaveLength(4);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('should calculate quality trends in context', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Show quality trends {{context}}';

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      const history = ContextAccumulation.getHistory();

      // Later iterations should include quality trend information
      expect(history[2].usedPrompt).toContain('Quality trend');
      expect(history[2].usedPrompt).toContain('Average score');
      expect(history[2].usedPrompt).toContain('Trend:');
    });
  });

  describe('RalphLoop State Management', () => {
    test('should maintain accurate state information', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test state management';

      // Before running
      expect(RalphLoop.getState().iteration).toBe(0);
      expect(RalphLoop.isRunning()).toBe(false);

      await RalphLoop.run(prompt, {
        maxIterations: 3,
        galleryDir: testGalleryDir
      });

      // After running
      expect(RalphLoop.getState().iteration).toBe(3);
      expect(RalphLoop.isRunning()).toBe(true);
      expect(RalphLoop.getState().history.length).toBe(3);

      // After reset
      RalphLoop.reset();
      expect(RalphLoop.getState().iteration).toBe(0);
      expect(RalphLoop.isRunning()).toBe(false);
    });

    test('should provide accurate progress information', async () => {
      if (skipIfNoLLM()) return;
      const prompt = 'Test progress tracking';

      await RalphLoop.run(prompt, {
        maxIterations: 5,
        galleryDir: testGalleryDir
      });

      const progress = RalphLoop.getProgress();
      expect(progress).not.toBeNull();
      expect(progress.iteration).toBe(5);
      expect(progress.maxIterations).toBe(5);
      expect(progress.progress).toBe(1); // 5/5 = 1.0
    });
  });
});
