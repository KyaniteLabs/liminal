import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: '  ***\n *****\n*******\n *****\n  ***',
    success: true,
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
    generateWithToolLoop = vi.fn().mockImplementation(() =>
      mockGenerate().then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
    );
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

import { ASCIIArtGenerator } from '../../../src/generators/ascii/ASCIIArtGenerator.js';

describe('ASCIIArtGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('formats output to the specified width and height', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '##++##\n%%**%%',
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('diamond', { width: 10, height: 5 });
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0].length).toBe(10);
  });

  it('pads lines shorter than width with spaces', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '~~~~~\n~~~~~',  // 10 chars total (meets strippedCode >= 10 threshold)
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('small art', { width: 8, height: 3 });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    for (const line of lines) {
      expect(line.length).toBe(8);
    }
  });

  it('truncates lines longer than width', async () => {
    const longLine = '*'.repeat(100);
    mockGenerate.mockResolvedValueOnce({
      code: longLine,
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('wide art', { width: 20, height: 2 });
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line.length).toBe(20);
    }
  });

  it('uses default width=40 and height=20 when no options provided', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~',  // 40 chars, passes strippedCode >= 10
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('default size');
    const lines = result.split('\n');
    expect(lines.length).toBe(20);
    expect(lines[0].length).toBe(40);
  });

  it('validateOutput rejects code with non-ASCII art characters', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'Hello World!',
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    await expect(gen.generate('text art')).rejects.toThrow('invalid characters');
  });

  it('validateOutput accepts code with only allowed ASCII art characters', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '  ***\n *.*.*\n  ***',
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('star');
    expect(result).toContain('***');
  });

  it('removes empty lines and filters before formatting', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '\n\n##++\n\n%%**\n\n',  // valid ASCII art chars only, 10+ total to pass strippedCode >= 10
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('sparse', { width: 6, height: 5 });
    const lines = result.split('\n');
    // formatASCII keeps first non-empty lines up to height, truncates/pads each
    expect(lines.length).toBe(5);
    expect(lines[0].length).toBe(6);
  });
});

describe('ASCIIArtGenerator.wrapForGallery', () => {
  it('returns valid HTML with escaped code content', () => {
    const gen = new ASCIIArtGenerator();
    const code = '***\n*<*\n***';
    const wrapped = gen.wrapForGallery(code);

    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('ASCII Art');
    expect(wrapped).toContain('&lt;');
  });

  it('escapes HTML entities in art', () => {
    const gen = new ASCIIArtGenerator();
    const code = '<div>***</div>';
    const wrapped = gen.wrapForGallery(code);

    expect(wrapped).toContain('&lt;div&gt;');
    expect(wrapped).not.toContain('<div>');
  });

  it('includes monospace styling', () => {
    const gen = new ASCIIArtGenerator();
    const wrapped = gen.wrapForGallery('***');

    expect(wrapped).toContain('monospace');
    expect(wrapped).toContain('pre');
  });
});
