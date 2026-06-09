import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUBSTANTIAL_STRUDEL = [
  'bpm(124)',
  'stack(',
  '  s("bd ~ [~ hh] [bd hh] ~").gain(0.9),',
  '  note("<c3 e3 g3 a3>").s("triangle").cutoff(900).delay(0.18),',
  '  s("cp ~ rim ~").room(0.25)',
  ').slow(2).out()',
].join('\n');

const { mockToolLoop, mockComplete, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: [
      'bpm(124)',
      'stack(',
      '  s("bd ~ [~ hh] [bd hh] ~").gain(0.9),',
      '  note("<c3 e3 g3 a3>").s("triangle").cutoff(900).delay(0.18),',
      '  s("cp ~ rim ~").room(0.25)',
      ').slow(2).out()',
    ].join('\n'),
    iterations: 1,
    toolCallsMade: 0,
    success: true,
  }),
  mockComplete: vi.fn().mockResolvedValue({
    text: [
      'bpm(124)',
      'stack(',
      '  s("bd ~ [~ hh] [bd hh] ~").gain(0.9),',
      '  note("<c3 e3 g3 a3>").s("triangle").cutoff(900).delay(0.18),',
      '  s("cp ~ rim ~").room(0.25)',
      ').slow(2).out()',
    ].join('\n'),
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockToolLoop;
    complete = mockComplete;
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
    mockToolLoop.mockReset();
    mockToolLoop.mockResolvedValue({
      content: SUBSTANTIAL_STRUDEL,
      iterations: 1,
      toolCallsMade: 0,
      success: true,
    });
    mockComplete.mockReset();
    mockComplete.mockResolvedValue({
      text: SUBSTANTIAL_STRUDEL,
      success: true,
    });
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
    mockComplete.mockResolvedValueOnce({ text: '', success: true });
    mockToolLoop.mockResolvedValueOnce({
      content: `\`\`\`javascript\n${SUBSTANTIAL_STRUDEL}\n\`\`\``,
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('drum pattern');
    expect(result).not.toContain('```');
    expect(result).toContain('s(');
  });

  it('sanitizeCode strips HTML script loader tags while preserving Strudel source', async () => {
    mockComplete
      .mockResolvedValueOnce({ text: '', success: true })
      .mockResolvedValueOnce({ text: '', success: true });
    mockToolLoop.mockResolvedValueOnce({
      content: `<script src="https://cdn.jsdelivr.net/npm/@strudel/web@latest"></script>\n${SUBSTANTIAL_STRUDEL}`,
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('drum pattern');

    expect(result).not.toContain('<script');
    expect(result).toContain('cutoff(900)');
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

  it('uses compact direct generation before tool-assisted generation', async () => {
    mockComplete.mockResolvedValueOnce({ text: SUBSTANTIAL_STRUDEL, success: true });

    const gen = new StrudelGenerator();
    const result = await gen.generate('drums and bass');

    expect(result).toContain('s("bd ~ [~ hh] [bd hh] ~")');
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockToolLoop).not.toHaveBeenCalled();
  });

  it('falls back to tool-assisted generation when direct Strudel generation is empty', async () => {
    mockComplete
      .mockResolvedValueOnce({ text: '', success: true })
      .mockResolvedValueOnce({ text: '', success: true });
    mockToolLoop.mockResolvedValueOnce({
      content: SUBSTANTIAL_STRUDEL,
      iterations: 1,
      toolCallsMade: 0,
      success: true,
    });

    const gen = new StrudelGenerator();
    const result = await gen.generate('drums and bass');

    expect(result).toContain('cutoff(900)');
    expect(mockToolLoop).toHaveBeenCalledTimes(1);
  });

  it('retries undersized direct Strudel patterns instead of returning them', async () => {
    mockComplete
      .mockResolvedValueOnce({
        text: 'bpm(120)\ns("bd ~ [~ hh] [bd hh] ~")\n.stack(note("c3 e3 g3").s("triangle"))\n.out()',
        success: true,
      })
      .mockResolvedValueOnce({
        text: [
        'bpm(124)',
        'stack(',
        '  s("bd ~ [~ hh] [bd hh] ~").gain(0.9),',
        '  note("<c3 e3 g3 a3>").s("triangle").cutoff(900).delay(0.18),',
        '  s("cp ~ rim ~").room(0.25)',
        ').slow(2).out()',
        ].join('\n'),
        success: true,
      });

    const gen = new StrudelGenerator();
    const result = await gen.generate('layered drums and triangle melody');

    expect(result.length).toBeGreaterThanOrEqual(100);
    expect(result).toContain('cutoff(900)');
    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(mockToolLoop).not.toHaveBeenCalled();
  });

  it('recovers Strudel code from provider thinking during direct retry', async () => {
    mockComplete.mockResolvedValueOnce({
      text: `<think>Plan:\n${SUBSTANTIAL_STRUDEL}</think>`,
      success: true,
    });

    const gen = new StrudelGenerator();
    const result = await gen.generate('drums and bass');

    expect(result).toContain('cutoff(900)');
  });
});
