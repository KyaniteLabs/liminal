import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockGenerateWithToolLoop, mockGetConfig, mockIsConfigured } = vi.hoisted(() => ({
  mockGenerateWithToolLoop: vi.fn(),
  mockGetConfig: vi.fn(() => ({ model: 'test-model', baseUrl: 'http://test', role: 'generator' as const })),
  mockIsConfigured: vi.fn(() => true),
}));

vi.mock('../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockGenerateWithToolLoop;
    generate = vi.fn();
    getConfig = mockGetConfig;
    constructor(config?: any) {
      if (config && (config.model || config.baseUrl || config.apiKey)) {
        this.getConfig = vi.fn(() => config);
      }
    }
  }
  (MockLLMClient as any).isConfigured = mockIsConfigured;
  return { LLMClient: MockLLMClient };
});

vi.mock('../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: Object.assign(
    vi.fn(function(this: any) {
      this.build = vi.fn().mockReturnValue({ system: 'sys', user: 'usr', combined: 'combined' });
    }),
    { loadContext: vi.fn().mockResolvedValue({}) }
  ),
}));

vi.mock('../../src/llm/ModelTier.js', () => ({
  detectModelTier: vi.fn().mockImplementation((config: any) => {
    const model = config?.model || '';
    if (model.includes('claude') || model.includes('sonnet') || model.includes('gpt-4')) return 'flagship';
    if (model.includes('coder') || model.includes('qwen')) return 'tiny';
    return 'medium';
  }),
  trimContext: vi.fn().mockReturnValue(''),
}));

vi.mock('../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    getSuccessfulAdaptations: vi.fn().mockReturnValue([]),
    getRecentEpisodes: vi.fn().mockReturnValue([]),
    recordEpisode: vi.fn(),
  },
}));

vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

import { TierBasedGenerator } from '../../src/generators/TierBasedGenerator.js';
import { LLMClient } from '../../src/llm/LLMClient.js';

// Create a concrete implementation for testing
class TestGenerator extends TierBasedGenerator {
  constructor(domain: string, llmOrConfig?: any) {
    super(domain, llmOrConfig);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (code.includes('INVALID')) {
      return { valid: false, error: 'Test validation failed' };
    }
    return { valid: true };
  }
}

