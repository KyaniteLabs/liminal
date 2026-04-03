import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initializeGuardrailSystem,
  GuardrailRegistry,
  createResourceLimiter,
  GuardrailTier,
} from '../../src/guardrails/index.js';
import type { ExecutionContext } from '../../src/guardrails/index.js';

describe('Deterministic Guardrails Framework', () => {
  let registry: GuardrailRegistry;

  beforeEach(() => {
    const system = initializeGuardrailSystem({
      shadowMode: false,
      defaultTier: GuardrailTier.ENFORCING,
      telemetry: true,
    });
    registry = system.registry;
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Catastrophic Guardrails', () => {
    it('should block execution when max iterations exceeded', async () => {
      const context: ExecutionContext = {
        taskId: 'test-task-1',
        step: 100,
        maxSteps: 50,
        startTime: Date.now(),
        resources: {
          tokensUsed: 1000,
          tokensLimit: 100000,
          memoryUsedMB: 100,
          memoryLimitMB: 512,
          timeElapsedMs: 1000,
          timeLimitMs: 300000,
          apiCalls: 5,
          apiCallLimit: 50,
        },
        trace: { steps: [] },
      };

      const result = await registry.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.blockingResults.length).toBeGreaterThan(0);
      expect(result.blockingResults[0]?.guardrailId).toBe('guardrail-max-iterations');
    });

    it('should allow execution when within limits', async () => {
      createResourceLimiter('test-task-2', {
        maxTokens: 100000,
        maxMemoryMB: 512,
        maxTimeMs: 300000,
        maxApiCalls: 50,
      });

      const context: ExecutionContext = {
        taskId: 'test-task-2',
        step: 10,
        maxSteps: 50,
        startTime: Date.now(),
        resources: {
          tokensUsed: 1000,
          tokensLimit: 100000,
          memoryUsedMB: 100,
          memoryLimitMB: 512,
          timeElapsedMs: 1000,
          timeLimitMs: 300000,
          apiCalls: 5,
          apiCallLimit: 50,
        },
        trace: { steps: [] },
      };

      const result = await registry.evaluate(context);

      // Should pass catastrophic guardrails
      const catastrophicResults = result.results.filter(
        r => r.guardrailId === 'guardrail-max-iterations'
      );
      expect(catastrophicResults[0]?.passed).toBe(true);
    });

    it('should block unauthorized tool usage', async () => {
      const context: ExecutionContext = {
        taskId: 'test-task-3',
        step: 1,
        maxSteps: 50,
        proposedTool: 'deleteFile',
        allowedTools: ['readFile', 'writeFile'],
        startTime: Date.now(),
        resources: {
          tokensUsed: 100,
          tokensLimit: 100000,
          memoryUsedMB: 50,
          memoryLimitMB: 512,
          timeElapsedMs: 100,
          timeLimitMs: 300000,
          apiCalls: 1,
          apiCallLimit: 50,
        },
        trace: { steps: [] },
      };

      const result = await registry.evaluate(context);

      expect(result.passed).toBe(false);
      const toolGuardrail = result.results.find(
        r => r.guardrailId === 'guardrail-tool-permissions'
      );
      expect(toolGuardrail?.passed).toBe(false);
    });
  });

  describe('Resource Limiter', () => {
    it('should track token usage', () => {
      const limiter = createResourceLimiter('test-resource', {
        maxTokens: 1000,
        maxMemoryMB: 1000,
        maxTimeMs: 10000,
        maxApiCalls: 100,
      });

      expect(limiter.canUseTokens(500)).toBe(true);
      limiter.recordTokens(600);
      expect(limiter.canUseTokens(500)).toBe(false);
      // isAllowed checks ALL resources, so we need to check just tokens
      expect(limiter.getUsage().tokensUsed).toBe(600);
    });

    it('should estimate tokens for text', () => {
      const limiter = createResourceLimiter('test-estimate');
      const text = 'Hello world';
      const estimate = limiter.estimateTokens(text);
      
      // ~4 chars per token
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThanOrEqual(text.length);
    });
  });

  describe('Guardrail Registry', () => {
    it('should return all registered guardrails', () => {
      const all = registry.getAll();
      expect(all.length).toBeGreaterThan(0);
      
      const catastrophic = registry.getByCategory('catastrophic');
      expect(catastrophic.length).toBeGreaterThan(0);
    });

    it('should track violation counts', async () => {
      const context: ExecutionContext = {
        taskId: 'test-violations',
        step: 1000,
        maxSteps: 10,
        startTime: Date.now(),
        resources: {
          tokensUsed: 0,
          tokensLimit: 1000,
          memoryUsedMB: 0,
          memoryLimitMB: 512,
          timeElapsedMs: 0,
          timeLimitMs: 300000,
          apiCalls: 0,
          apiCallLimit: 50,
        },
        trace: { steps: [] },
      };

      await registry.evaluate(context);
      const stats = registry.getViolationStats();
      
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });

  describe('Shadow Mode', () => {
    it('should not block in shadow mode', async () => {
      const shadowSystem = initializeGuardrailSystem({
        shadowMode: true,
      });
      const shadowRegistry = shadowSystem.registry;

      const context: ExecutionContext = {
        taskId: 'test-shadow',
        step: 1000,
        maxSteps: 10,
        startTime: Date.now(),
        resources: {
          tokensUsed: 0,
          tokensLimit: 1000,
          memoryUsedMB: 0,
          memoryLimitMB: 512,
          timeElapsedMs: 0,
          timeLimitMs: 300000,
          apiCalls: 0,
          apiCallLimit: 50,
        },
        trace: { steps: [] },
      };

      const result = await shadowRegistry.evaluate(context);
      
      // In shadow mode, violations are logged but not blocking
      expect(result.passed).toBe(true);
    });
  });
});
