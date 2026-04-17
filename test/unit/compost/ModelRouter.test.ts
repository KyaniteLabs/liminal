/**
 * ModelRouter unit tests — verify routing modes and escalation behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter, type Task, type ModelResponse } from '../../../src/compost/ModelRouter.js';

/** Mock LLM client for testing */
class MockLLMClient {
  constructor(
    private responses: { success: boolean; code: string; delay?: number }[] = [],
    private callCount: { count: number } = { count: 0 }
  ) {}

  async generate(systemPrompt: string, userPrompt: string): Promise<{ success: boolean; code: string }> {
    this.callCount.count++;
    const response = this.responses[this.callCount.count - 1] || this.responses[0];
    if (response?.delay) {
      await new Promise(resolve => setTimeout(resolve, response.delay));
    }
    return {
      success: response?.success ?? true,
      code: response?.code ?? `Mock response to: ${userPrompt.slice(0, 30)}...`,
    };
  }

  reset() {
    this.callCount.count = 0;
  }

  getCallCount() {
    return this.callCount.count;
  }
}

describe('ModelRouter', () => {
  let primaryLLM: MockLLMClient;
  let secondaryLLM: MockLLMClient;

  beforeEach(() => {
    primaryLLM = new MockLLMClient();
    secondaryLLM = new MockLLMClient();
  });

  describe('cascade routing mode', () => {
    it('uses primary model when response is successful', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Secondary response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System prompt', 'User prompt');

      expect(response.success).toBe(true);
      expect(response.code).toBe('Primary response');
      expect(response.model).toBe('primary');
      expect(primaryLLM.getCallCount()).toBe(1);
      expect(secondaryLLM.getCallCount()).toBe(0);
    });

    it('escalates to secondary model when primary fails', async () => {
      primaryLLM = new MockLLMClient([{ success: false, code: '' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Secondary response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System prompt', 'User prompt');

      expect(response.success).toBe(true);
      expect(response.code).toBe('Secondary response');
      expect(response.model).toBe('secondary');
      expect(primaryLLM.getCallCount()).toBe(1);
      expect(secondaryLLM.getCallCount()).toBe(1);
    });

    it('escalates to secondary for complex tasks', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Secondary response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'general',
        systemPrompt: 'System',
        userPrompt: 'User',
        complexity: 'complex',
      };

      const response = await router.route(task);

      expect(response.model).toBe('secondary');
      expect(secondaryLLM.getCallCount()).toBe(1);
    });

    it('escalates to secondary for high priority tasks', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Secondary response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'general',
        systemPrompt: 'System',
        userPrompt: 'User',
        priority: 'high',
      };

      const response = await router.route(task);

      expect(response.model).toBe('secondary');
      expect(secondaryLLM.getCallCount()).toBe(1);
    });
  });

  describe('specialized routing mode', () => {
    it('routes collision tasks to secondary model', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Fast response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Powerful response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'specialized', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'collision',
        systemPrompt: 'System',
        userPrompt: 'Detect collision',
      };

      const response = await router.route(task);

      expect(response.model).toBe('secondary');
      expect(secondaryLLM.getCallCount()).toBe(1);
      expect(primaryLLM.getCallCount()).toBe(0);
    });

    it('routes soup tasks to secondary model', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Fast response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Powerful response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'specialized', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'soup',
        systemPrompt: 'System',
        userPrompt: 'Generate soup',
      };

      const response = await router.route(task);

      expect(response.model).toBe('secondary');
      expect(secondaryLLM.getCallCount()).toBe(1);
    });

    it('routes extraction tasks to primary model', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Fast response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Powerful response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'specialized', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'extraction',
        systemPrompt: 'System',
        userPrompt: 'Extract semantics',
      };

      const response = await router.route(task);

      expect(response.model).toBe('primary');
      expect(primaryLLM.getCallCount()).toBe(1);
      expect(secondaryLLM.getCallCount()).toBe(0);
    });

    it('routes scoring tasks to primary model', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Fast response' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Powerful response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'specialized', confidenceThreshold: 0.8 },
      });

      const task: Task = {
        type: 'scoring',
        systemPrompt: 'System',
        userPrompt: 'Score fragment',
      };

      const response = await router.route(task);

      expect(response.model).toBe('primary');
      expect(primaryLLM.getCallCount()).toBe(1);
      expect(secondaryLLM.getCallCount()).toBe(0);
    });
  });

  describe('ensemble routing mode', () => {
    it('runs both models in parallel', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary response', delay: 10 }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Secondary response', delay: 10 }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'ensemble', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System', 'User');

      // Both models should be called
      expect(primaryLLM.getCallCount()).toBe(1);
      expect(secondaryLLM.getCallCount()).toBe(1);

      expect(response.model).toBe('ensemble');
      expect(response.code).toBeTruthy();
    });

    it('uses secondary result when agreement is low', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Completely different response from primary' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Totally unrelated secondary output' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'ensemble', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System', 'User');

      expect(response.model).toBe('ensemble');
      expect(response.code).toBe('Totally unrelated secondary output');
    });
  });

  describe('fallback behavior', () => {
    it('falls back to cascade when mode is unknown', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary response' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'unknown' as any, confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System', 'User');

      expect(response.success).toBe(true);
      expect(response.model).toBe('primary');
    });

    it('works with only primary model (no secondary)', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Primary only' }]);

      const router = new ModelRouter(primaryLLM, undefined, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System', 'User');

      expect(response.success).toBe(true);
      expect(response.code).toBe('Primary only');
      expect(response.model).toBe('primary');
    });

    it('handles errors from primary model gracefully', async () => {
      primaryLLM = new MockLLMClient([{ success: false, code: '' }]);
      secondaryLLM = new MockLLMClient([{ success: true, code: 'Fallback' }]);

      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const response = await router.generate('System', 'User');

      expect(response.success).toBe(true);
      expect(response.model).toBe('secondary');
      expect(response.code).toBe('Fallback');
    });
  });

  describe('LLMClientLike interface compliance', () => {
    it('implements the generate method with correct signature', async () => {
      primaryLLM = new MockLLMClient([{ success: true, code: 'Response' }]);

      const router = new ModelRouter(primaryLLM, undefined, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      // Should accept the same parameters as LLMClientLike
      const response = await router.generate('System prompt', 'User prompt');
      expect(response.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns routing statistics', () => {
      const router = new ModelRouter(primaryLLM, secondaryLLM, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        secondary: { provider: 'ollama', model: 'powerful', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.85 },
      });

      const stats = router.getStats();

      expect(stats.mode).toBe('cascade');
      expect(stats.confidenceThreshold).toBe(0.85);
      expect(stats.hasSecondary).toBe(true);
    });

    it('reports no secondary when not provided', () => {
      const router = new ModelRouter(primaryLLM, undefined, {
        primary: { provider: 'ollama', model: 'fast', temperature: 0.7, maxTokens: 2000 },
        routing: { mode: 'cascade', confidenceThreshold: 0.8 },
      });

      const stats = router.getStats();

      expect(stats.hasSecondary).toBe(false);
    });
  });
});