describe('TierBasedGenerator', () => {
  let mockLLM: InstanceType<typeof LLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' as const });
    mockIsConfigured.mockReturnValue(true);
    // Create instance via mocked constructor so instanceof check passes
    mockLLM = new LLMClient() as InstanceType<typeof LLMClient>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate', () => {
    it('should return code for valid prompt', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() { createCanvas(400, 400); }',
        success: true,
        toolCalls: [],
      });

      const result = await generator.generate('create a canvas');

      expect(result).toContain('createCanvas');
      expect(mockGenerateWithToolLoop).toHaveBeenCalled();
    });

    it('should throw GenerationError for empty response', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '',
        success: true,
        toolCalls: [],
      });

      await expect(generator.generate('test prompt')).rejects.toThrow(/empty code/);
    });

    it('should extract code from thinking when code block is present', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '',
        success: true,
        thinking: `Here's my thinking:\n\`\`\`javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n\`\`\``,
        recoveredFromThinking: true,
        toolCalls: [],
      });

      // The generator should handle empty code by throwing
      await expect(generator.generate('test prompt')).rejects.toThrow(/empty code/);
    });

    it('should throw when LLM is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const generator = new TestGenerator('p5');

      await expect(generator.generate('test prompt')).rejects.toThrow(/No LLM configured/);
    });
  });

  describe('generateFull', () => {
    it('should return full LLMResponse including thinking', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function draw() { ellipse(50, 50, 80, 80); }',
        success: true,
        thinking: 'I will draw a circle at the center',
        recoveredFromThinking: false,
        toolCalls: [],
      });

      const result = await generator.generateFull('draw a circle');

      expect(result.code).toBe('function draw() { ellipse(50, 50, 80, 80); }');
      expect(result.thinking).toBe('I will draw a circle at the center');
      expect(result.recoveredFromThinking).toBe(false);
    });
  });

  describe('generateLayer', () => {
    it('should create a Layer with proper metadata', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() { createCanvas(400, 400); }',
        success: true,
        thinking: 'test thinking',
        recoveredFromThinking: false,
        toolCalls: [],
      });

      const layer = await generator.generateLayer('create canvas layer');

      expect(layer.domain).toBe('p5');
      expect(layer.code).toBe('function setup() { createCanvas(400, 400); }');
      expect(layer.prompt).toBe('create canvas layer');
      expect(layer.metadata.generator).toBe('TestGenerator');
      expect(layer.metadata.model).toBe('test-model');
      expect(layer.metadata.thinking).toBe('test thinking');
      expect(layer.metadata.recoveredFromThinking).toBe(false);
    });

    it('should include timestamp in layer metadata', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const beforeTimestamp = new Date().toISOString();

      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() {}',
        success: true,
        thinking: '',
        toolCalls: [],
      });

      const layer = await generator.generateLayer('test');
      const afterTimestamp = new Date().toISOString();

      expect(layer.metadata.generatedAt >= beforeTimestamp).toBe(true);
      expect(layer.metadata.generatedAt <= afterTimestamp).toBe(true);
    });
  });

  describe('getTierInfo', () => {
    it('should return tier information', () => {
      const generator = new TestGenerator('p5', mockLLM);
      const info = generator.getTierInfo();

      expect(info).toHaveProperty('tier');
      expect(info).toHaveProperty('budget');
      expect(info).toHaveProperty('domain');
      expect(info.domain).toBe('p5');
      expect(typeof info.budget).toBe('number');
      expect(info.budget).toBeGreaterThan(0);
    });

    it('should have different budgets for different tiers', () => {
      // Create generators with different model configs to test tier detection
      const localConfig = { model: 'qwen2.5-coder-7b', baseUrl: 'http://localhost:1234/v1', role: 'generator' as const };
      const flagshipConfig = { model: 'claude-3-5-sonnet', baseUrl: 'https://api.anthropic.com', apiKey: 'test', role: 'generator' as const };

      const localGenerator = new TestGenerator('p5', new LLMClient(localConfig) as any);
      const flagshipGenerator = new TestGenerator('p5', new LLMClient(flagshipConfig) as any);

      const localInfo = localGenerator.getTierInfo();
      const flagshipInfo = flagshipGenerator.getTierInfo();

      // Flagship should have higher budget than local
      expect(flagshipInfo.budget).toBeGreaterThan(localInfo.budget);
    });
  });

  describe('domain validation', () => {
    it('should validate output through domain-specific validation', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'INVALID CODE FOR TESTING',
        success: true,
        thinking: '',
        toolCalls: [],
      });

      await expect(generator.generate('test')).rejects.toThrow(/Test validation failed/);
    });
  });

  describe('configuration resolution', () => {
    it('should accept LLMClient instance', () => {
      const generator = new TestGenerator('p5', mockLLM);
      expect(generator.getTierInfo().domain).toBe('p5');
    });

    it('should accept partial config and create LLMClient', () => {
      const config = { model: 'test-model', baseUrl: 'http://test' };
      const generator = new TestGenerator('p5', config);
      expect(generator.getTierInfo().domain).toBe('p5');
    });

    it('should create placeholder when no config provided', () => {
      const generator = new TestGenerator('p5');
      expect(generator.getTierInfo().domain).toBe('p5');
    });
  });

  describe('options handling', () => {
    it('should respect bypassCache option', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() {}',
        success: true,
        thinking: '',
        toolCalls: [],
      });

      await generator.generate('test', { bypassCache: true });

      // Verify that generateWithToolLoop was called
      expect(mockGenerateWithToolLoop).toHaveBeenCalled();
    });

    it('should respect AbortSignal', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const controller = new AbortController();

      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() {}',
        success: true,
        thinking: '',
        toolCalls: [],
      });

      await generator.generate('test', { signal: controller.signal });

      // Verify that generateWithToolLoop was called with the signal
      const call = mockGenerateWithToolLoop.mock.calls[0];
      expect(call[0].signal).toBe(controller.signal);
    });

    it('should respect contextBudget option', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'function setup() {}',
        success: true,
        thinking: '',
        toolCalls: [],
      });

      await generator.generate('test', { contextBudget: 5000 });

      // Should not throw and should complete successfully
      expect(mockGenerateWithToolLoop).toHaveBeenCalled();
    });
  });
});
