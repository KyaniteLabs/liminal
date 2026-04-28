import { describe, it, expect } from 'vitest';
/**
 * Tests for Compost Mill default configuration.
 */

import { DEFAULT_CONFIG, mergeConfig } from '../../src/compost/defaults.js';

describe('DEFAULT_CONFIG', () => {
  it('has all required fields', () => {
    expect(DEFAULT_CONFIG.heapDir).not.toBeNull();
    expect(DEFAULT_CONFIG.maxHeapSizeBytes).not.toBeNull();
    expect(DEFAULT_CONFIG.digestDir).not.toBeNull();
    expect(DEFAULT_CONFIG.seedDir).not.toBeNull();
    expect(DEFAULT_CONFIG.digestSchedule).not.toBeNull();
    expect(DEFAULT_CONFIG.digestDayOfWeek).not.toBeNull();
    expect(DEFAULT_CONFIG.soupEnabled).not.toBeNull();
    expect(DEFAULT_CONFIG.soupPopulationSize).not.toBeNull();
    expect(DEFAULT_CONFIG.soupMaxStepsPerCycle).not.toBeNull();
    expect(DEFAULT_CONFIG.soupSeedPromotionThreshold).not.toBeNull();
    expect(DEFAULT_CONFIG.soupCycleIntervalMs).not.toBeNull();
    expect(DEFAULT_CONFIG.llm).not.toBeNull();
    expect(DEFAULT_CONFIG.seedPromotionThreshold).not.toBeNull();
    expect(DEFAULT_CONFIG.maxSeedsPerDigest).not.toBeNull();
    expect(DEFAULT_CONFIG.nuggetRetentionDays).not.toBeNull();
  });

  it('has correct default values', () => {
    expect(DEFAULT_CONFIG.heapDir).toBe('compost/heap/');
    expect(DEFAULT_CONFIG.maxHeapSizeBytes).toBe(50 * 1024 * 1024);
    expect(DEFAULT_CONFIG.digestSchedule).toBe('weekly');
    expect(DEFAULT_CONFIG.digestDayOfWeek).toBe(0);
    expect(DEFAULT_CONFIG.soupEnabled).toBe(true);
    expect(DEFAULT_CONFIG.soupPopulationSize).toBe(20);
    expect(DEFAULT_CONFIG.soupSeedPromotionThreshold).toBe(0.7);
    expect(DEFAULT_CONFIG.soupCycleIntervalMs).toBe(60000);
    expect(DEFAULT_CONFIG.seedPromotionThreshold).toBe(0.4);
    expect(DEFAULT_CONFIG.maxSeedsPerDigest).toBe(20);
    expect(DEFAULT_CONFIG.nuggetRetentionDays).toBe(90);
  });

  it('has correct LLM defaults', () => {
    // New model-agnostic defaults
    expect(DEFAULT_CONFIG.llm.baseUrl).toBe('http://localhost:1234/v1');
    expect(DEFAULT_CONFIG.llm.model).toBe('auto');
    expect(DEFAULT_CONFIG.llm.timeoutMs).toBe(30000);
    // Deprecated fields retained for backward compatibility
    expect(DEFAULT_CONFIG.llm.provider).toBe('auto');
    expect(DEFAULT_CONFIG.llm.localBaseUrl).toBe('http://localhost:1234/v1');
    expect(DEFAULT_CONFIG.llm.localModel).toBe('auto');
    expect(DEFAULT_CONFIG.llm.cloudApiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
    expect(DEFAULT_CONFIG.llm.cloudModel).toBe('claude-sonnet-4-20250514');
    expect(DEFAULT_CONFIG.llm.localTimeoutMs).toBe(30000);
  });
});

describe('mergeConfig()', () => {
  it('returns defaults when no user config provided', () => {
    const config = mergeConfig();
    expect(config.heapDir).toBe(DEFAULT_CONFIG.heapDir);
  });

  it('deep-merges user config over defaults', () => {
    const config = mergeConfig({
      heapDir: 'custom/heap/',
      maxHeapSizeBytes: 100,
    });
    expect(config.heapDir).toBe('custom/heap/');
    expect(config.maxHeapSizeBytes).toBe(100);
    expect(config.digestDir).toBe(DEFAULT_CONFIG.digestDir); // untouched
  });

  it('deep-merges LLM config', () => {
    const config = mergeConfig({
      llm: {
        provider: 'cloud',
        cloudModel: 'gpt-4o',
      },
    });
    expect(config.llm.provider).toBe('cloud');
    expect(config.llm.cloudModel).toBe('gpt-4o');
    expect(config.llm.localBaseUrl).toBe(DEFAULT_CONFIG.llm.localBaseUrl); // untouched
  });

  it('does not mutate defaults', () => {
    const originalHeapDir = DEFAULT_CONFIG.heapDir;
    const originalProvider = DEFAULT_CONFIG.llm.provider;
    mergeConfig({ heapDir: 'mutated/', llm: { provider: 'cloud' } });
    expect(DEFAULT_CONFIG.heapDir).toBe(originalHeapDir);
    expect(DEFAULT_CONFIG.llm.provider).toBe(originalProvider);
  });

  it('handles undefined gracefully', () => {
    const config = mergeConfig(undefined);
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});
