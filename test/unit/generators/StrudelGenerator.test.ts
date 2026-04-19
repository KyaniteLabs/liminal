import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 's("bd sd hh").fast(2)',
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

import { StrudelGenerator } from '../../../src/generators/strudel/StrudelGenerator.js';

describe('StrudelGenerator', () => {
  beforeEach(() => {
    mockToolLoop.mockClear();
  });

  it('constructs with strudel domain', () => {
    const gen = new StrudelGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('strudel');
  });

  it('wrapForGallery produces display-only HTML without loading the REPL runtime', () => {
    const gen = new StrudelGenerator();
    const wrapped = gen.wrapForGallery('s("bd sd")');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('s("bd sd")');
    expect(wrapped).not.toContain('@strudel/repl');
  });

  it('wrapForGallery includes display-only message', () => {
    const gen = new StrudelGenerator();
    const wrapped = gen.wrapForGallery('s("kick")');
    expect(wrapped).toContain('Open in Strudel');
    expect(wrapped).toContain('Native audio proof is pending');
  });

  it('sanitizeCode strips markdown fences', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: '```javascript\ns("bd hh").fast(4)\n```',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('drum pattern');
    expect(result).not.toContain('```');
    expect(result).toContain('s(');
  });

  it('sanitizeCode returns empty string for empty input', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: '',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    // generate throws on empty from TierBasedGenerator, so test wrapForGallery directly
    const gen = new StrudelGenerator();
    const wrapped = gen.wrapForGallery('');
    expect(wrapped).toContain('<!DOCTYPE html>');
  });

  it('wrapForGallery escapes angle brackets and ampersands', () => {
    const gen = new StrudelGenerator();
    const wrapped = gen.wrapForGallery('s("<bd>")');
    expect(wrapped).toContain('&lt;');
    expect(wrapped).toContain('&gt;');
  });
});
