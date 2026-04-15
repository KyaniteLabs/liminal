import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 'export default makeScene("Test", function* (view) { yield* view.add(<Rect />); });',
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

vi.mock('../../../src/core/validators/RevideoValidator.js', () => ({
  RevideoValidator: {
    validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  },
}));

import { RemotionGenerator } from '../../../src/generators/remotion/RemotionGenerator.js';

describe('RemotionGenerator', () => {
  beforeEach(() => {
    mockToolLoop.mockClear();
  });

  it('constructs with revideo domain', () => {
    const gen = new RemotionGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('revideo');
  });

  it('canHandle returns 0.95 for remotion/revideo prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('make a remotion video')).toBe(0.95);
    expect(gen.canHandle('create a revideo scene')).toBe(0.95);
  });

  it('canHandle returns 0.8 for generic video prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('make a video animation')).toBe(0.8);
    expect(gen.canHandle('title sequence')).toBe(0.8);
    expect(gen.canHandle('motion graphics')).toBe(0.8);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('draw a circle')).toBe(0);
    expect(gen.canHandle('play a sound')).toBe(0);
  });

  it('wrapForGallery produces display-only HTML with escaped code', () => {
    const gen = new RemotionGenerator();
    const wrapped = gen.wrapForGallery('makeScene("A", fn)');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('Revideo Scene');
    expect(wrapped).toContain('makeScene');
  });

  it('wrapForGallery escapes HTML entities', () => {
    const gen = new RemotionGenerator();
    const wrapped = gen.wrapForGallery('<Rect width={100} />');
    expect(wrapped).toContain('&lt;');
    expect(wrapped).toContain('&gt;');
  });
});
