import { describe, it, expect } from 'vitest';
/**
 * Self-improvement safety limits - TDD tests.
 * (1) When depth exceeds maxDepth, requestImprovement throws without calling LLM.
 * (2) When timeout is exceeded, request is aborted.
 */
import {
  requestImprovement,
  type ImprovementContext,
  type RequestImprovementOptions,
  type ImprovementGenerator
} from '../../src/core/SelfImprovement.js';

function createTrackedGenerator(result: string): { generator: ImprovementGenerator; callCount: () => number } {
  let callCount = 0;
  const generator: ImprovementGenerator = async () => {
    callCount++;
    return result;
  };
  return { generator, callCount: () => callCount };
}

describe('SelfImprovement', () => {
  describe('max depth', () => {
    it('throws when context.depth exceeds maxDepth and does not call generator', async () => {
      const { generator, callCount } = createTrackedGenerator('generated');
      const context: ImprovementContext = { depth: 3 };
      const options: RequestImprovementOptions = { maxDepth: 3 };

      await expect(
        requestImprovement('improve this', context, options, generator)
      ).rejects.toThrow(/max.*depth|depth.*exceeded/i);

      expect(callCount()).toBe(0);
    });

    it('throws when context.depth is greater than maxDepth', async () => {
      const { generator, callCount } = createTrackedGenerator('generated');
      const context: ImprovementContext = { depth: 5 };
      const options: RequestImprovementOptions = { maxDepth: 2 };

      await expect(
        requestImprovement('improve this', context, options, generator)
      ).rejects.toThrow(/max.*depth|depth.*exceeded/i);

      expect(callCount()).toBe(0);
    });

    it('calls generator when depth is below maxDepth', async () => {
      const { generator, callCount } = createTrackedGenerator('ok');
      const context: ImprovementContext = { depth: 0 };
      const options: RequestImprovementOptions = { maxDepth: 3 };

      const result = await requestImprovement('improve this', context, options, generator);

      expect(callCount()).toBe(1);
      expect(result).toBe('ok');
    });

    it('calls generator when depth equals maxDepth - 1', async () => {
      const { generator, callCount } = createTrackedGenerator('ok');
      const context: ImprovementContext = { depth: 2 };
      const options: RequestImprovementOptions = { maxDepth: 3 };

      const result = await requestImprovement('improve this', context, options, generator);

      expect(callCount()).toBe(1);
      expect(result).toBe('ok');
    });
  });

  describe('per-request timeout', () => {
    it('aborts request when timeout is exceeded', async () => {
      let capturedSignal: AbortSignal | undefined;
      const generator: ImprovementGenerator = async (_prompt, signal) => {
        capturedSignal = signal;
        await new Promise<string>((resolve) => setTimeout(() => resolve('done'), 5000));
        return 'done';
      };
      const context: ImprovementContext = { depth: 0 };
      const options: RequestImprovementOptions = { maxDepth: 5, requestTimeoutMs: 50 };

      await expect(
        requestImprovement('improve this', context, options, generator)
      ).rejects.toMatchObject({ name: 'AbortError' });

      expect(capturedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('optional rate limit', () => {
    it('throws when called again within rateLimitMs', async () => {
      const { generator, callCount } = createTrackedGenerator('ok');
      const context: ImprovementContext = { depth: 0, lastRequestTime: Date.now() - 1000 };
      const options: RequestImprovementOptions = { maxDepth: 5, rateLimitMs: 5000 };

      await expect(
        requestImprovement('improve this', context, options, generator)
      ).rejects.toThrow(/rate|limit/i);

      expect(callCount()).toBe(0);
    });

    it('allows request when lastRequestTime is older than rateLimitMs', async () => {
      const { generator, callCount } = createTrackedGenerator('ok');
      const context: ImprovementContext = { depth: 0, lastRequestTime: Date.now() - 6000 };
      const options: RequestImprovementOptions = { maxDepth: 5, rateLimitMs: 5000 };

      const result = await requestImprovement('improve this', context, options, generator);

      expect(callCount()).toBe(1);
      expect(result).toBe('ok');
    });
  });
});
