import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TierBasedGenerator } from '../../src/generators/TierBasedGenerator.js';
import { LLMClient, LLMResponse } from '../../src/llm/LLMClient.js';

class TestGenerator extends TierBasedGenerator {
  constructor(domain: string, llmOrConfig?: LLMClient | Partial<ConstructorParameters<typeof LLMClient>[0]>) {
    super(domain, llmOrConfig);
  }
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (code.includes('INVALID')) return { valid: false, error: 'Test validation failed' };
    return { valid: true };
  }
}

describe('TierBasedGenerator', () => {
  let mockGenerate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(LLMClient, 'isConfigured').mockReturnValue(true);
    mockGenerate = vi.spyOn(LLMClient.prototype, 'generate');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('generate', () => {
    it('should return code for valid prompt', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() { createCanvas(400, 400); }', success: true, thinking: '' });
      const result = await generator.generate('create a canvas');
      expect(result).toContain('createCanvas');
    });

    it('should throw GenerationError for empty response', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: '', success: true, thinking: '' });
      await expect(generator.generate('test prompt')).rejects.toThrow(/empty code/);
    });

    it('should extract code from thinking when code block is present', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: '', success: true, thinking: "Here's my thinking:\n```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n```" });
      const result = await generator.generate('test prompt');
      expect(result).toContain('createCanvas');
    });

    it('should throw when LLM is not configured', async () => {
      vi.spyOn(LLMClient, 'isConfigured').mockReturnValue(false);
      const generator = new TestGenerator('p5');
      await expect(generator.generate('test prompt')).rejects.toThrow(/No LLM configured/);
    });
  });

  describe('generateFull', () => {
    it('should return full LLMResponse including thinking', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'function draw() { ellipse(50, 50, 80, 80); }', success: true, thinking: 'I will draw a circle', recoveredFromThinking: false });
      const result = await generator.generateFull('draw a circle');
      expect(result.thinking).toBe('I will draw a circle');
    });
  });

  describe('generateLayer', () => {
    it('should create a Layer with proper metadata', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() { createCanvas(400, 400); }', success: true, thinking: 'test thinking', recoveredFromThinking: false });
      const layer = await generator.generateLayer('create canvas layer');
      expect(layer.type).toBe('p5');
      expect(layer.metadata.generator).toBe('TestGenerator');
    });

    it('should include timestamp in layer metadata', async () => {
      const generator = new TestGenerator('p5');
      const before = new Date().toISOString();
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() {}', success: true, thinking: '' });
      const layer = await generator.generateLayer('test');
      const after = new Date().toISOString();
      expect(layer.metadata.generatedAt >= before).toBe(true);
      expect(layer.metadata.generatedAt <= after).toBe(true);
    });
  });

  describe('getTierInfo', () => {
    it('should return tier information', () => {
      const generator = new TestGenerator('p5');
      const info = generator.getTierInfo();
      expect(info.domain).toBe('p5');
      expect(info.budget).toBeGreaterThan(0);
    });

    it('should have different budgets for different tiers', () => {
      const localGen = new TestGenerator('p5', new LLMClient({ model: 'qwen2.5-coder-7b', baseUrl: 'http://localhost:1234/v1', role: 'generator' }));
      const flagshipGen = new TestGenerator('p5', new LLMClient({ model: 'claude-3-5-sonnet', baseUrl: 'https://api.anthropic.com', apiKey: 'test', role: 'generator' }));
      expect(flagshipGen.getTierInfo().budget).toBeGreaterThan(localGen.getTierInfo().budget);
    });
  });

  describe('domain validation', () => {
    it('should validate output through domain-specific validation', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'INVALID CODE FOR TESTING', success: true, thinking: '' });
      await expect(generator.generate('test')).rejects.toThrow(/Test validation failed/);
    });
  });

  describe('configuration resolution', () => {
    it('should accept LLMClient instance', () => {
      const generator = new TestGenerator('p5', new LLMClient({ model: 'test', baseUrl: 'http://test', role: 'generator' }));
      expect(generator.getTierInfo().domain).toBe('p5');
    });
    it('should accept partial config', () => {
      const generator = new TestGenerator('p5', { model: 'test-model', baseUrl: 'http://test' });
      expect(generator.getTierInfo().domain).toBe('p5');
    });
    it('should create placeholder when no config provided', () => {
      const generator = new TestGenerator('p5');
      expect(generator.getTierInfo().domain).toBe('p5');
    });
  });

  describe('options handling', () => {
    it('should respect bypassCache option', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() {}', success: true, thinking: '' });
      await generator.generate('test', { bypassCache: true });
      expect(mockGenerate.mock.calls[0][3]).toBe(true);
    });
    it('should respect AbortSignal', async () => {
      const generator = new TestGenerator('p5');
      const controller = new AbortController();
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() {}', success: true, thinking: '' });
      await generator.generate('test', { signal: controller.signal });
      expect(mockGenerate.mock.calls[0][2]).toBe(controller.signal);
    });
    it('should respect contextBudget option', async () => {
      const generator = new TestGenerator('p5');
      mockGenerate.mockResolvedValueOnce({ code: 'function setup() {}', success: true, thinking: '' });
      await generator.generate('test', { contextBudget: 5000 });
      expect(mockGenerate).toHaveBeenCalled();
    });
  });
});
