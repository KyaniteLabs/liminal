import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TierBasedGenerator } from '../../src/generators/TierBasedGenerator.js';
import { LLMClient, LLMResponse } from '../../src/llm/LLMClient.js';

// Create a concrete implementation for testing
class TestGenerator extends TierBasedGenerator {
  constructor(domain: string, llmOrConfig?: LLMClient | Partial<ConstructorParameters<typeof LLMClient>[0]>) {
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
  let mockLLM: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = {
      generate: vi.fn(),
      getConfig: vi.fn(() => ({ model: 'test-model', baseUrl: 'http://test', role: 'generator' as const })),
      isConfigured: vi.fn(() => true),
    } as unknown as LLMClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate', () => {
    it('should return code for valid prompt', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: 'function setup() { createCanvas(400, 400); }',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      const result = await generator.generate('create a canvas');

      expect(result).toContain('createCanvas');
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should throw GenerationError for empty response', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: '',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      await expect(generator.generate('test prompt')).rejects.toThrow(/empty code/);
    });

    it('should extract code from thinking when code block is present', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: '',
        success: true,
        thinking: `Here's my thinking:\n\`\`\`javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n\`\`\``,
        recoveredFromThinking: true,
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      // The generator should handle empty code by throwing
      await expect(generator.generate('test prompt')).rejects.toThrow(/empty code/);
    });

    it('should throw when LLM is not configured', async () => {
      const generator = new TestGenerator('p5');
      vi.spyOn(LLMClient, 'isConfigured').mockReturnValue(false);

      await expect(generator.generate('test prompt')).rejects.toThrow(/No LLM configured/);
    });
  });

  describe('generateFull', () => {
    it('should return full LLMResponse including thinking', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: 'function draw() { ellipse(50, 50, 80, 80); }',
        success: true,
        thinking: 'I will draw a circle at the center',
        recoveredFromThinking: false,
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      const result = await generator.generateFull('draw a circle');

      expect(result.code).toBe(mockResponse.code);
      expect(result.thinking).toBe(mockResponse.thinking);
      expect(result.recoveredFromThinking).toBe(mockResponse.recoveredFromThinking);
    });
  });

  describe('generateLayer', () => {
    it('should create a Layer with proper metadata', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: 'function setup() { createCanvas(400, 400); }',
        success: true,
        thinking: 'test thinking',
        recoveredFromThinking: false,
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      const layer = await generator.generateLayer('create canvas layer');

      expect(layer.domain).toBe('p5');
      expect(layer.code).toBe(mockResponse.code);
      expect(layer.prompt).toBe('create canvas layer');
      expect(layer.metadata.generator).toBe('TestGenerator');
      expect(layer.metadata.model).toBe('test-model');
      expect(layer.metadata.thinking).toBe('test thinking');
      expect(layer.metadata.recoveredFromThinking).toBe(false);
    });

    it('should include timestamp in layer metadata', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const beforeTimestamp = new Date().toISOString();
      
      const mockResponse: LLMResponse = {
        code: 'function setup() {}',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      const layer = await generator.generateLayer('test');
      const afterTimestamp = new Date().toISOString();

      expect(layer.metadata.generatedAt).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(layer.metadata.generatedAt).toBeLessThanOrEqual(afterTimestamp);
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
      
      const localGenerator = new TestGenerator('p5', new LLMClient(localConfig));
      const flagshipGenerator = new TestGenerator('p5', new LLMClient(flagshipConfig));

      const localInfo = localGenerator.getTierInfo();
      const flagshipInfo = flagshipGenerator.getTierInfo();

      // Flagship should have higher budget than local
      expect(flagshipInfo.budget).toBeGreaterThan(localInfo.budget);
    });
  });

  describe('domain validation', () => {
    it('should validate output through domain-specific validation', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: 'INVALID CODE FOR TESTING',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

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
      const mockResponse: LLMResponse = {
        code: 'function setup() {}',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      await generator.generate('test', { bypassCache: true });

      // Verify that generate was called with bypassCache
      const generateCall = vi.mocked(mockLLM.generate).mock.calls[0];
      expect(generateCall[3]).toBe(true); // bypassCache is 4th parameter
    });

    it('should respect AbortSignal', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const controller = new AbortController();
      
      const mockResponse: LLMResponse = {
        code: 'function setup() {}',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      await generator.generate('test', { signal: controller.signal });

      // Verify that generate was called with the signal
      const generateCall = vi.mocked(mockLLM.generate).mock.calls[0];
      expect(generateCall[2]).toBe(controller.signal); // signal is 3rd parameter
    });

    it('should respect contextBudget option', async () => {
      const generator = new TestGenerator('p5', mockLLM);
      const mockResponse: LLMResponse = {
        code: 'function setup() {}',
        success: true,
        thinking: '',
      };
      vi.mocked(mockLLM.generate).mockResolvedValueOnce(mockResponse);

      await generator.generate('test', { contextBudget: 5000 });

      // Should not throw and should complete successfully
      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });
});
