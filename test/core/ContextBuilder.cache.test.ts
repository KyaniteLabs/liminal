/**
 * ContextBuilder Cache Defeat Tests
 *
 * Tests to verify that consecutive iterations produce different context
 * to defeat LLM caching and ensure fresh output each iteration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildContextForInjection } from '../../src/core/ContextBuilder.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';

describe('ContextBuilder', () => {
  describe('Cache defeat', () => {
    beforeEach(() => {
      ContextAccumulation.clear();
    });

    afterEach(() => {
      ContextAccumulation.clear();
    });

    it('should include iteration number in context', () => {
      const context = buildContextForInjection(1, { maxIterations: 5 });
      
      expect(context).toContain('Iteration: 1');
    });

    it('should include "X of Y" format for iteration count', () => {
      // First save some history so we get the detailed format
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 });
      
      expect(context).toContain('Current iteration: 2 of 5');
    });

    it('should include timestamp in context after first iteration', () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 });
      
      expect(context).toMatch(/Timestamp:\s*\d+/);
    });

    it('should include random seed in context after first iteration', () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 });
      
      expect(context).toMatch(/Random seed:\s*[a-z0-9]+/);
    });

    it('should include previous code hash when previousCode is provided', () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const previousCode = 'const previous = "code"; console.log(previous);';
      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', previousCode);
      
      expect(context).toContain('Previous output hash:');
      // Hash should be 16 hex characters
      expect(context).toMatch(/Previous output hash:\s*[a-f0-9]{16}/);
    });

    it('should generate different contexts for consecutive calls', async () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context1 = buildContextForInjection(2, { maxIterations: 5 });
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const context2 = buildContextForInjection(2, { maxIterations: 5 });

      // Contexts should be different due to timestamps and random seeds
      expect(context1).not.toBe(context2);
    });

    it('should generate different hashes for different previous code', () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context1 = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', 'code version 1');
      const context2 = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', 'code version 2');

      // Extract hashes from contexts
      const hash1 = context1.match(/Previous output hash:\s*([a-f0-9]{16})/)?.[1];
      const hash2 = context2.match(/Previous output hash:\s*([a-f0-9]{16})/)?.[1];

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should use mostRecent.code when previousCode is not provided', () => {
      const code1 = 'const first = 1;';
      
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: code1,
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 });
      
      expect(context).toContain('Previous output hash:');
    });
  });

  describe('Cache defeat integration', () => {
    beforeEach(() => {
      ContextAccumulation.clear();
    });

    afterEach(() => {
      ContextAccumulation.clear();
    });

    it('should simulate multi-iteration scenario with unique contexts', async () => {
      const contexts: string[] = [];
      let previousCode = '';

      // Simulate 3 iterations
      for (let i = 1; i <= 3; i++) {
        const context = buildContextForInjection(i, { maxIterations: 5 }, 'test', 'loaded', previousCode);
        contexts.push(context);

        // Save to context accumulation (simulating what RalphLoop does)
        ContextAccumulation.save({
          iteration: i,
          prompt: 'test',
          usedPrompt: 'test used',
          code: `const iteration${i} = ${i};`,
          evaluation: { score: 0.5 + i * 0.1, issues: [] },
          timestamp: new Date().toISOString(),
          maxIterations: 5,
        });

        previousCode = `const iteration${i} = ${i};`;
        
        // Small delay to ensure different timestamps
        if (i < 3) await new Promise(resolve => setTimeout(resolve, 5));
      }

      // All contexts should be unique
      const uniqueContexts = new Set(contexts);
      expect(uniqueContexts.size).toBe(contexts.length);

      // Each context should contain iteration info (case-insensitive check)
      contexts.forEach((ctx, idx) => {
        expect(ctx.toLowerCase()).toContain(`iteration: ${idx + 1}`);
      });
    });
  });
});
