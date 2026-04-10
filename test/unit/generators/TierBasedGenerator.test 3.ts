import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockGetConfig } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 'const x = 1;',
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
    getConfig = mockGetConfig;
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({ baseUrl: '', model: '', apiKey: '' }),
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: class {
    build = vi.fn().mockReturnValue({ system: 'sys', user: 'usr', combined: 'combined' });
    static loadContext = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    recordEpisode: vi.fn(),
    getSuccessfulAdaptations: vi.fn().mockReturnValue([]),
    getRecentEpisodes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../../../src/generators/TierBasedGenerator.js';

// Concrete implementation for testing
class TestGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('test', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const response = await this.generateInternal(prompt, options);
    return response.code;
  }

  // Expose protected methods for testing
  public testValidateOutput(code: string): { valid: boolean; error?: string } {
    return this.validateOutput(code);
  }

  public testGetDefaultBudget(): number {
    return (this as any).getDefaultBudget();
  }

  public testGetRecentAdaptations(): string[] {
    return (this as any).getRecentAdaptations();
  }

  public testGetUserPreferences(): string {
    return (this as any).getUserPreferences();
  }
}

describe('TierBasedGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  describe('getTierInfo', () => {
    it('returns tier, budget, and domain info', () => {
      const gen = new TestGenerator();
      const info = gen.getTierInfo();

      expect(info).toHaveProperty('tier');
      expect(info).toHaveProperty('budget');
      expect(info).toHaveProperty('domain');
      expect(info.domain).toBe('test');
      expect(typeof info.budget).toBe('number');
    });
  });

  describe('getDefaultBudget', () => {
    it('returns 8000 for flagship tier', () => {
      mockGetConfig.mockReturnValue({ model: 'gpt-4o', baseUrl: 'http://localhost:1234/v1' });
      const gen = new TestGenerator();
      const budget = gen.testGetDefaultBudget();
      expect(budget).toBe(8000);
    });

    it('returns 4000 for medium tier', () => {
      mockGetConfig.mockReturnValue({ model: 'claude-3-haiku', baseUrl: 'http://localhost:1234/v1' });
      const gen = new TestGenerator();
      const budget = gen.testGetDefaultBudget();
      expect(budget).toBe(4000);
    });

    it('returns 2000 for local tier', () => {
      mockGetConfig.mockReturnValue({ model: 'qwen2.5-7b', baseUrl: 'http://localhost:1234/v1' });
      const gen = new TestGenerator();
      const budget = gen.testGetDefaultBudget();
      expect(budget).toBe(2000);
    });

    it('returns 1000 for tiny tier', () => {
      mockGetConfig.mockReturnValue({ model: 'qwen2.5-0.5b', baseUrl: 'http://localhost:1234/v1' });
      const gen = new TestGenerator();
      const budget = gen.testGetDefaultBudget();
      expect(budget).toBe(1000);
    });
  });

  describe('validateOutput', () => {
    it('base implementation returns valid=true', () => {
      const gen = new TestGenerator();
      const result = gen.testValidateOutput('any code');
      expect(result.valid).toBe(true);
    });
  });

  describe('wrapForGallery', () => {
    it('returns code unchanged in base class', () => {
      const gen = new TestGenerator();
      const code = 'test code';
      const wrapped = gen.wrapForGallery(code);
      expect(wrapped).toBe(code);
    });
  });
});
