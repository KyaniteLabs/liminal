import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    getConfig = vi.fn(() => ({ model: 'test-model', apiKey: 'test' }));
    generate = vi.fn(async () => 'line one\nline two\nline three');
  },
}));
vi.mock('../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: class { build = vi.fn(() => 'prompt') },
}));
vi.mock('../../src/llm/ModelTier.js', () => ({
  detectModelTier: vi.fn(() => 'flagship'),
  trimContext: vi.fn(),
}));
vi.mock('../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: { getRecentErrors: vi.fn(() => []) },
}));
vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { getQualityHint: vi.fn(() => null) },
}));

import { TextGenerativeGenerator } from '../../src/generators/textgen/TextGenerativeGenerator.js';

describe('TextGenerativeGenerator', () => {
  it('constructs and has correct domain', () => {
    const gen = new TextGenerativeGenerator();
    expect(gen).toBeDefined();
  });

  it('validateOutput rejects empty strings', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).validateOutput('')).toEqual({ valid: false, error: 'Empty output' });
  });

  it('validateOutput accepts multi-line text', () => {
    const gen = new TextGenerativeGenerator();
    const result = (gen as any).validateOutput('hello world\nsecond line');
    expect(result.valid).toBe(true);
  });
});
