import { describe, it, expect, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(async () => ({
    code: 'd\n r\n  i\n   p\n    p\n    i\n     n\n      g',
    thinking: '',
    recoveredFromThinking: false,
  })),
}));

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    static isConfigured = vi.fn(() => true);
    getConfig = vi.fn(() => ({ model: 'test-model', apiKey: 'test' }));
    generate = mockGenerate;
    generateWithToolLoop = vi.fn().mockImplementation(() =>
      mockGenerate().then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
    );
  },
}));
vi.mock('../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: class {
    build = vi.fn(() => ({ system: 'sys', user: 'usr', combined: 'combined' }));
    static loadContext = vi.fn(async () => ({ domainDocs: '', recentAdaptations: [], userPreferences: undefined }));
  },
}));
vi.mock('../../src/llm/ModelTier.js', () => ({
  detectModelTier: vi.fn(() => 'flagship'),
  trimContext: vi.fn(),
}));
vi.mock('../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    getRecentErrors: vi.fn(() => []),
    getSuccessfulAdaptations: vi.fn(() => []),
    getRecentEpisodes: vi.fn(() => []),
    recordEpisode: vi.fn(),
  },
}));
vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { getQualityHint: vi.fn(() => null), onGenerationComplete: vi.fn(async () => {}) },
}));
vi.mock('../../src/core/ContextAccumulation.js', () => ({
  ContextAccumulation: { getHistory: vi.fn(() => []) },
}));

import { TextGenerativeGenerator } from '../../src/generators/textgen/TextGenerativeGenerator.js';

const SAMPLE_TEXT = [
  'd',
  ' r',
  '  i',
  '   p',
  '    p',
  '    i',
  '     n',
  '      g',
].join('\n');

describe('TextGenerativeGenerator', () => {
  // ── Construction ──────────────────────────────────────────────────
  it('has domain "textgen"', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).domain).toBe('textgen');
  });

  // ── generate() public API ────────────────────────────────────────
  it('generate() returns formatted text from LLM', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: SAMPLE_TEXT,
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('dripping water');
    expect(result).toBe(SAMPLE_TEXT);
    expect(result.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('generate() applies maxLines constraint', async () => {
    const longText = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
    mockGenerate.mockResolvedValueOnce({
      code: longText,
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('test', { maxLines: 10 } as any);
    expect(result.split('\n').length).toBe(10);
  });

  it('generate() applies maxWidth constraint', async () => {
    // Must be multi-line to pass validateOutput's ≥2-line check
    const longLines = Array.from({ length: 5 }, () => 'a'.repeat(200)).join('\n');
    mockGenerate.mockResolvedValueOnce({
      code: longLines,
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('test', { maxWidth: 20 } as any);
    // All lines should be <= 20 chars
    for (const line of result.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  it('generate() strips markdown text fences before returning text art', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```text\nhello\nworld\n```',
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    await expect(gen.generate('test')).resolves.toBe('hello\nworld');
  });

  it('generate() strips // comments', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '// comment\nactual content\n// another comment',
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('test');
    expect(result).not.toContain('//');
    expect(result).toContain('actual content');
  });

  it('generate() filters Unicode when unicode=false', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'hello\n\u2603 snowman\nworld\u00e9',
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('test', { unicode: false } as any);
    expect(result).not.toContain('\u2603');
    expect(result).not.toContain('\u00e9');
  });

  it('generate() keeps Unicode when unicode=true', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'hello\n\u2603 snowman\nworld\u00e9',
      thinking: '',
      recoveredFromThinking: false,
    });
    const gen = new TextGenerativeGenerator();
    const result = await gen.generate('test', { unicode: true } as any);
    expect(result).toContain('\u2603');
    expect(result).toContain('\u00e9');
  });

  // ── Validation ───────────────────────────────────────────────────
  it('validateOutput rejects empty strings', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).validateOutput('')).toEqual({ valid: false, error: 'Empty output' });
  });

  it('validateOutput rejects code (function keyword)', () => {
    const gen = new TextGenerativeGenerator();
    const result = (gen as any).validateOutput('function foo() {\n  return bar;\n}');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('code');
  });

  it('validateOutput rejects code (class keyword)', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).validateOutput('class Foo {\n  bar() {}\n}').valid).toBe(false);
  });

  it('validateOutput accepts multi-line text', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).validateOutput('hello world\nsecond line').valid).toBe(true);
  });

  it('validateOutput accepts single-line text', () => {
    const gen = new TextGenerativeGenerator();
    expect((gen as any).validateOutput('just one line').valid).toBe(true);
  });

  // ── getDefaultOptions by tier ────────────────────────────────────
  it('getDefaultOptions returns flagship defaults for flagship tier', () => {
    const gen = new TextGenerativeGenerator();
    const opts = (gen as any).getDefaultOptions();
    expect(opts.form).toBe('freeform');
    expect(opts.style).toBe('ethereal');
    expect(opts.maxLines).toBe(40);
    expect(opts.maxWidth).toBe(80);
    expect(opts.unicode).toBe(true);
  });

  it('getDefaultOptions returns tiny defaults for tiny tier', () => {
    const gen = new TextGenerativeGenerator();
    (gen as any).tier = 'tiny';
    const opts = (gen as any).getDefaultOptions();
    expect(opts.form).toBe('concrete');
    expect(opts.style).toBe('minimal');
    expect(opts.maxLines).toBe(20);
    expect(opts.maxWidth).toBe(40);
    expect(opts.unicode).toBe(false);
  });

  it('getDefaultOptions returns local defaults for local tier', () => {
    const gen = new TextGenerativeGenerator();
    (gen as any).tier = 'local';
    const opts = (gen as any).getDefaultOptions();
    expect(opts.form).toBe('freeform');
    expect(opts.maxLines).toBe(30);
    expect(opts.maxWidth).toBe(60);
  });
});
