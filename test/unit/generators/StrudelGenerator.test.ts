import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 's("bd sd hh oh").out()',
    success: true,
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
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

import { StrudelGenerator } from '../../../src/generators/strudel/StrudelGenerator.js';

describe('StrudelGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('generate returns sanitized Strudel code', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 's("bd sd").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('drum pattern');
    expect(result).toContain('s("bd sd")');
    expect(result).toContain('.out()');
  });

  it('strips thinking tags from output', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<think some reasoning\n</think\ns("hh").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('hi-hat');
    expect(result).not.toContain('think>');
    expect(result).toContain('s("hh")');
  });

  it('strips markdown fences from output', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```javascript\ns("bd").out()\n```',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('kick');
    expect(result).not.toContain('```');
    expect(result).toContain('s("bd")');
  });

  it('strips HTML comments from output', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<!-- explanation -->\ns("bd").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('kick');
    expect(result).not.toContain('<!--');
    expect(result).toContain('s("bd")');
  });

  it('filters lines without Strudel syntax', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'This is an explanation line.\ns("bd").out()\nAnother non-code line.',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('drums');
    const lines = result.split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('s("bd")');
  });

  it('validateOutput rejects code without sound sources', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'console.log("hello world");',
      success: true,
    });
    const gen = new StrudelGenerator();
    await expect(gen.generate('no music')).rejects.toThrow('No sound source found');
  });

  it('validateOutput accepts code with s() function', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 's("cp*4").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('clap');
    expect(result).toContain('s(');
  });

  it('validateOutput accepts code with note() function', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'note("c3 eb3 g3").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('chord');
    expect(result).toContain('note(');
  });

  it('validateOutput accepts code with sound() function', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'sound("bd [sd hh]").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('beat');
    expect(result).toContain('sound(');
  });

  it('filters lines with invalid TidalCycles syntax', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 's1 [bd sd]\ns("bd").out()',
      success: true,
    });
    const gen = new StrudelGenerator();
    const result = await gen.generate('tidal');
    expect(result).not.toContain('s1 [');
    expect(result).toContain('s("bd")');
  });
});
