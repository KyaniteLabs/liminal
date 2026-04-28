import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: '<div data-composition-id="test"><h1 class="clip" data-start="0" data-duration="5">Hello</h1></div>',
    iterations: 1,
    toolCallsMade: 0,
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockToolLoop;
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

vi.mock('../../../src/harness/tools/generator-tools.js', () => ({
  GENERATOR_TOOLS: [],
  createGeneratorToolExecutor: vi.fn().mockReturnValue(async () => 'ok'),
}));

vi.mock('../../../src/core/validators/HyperFramesValidator.js', () => ({
  HyperFramesValidator: {
    validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  },
}));

import { HyperFramesGenerator } from '../../../src/generators/hyperframes/HyperFramesGenerator.js';
import { RevideoGenerator } from '../../../src/generators/revideo/RevideoGenerator.js';

describe('HyperFramesGenerator', () => {
  let gen: HyperFramesGenerator;

  beforeEach(() => {
    mockToolLoop.mockClear();
    gen = new HyperFramesGenerator();
  });

  describe('canHandle routing', () => {
    it('returns 0.95 for explicit hyperframes keyword', () => {
      expect(gen.canHandle('hyperframes')).toBe(0.95);
    });

    it('returns 0.90 for promo prompts', () => {
      expect(gen.canHandle('make a promo video')).toBe(0.90);
    });

    it('returns 0.90 for slideshow prompts', () => {
      expect(gen.canHandle('slideshow with music')).toBe(0.90);
    });

    it('returns 0.90 for trailer prompts', () => {
      expect(gen.canHandle('create a trailer')).toBe(0.90);
    });

    it('returns 0.90 for title card prompts', () => {
      expect(gen.canHandle('title card overlay')).toBe(0.90);
    });

    it('returns 0.85 for watermark prompts', () => {
      expect(gen.canHandle('watermark on video')).toBe(0.85);
    });

    it('returns 0.80 for video with images and clips', () => {
      expect(gen.canHandle('video with images and clips')).toBe(0.80);
    });

    it('returns 0.80 for video with audio narration', () => {
      expect(gen.canHandle('video with audio narration')).toBe(0.80);
    });

    it('returns 0 when hyperframes is forbidden (do not)', () => {
      expect(gen.canHandle('do not use hyperframes')).toBe(0);
    });

    it('returns 0 when hyperframes is forbidden (never)', () => {
      expect(gen.canHandle('never use hyperframes')).toBe(0);
    });

    it('returns 0 for particle system prompts (Revideo territory)', () => {
      expect(gen.canHandle('particle system animation')).toBe(0);
    });

    it('returns 0 for generative motion graphics prompts (Revideo territory)', () => {
      expect(gen.canHandle('generative motion graphics')).toBe(0);
    });

    it('returns 0 for p5.js prompts', () => {
      expect(gen.canHandle('p5.js sketch')).toBe(0);
    });

    it('returns 0 for unrelated prompts', () => {
      expect(gen.canHandle('just some random text')).toBe(0);
    });
  });

  describe('wrapForGallery', () => {
    it('returns original code when viewport meta already present', () => {
      const code = '<html><head><meta name="viewport" content="width=device-width"></head><body>Hello</body></html>';
      const result = gen.wrapForGallery(code);
      expect(result).toBe(code);
    });

    it('injects viewport meta into existing head tag', () => {
      const code = '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>';
      const result = gen.wrapForGallery(code);
      expect(result).toContain('meta name="viewport"');
      expect(result).toContain('<title>Test</title>');
      expect(result).not.toContain('<!DOCTYPE html>');
    });

    it('wraps bare code in full HTML document when no head tag exists', () => {
      const code = '<div data-composition-id="demo"><h1 class="clip" data-start="0">Hello</h1></div>';
      const result = gen.wrapForGallery(code);
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('meta name="viewport"');
      expect(result).toContain(code);
    });

    it('preserves original code content in all wrapping paths', () => {
      const gsapCode = '<div id="stage" data-composition-id="x"><p class="clip">Text</p></div>';
      const result = gen.wrapForGallery(gsapCode);
      expect(result).toContain(gsapCode);
    });
  });

  describe('no overlap with Revideo', () => {
    it('no prompt scores > 0.5 for both HyperFrames and Revideo simultaneously', () => {
      const revideo = new RevideoGenerator();
      const prompts = [
        { prompt: 'hyperframes slideshow', owner: 'hf' },
        { prompt: 'particle system animation', owner: 'rv' },
        { prompt: 'create a revideo scene', owner: 'rv' },
        { prompt: 'watermark overlay on image', owner: 'hf' },
        { prompt: 'generative motion graphics in revideo', owner: 'rv' },
        { prompt: 'p5.js interactive sketch', owner: 'neither' },
        { prompt: 'remotion composition with React', owner: 'rv' },
        { prompt: 'social media clip with captions', owner: 'hf' },
        { prompt: 'presentation with subtitle tracks', owner: 'hf' },
        { prompt: 'do not use hyperframes', owner: 'neither' },
        { prompt: 'make a promo trailer', owner: 'hf' },
        { prompt: 'do not use revideo', owner: 'neither' },
      ];

      for (const { prompt } of prompts) {
        const hfScore = gen.canHandle(prompt);
        const rvScore = revideo.canHandle(prompt);
        const bothAbove = hfScore > 0.5 && rvScore > 0.5;
        expect(bothAbove).toBe(false);
      }
    });
  });
});
