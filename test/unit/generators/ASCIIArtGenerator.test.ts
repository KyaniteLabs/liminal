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
    complete = vi.fn().mockImplementation(() =>
      mockGenerate().then((r: any) => ({ text: r.code, success: r.success, error: r.error }))
    );
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
      code: '~~~~~\n~~~~~',
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
      code: '*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~',
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('default size');
    const lines = result.split('\n');
    expect(lines.length).toBe(20);
    expect(lines[0].length).toBe(40);
  });

  it('validateOutput rejects code with non-ASCII art characters', async () => {
    const gen = new ASCIIArtGenerator();
    const result = (gen as any).validateOutput('Hello 世界 🌍');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
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

  it('validateOutput accepts extended ascii art glyphs supported by the validator', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: `   ★★★\n  ╱   ╲\n ★█████★\n   ║ ║`,
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('castle', { width: 12, height: 4 });
    expect(result).toContain('★');
    expect(result).toContain('╱');
    expect(result).toContain('█');
  });

  it('removes empty lines and filters before formatting', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '\n\n##++\n\n%%**\n\n',
      success: true,
    });
    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('sparse', { width: 6, height: 5 });
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0].length).toBe(6);
  });

  it('recovers ASCII line sketches from model thinking when the final channel is empty', () => {
    const gen = new ASCIIArtGenerator();
    const recovered = (gen as any).recoverASCIIFromModelText(`<think>
Line1: "   *   *    "
Line2: "    /\\\\     "
Line3: "   /  \\\\    "
Line4: "__/____\\\\__ "
</think>`, 14, 4);

    expect(recovered).toContain('/\\');
    expect(recovered!.split('\n')).toHaveLength(4);
  });

  it('does not recover prose line counts as ASCII art', () => {
    const gen = new ASCIIArtGenerator();
    const recovered = (gen as any).recoverASCIIFromModelText(`6: .
8: .
But we need exactly 30 lines.`, 60, 3);

    expect(recovered).toBeNull();
  });

  it('retries when the model returns ASCII-shaped prose instead of art', async () => {
    mockGenerate
      .mockResolvedValueOnce({
        code: `We need to output ASCII art of a mountain landscape.
- Exactly 4 lines.
Let's design it now.
Allowed characters are plain ASCII.`,
        success: true,
      })
      .mockResolvedValueOnce({
        code: ['  /\\', ' /  \\', '/____\\', '~~~~~~'].join('\n'),
        success: true,
      });

    const gen = new ASCIIArtGenerator();
    const result = await gen.generate('mountain', { width: 8, height: 4 });

    expect(result).toContain('/\\');
    expect(result).not.toContain('We need');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
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
