import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsConfigured, mockImproveP5Sketch } = vi.hoisted(() => ({
  mockIsConfigured: vi.fn().mockReturnValue(false),
  mockImproveP5Sketch: vi.fn(),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  const MockLLMClient = vi.fn().mockImplementation(() => ({
    improveP5Sketch: mockImproveP5Sketch,
  }));
  MockLLMClient.isConfigured = mockIsConfigured;
  return { LLMClient: MockLLMClient };
});

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    apiKey: 'test',
  }),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { requestImprovement } from '../../../src/improvement/requestImprovement.js';

describe('requestImprovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConfigured.mockReturnValue(false);
  });

  describe('templateFallback (via unconfigured LLM path)', () => {
    // Pass state.llm to skip constructor; keep isConfigured=false for fallback
    const mockLlm = { improveP5Sketch: mockImproveP5Sketch } as any;

    it('returns full template when code has no setup/createCanvas', async () => {
      const result = await requestImprovement('just some text', { llm: mockLlm });
      expect(result.improved).toBe(false);
      expect(result.error).toBe('LLM not configured');
      expect(result.code).toContain('function setup()');
      expect(result.code).toContain('createCanvas(800, 600)');
      expect(result.code).toContain('function draw()');
    });

    it('returns code as-is when it has setup, createCanvas, and draw', async () => {
      const existing = 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(0); }';
      const result = await requestImprovement(existing, { llm: mockLlm });
      expect(result.code).toBe(existing);
    });

    it('appends draw() when code has setup+createCanvas but no draw', async () => {
      const existing = 'function setup() {\n  createCanvas(400, 400);\n}';
      const result = await requestImprovement(existing, { llm: mockLlm });
      expect(result.code).toContain('function draw()');
      expect(result.code).toContain('ellipse');
    });

    it('returns full template for empty code', async () => {
      const result = await requestImprovement('', { llm: mockLlm });
      expect(result.code).toContain('createCanvas(800, 600)');
    });

    it('returns full template for whitespace-only code', async () => {
      const result = await requestImprovement('   \n  ', { llm: mockLlm });
      expect(result.code).toContain('function setup()');
    });
  });

  describe('LLM path', () => {
    it('returns improved code on success', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockImproveP5Sketch.mockResolvedValue({
        success: true,
        code: 'function setup() { createCanvas(100,100); }',
      });

      const result = await requestImprovement('old code', {
        llm: { improveP5Sketch: mockImproveP5Sketch } as any,
      });

      expect(result.improved).toBe(true);
      expect(result.code).toContain('createCanvas');
    });

    it('falls back to template when LLM returns empty code', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockImproveP5Sketch.mockResolvedValue({
        success: true,
        code: '   ',
      });

      const result = await requestImprovement('old code', {
        llm: { improveP5Sketch: mockImproveP5Sketch } as any,
      });

      expect(result.improved).toBe(false);
      expect(result.error).toContain('empty code');
    });

    it('falls back when LLM returns success=false', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockImproveP5Sketch.mockResolvedValue({
        success: false,
        error: 'model overloaded',
      });

      const result = await requestImprovement('code', {
        llm: { improveP5Sketch: mockImproveP5Sketch } as any,
      });

      expect(result.improved).toBe(false);
      expect(result.error).toContain('model overloaded');
    });

    it('falls back on LLM exception', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockImproveP5Sketch.mockRejectedValue(new Error('connection refused'));

      const result = await requestImprovement('code', {
        llm: { improveP5Sketch: mockImproveP5Sketch } as any,
      });

      expect(result.improved).toBe(false);
      expect(result.error).toBe('connection refused');
      expect(result.code).toContain('function setup()');
    });

    it('handles non-Error exceptions', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockImproveP5Sketch.mockRejectedValue('string error');

      const result = await requestImprovement('code', {
        llm: { improveP5Sketch: mockImproveP5Sketch } as any,
      });

      expect(result.improved).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});
