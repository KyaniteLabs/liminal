import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    code: 'line one\nline two\nline three',
    success: true,
  })
);

const mockGenerateWithToolLoop = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    content: 'line one\nline two\nline three',
    iterations: 1,
    toolCallsMade: 0,
    success: true,
    error: undefined,
  })
);

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
    generateWithToolLoop = mockGenerateWithToolLoop;
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

class TestableTextGenerativeGenerator extends TextGenerativeGenerator {
  validateForTest(code: string) {
    return this.validateOutput(code);
  }
}

describe('TextGenerativeGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockGenerate.mockResolvedValue({
      code: 'line one\nline two\nline three',
      success: true,
    });
    mockGenerateWithToolLoop.mockReset();
    mockGenerateWithToolLoop.mockResolvedValue({
      content: 'line one\nline two\nline three',
      iterations: 1,
      toolCallsMade: 0,
      success: true,
      error: undefined,
    });
  });

  describe('generate', () => {
    it('returns formatted text output from LLM', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'drip\ndrop\nsplash',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('dripping water');
      expect(result).toBe('drip\ndrop\nsplash');
    });

    it('strips markdown code block markers from output', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '```\nhello\nworld\n```',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('poem');
      expect(result).toBe('hello\nworld');
    });

    it('strips comment lines from output', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '// This is a comment\nactual line one\n// another comment\nactual line two',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('text art');
      expect(result).toBe('actual line one\nactual line two');
    });

    it('rejects placeholder HTML instead of text art', () => {
      const gen = new TestableTextGenerativeGenerator();
      const result = gen.validateForTest('<!DOCTYPE html><html><body><div id="pond"></div><script>// JS here</script></body></html>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTML/code placeholder');
    });

    it('rejects SVG markup instead of text art', () => {
      const gen = new TestableTextGenerativeGenerator();
      const result = gen.validateForTest('<svg viewBox="0 0 800 800"><path id="ring1" d="M 400 350"></path></svg>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTML/code placeholder');
    });

    it('applies maxLines constraint from options', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: lines.join('\n'),
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
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
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: lines.join('\n'),
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('long output');
      const resultLines = result.split('\n');
      expect(resultLines.length).toBe(40);
    });

    it('applies maxWidth constraint from options', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'A'.repeat(100),
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('wide text', { maxWidth: 20 });
      expect(result.length).toBe(20);
      expect(result).toBe('A'.repeat(20));
    });

    it('applies default maxWidth of 80 when not specified', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'B'.repeat(120),
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('very wide');
      expect(result.length).toBe(80);
    });

    it('filters out Unicode characters when unicode option is false', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'hello \u00e9\u00e8\u00ea world \u2603 snowman \u2764 heart',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('ascii only', { unicode: false });
      expect(result).not.toContain('\u2603');
      expect(result).not.toContain('\u2764');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('keeps Unicode characters when unicode option is true', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'hello \u2764\u2764\u2764 world',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('unicode art', { unicode: true });
      expect(result).toContain('\u2764');
    });

    it('trims trailing whitespace from each line', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'line one   \nline two   \nline three',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
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
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('empty')).rejects.toThrow('LLM returned empty code');
    });

    it('rejects whitespace-only output', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '   \n   \n   ',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: '',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      await expect(gen.generate('whitespace')).rejects.toThrow('LLM returned empty code');
    });

    it('rejects code with markdown code blocks', () => {
      const gen = new TextGenerativeGenerator();
      const result = (gen as any).validateOutput('```\nfunction hello() { return "hi"; }\n```');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be code');
    });

    it('rejects output containing function declarations', () => {
      const gen = new TextGenerativeGenerator();
      const result = (gen as any).validateOutput('function foo() {\n  return 1;\n}\n// text');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be code');
    });

    it('rejects output containing class declarations', () => {
      const gen = new TextGenerativeGenerator();
      const result = (gen as any).validateOutput('class Foo {\n  bar() {}\n}\nmore text');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('appears to be code');
    });

    it('rejects single-line output when maxLines is set', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'just one line of text',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
      });
      const gen = new TextGenerativeGenerator();
      const result = await gen.generate('simple', { maxLines: 2 });
      expect(result).toBe('just one line of text');
    });

    it('accepts output with 2+ lines of text', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce({
        content: 'first line\nsecond line',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
        error: undefined,
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
