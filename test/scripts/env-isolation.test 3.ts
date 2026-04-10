import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMClient } from '../../src/llm/LLMClient.js';

describe('Cross-Domain Environment Isolation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear caches before each test
    LLMClient.clearGlobalCache();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('should isolate LLM config between model runs via clearGlobalCache', () => {
    // Simulate model 1 configuration
    process.env.LIMINAL_LLM_MODEL = 'model-a';
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';

    // Create client 1 - should pick up model-a
    const client1 = new LLMClient();
    const config1 = client1.getConfig();

    expect(config1.model).toBe('model-a');
    expect(config1.baseUrl).toBe('http://localhost:11434/v1');

    // Clear global cache (simulating what runSingleTest does)
    LLMClient.clearGlobalCache();

    // Simulate switching to model 2
    process.env.LIMINAL_LLM_MODEL = 'model-b';
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';

    // Create client 2 - should pick up model-b (not cached model-a)
    const client2 = new LLMClient();
    const config2 = client2.getConfig();

    expect(config2.model).toBe('model-b');
    expect(config2.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('should clear static role config caches', () => {
    // This test verifies that clearGlobalCache resets static caches
    // The implementation detail is verified by the previous test
    // This just ensures the method exists and doesn't throw
    expect(() => LLMClient.clearGlobalCache()).not.toThrow();
  });
});
