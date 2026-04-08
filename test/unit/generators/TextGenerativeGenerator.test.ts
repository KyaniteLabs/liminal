import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 'line one\nline two\nline three',
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

import { TextGenerativeGenerator } from '../../../src/generators/textgen/TextGenerativeGenerator.js';

describe('TextGenerativeGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  describe('generate', () => {
    it('returns formatted text output from LLM', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'drip\ndrop\nsplash',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('dripping water');
      expect(result).toBe('drip\ndrop\nsplash');
    });

    it('strips comment lines from output', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '// This is a comment\nactual line one\n// another comment\nactual line two',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('text art');
      expect(result).toBe('actual line one\nactual line two');
    });

    it('applies maxLines constraint from options', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      mockGenerate.mockResolvedValueOnce({
        code: lines.join('\n'),
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('many lines', { maxLines: 5 });
      const resultLines = result.split('\n');
      expect(resultLines.length).toBe(5);
      expect(resultLines[0]).toBe('line 1');
      expect(resultLines[4]).toBe('line 5');
    });

    it('applies default maxLines of 40 when not specified', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      mockGenerate.mockResolvedValueOnce({
        code: lines.join('\n'),
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('long output');
      const resultLines = result.split('\n');
      expect(resultLines.length).toBe(40);
    });

    it('applies maxWidth constraint from options', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'A'.repeat(120) + '\nsecond line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('wide text', { maxWidth: 20 });
      const lines = result.split('\n');
      expect(lines[0].length).toBeLessThanOrEqual(20);
    });

    it('applies default maxWidth of 80 when not specified', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'B'.repeat(120) + '\nsecond line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('very wide');
      const lines = result.split('\n');
      expect(lines[0].length).toBeLessThanOrEqual(80);
    });

    it('filters out Unicode characters when unicode option is false', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'hello world\nsnowman heart \u2603\u2764',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('ascii only', { unicode: false });
      expect(result).not.toContain('\u2603');
      expect(result).not.toContain('\u2764');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('keeps Unicode characters when unicode option is true', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'hello world\nsecond line \u2764\u2764\u2764',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('unicode art', { unicode: true });
      expect(result).toContain('\u2764');
    });

    it('trims trailing whitespace from each line', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'line one   \nline two   \nline three',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('trimmed');
      const lines = result.split('\n');
      for (const line of lines) {
        expect(line).toBe(line.trimEnd());
      }
    });
  });

  describe('validateOutput', () => {
    it('rejects empty output', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('empty')).rejects.toThrow('LLM returned empty code');
    });

    it('rejects whitespace-only output', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '   \n   \n   ',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('whitespace')).rejects.toThrow('LLM returned empty code');
    });

    it('rejects code with markdown code blocks', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '```javascript\nconsole.log("hello");\n```\nvalid text line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('code block')).rejects.toThrow('appears to be code');
    });

    it('rejects output containing function declarations', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'function foo() {\n  return 1;\n}\nvalid text line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('function')).rejects.toThrow('appears to be code');
    });

    it('rejects output containing class declarations', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'class Foo {\n  bar() {}\n}\nvalid text line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('class')).rejects.toThrow('appears to be code');
    });

    it('rejects single-line output as too simple', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'just one line of text',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('simple')).rejects.toThrow('less than 2 lines');
    });

    it('accepts output with 2+ lines of text', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'first line\nsecond line',
        success: true,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('valid text art');
      expect(result).toBe('first line\nsecond line');
    });
  });

  describe('constructor and domain', () => {
    it('sets domain to textgen', () => {
      const gen = new TextGenerativeGenerator();
      const info = gen.getTierInfo();
      expect(info.domain).toBe('textgen');
    });

    it('accepts an LLM config object', () => {
      const gen = new TextGenerativeGenerator({ model: 'test-model', baseUrl: 'http://test' });
      const info = gen.getTierInfo();
      expect(info.domain).toBe('textgen');
    });
  });
});
