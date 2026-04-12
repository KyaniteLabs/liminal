import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockGenerateWithToolLoop } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
    success: true,
  }),
  mockGenerateWithToolLoop: vi.fn().mockImplementation(async () => {
    const r = await mockGenerate();
    return { content: r.code, toolCalls: [], success: r.success, error: r.error };
  }),
}));

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

import { HTMLWebGenerator } from '../../../src/generators/html/HTMLWebGenerator.js';

describe('HTMLWebGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
    mockGenerateWithToolLoop.mockImplementation(async () => {
      const r = await mockGenerate();
      return { content: r.code, toolCalls: [], success: r.success, error: r.error };
    });
  });

  it('extracts HTML from markdown code fences', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```html\n<!DOCTYPE html><html><body>Hi</body></html>\n```',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('simple page');
    expect(result).toBe('<!DOCTYPE html><html><body>Hi</body></html>');
    expect(result).not.toContain('```');
  });

  it('returns raw HTML when no code fences present', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<!DOCTYPE html><html><body>Direct</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('direct html');
    expect(result).toBe('<!DOCTYPE html><html><body>Direct</body></html>');
  });

  it('strips an opening html fence even when the closing fence is missing', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```html\n<!DOCTYPE html><html><body>Unclosed fence</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('html with unclosed fence');
    expect(result).toBe('<!DOCTYPE html><html><body>Unclosed fence</body></html>');
    expect(result).not.toContain('```html');
  });

  it('detects HTML with <html tag (no DOCTYPE)', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<html lang="en"><body>No doctype</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('html page');
    expect(result).toContain('<html');
  });

  it('throws when LLM output is not valid HTML', async () => {
    const gen = new HTMLWebGenerator();
    expect(() => (gen as any).extractHTML('This is just plain text, not HTML at all.')).toThrow('not valid HTML');
  });

  it('validateOutput rejects code without DOCTYPE or html tags', async () => {
    const gen = new HTMLWebGenerator();
    expect((gen as any).extractHTML('```html\n<p>Just a paragraph</p>\n```')).toBe('<p>Just a paragraph</p>');
    expect(gen.validateOutput('<p>Just a paragraph</p>').valid).toBe(false);
  });

  it('validateOutput accepts code with DOCTYPE', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<!DOCTYPE html><html><body>Valid</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('valid page');
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('passes options through to super.generate', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '<!DOCTYPE html><html><body>Options test</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('portfolio', {
      title: 'My Portfolio',
      responsive: true,
      darkMode: true,
      includeAnimations: false,
    });
    expect(result).toContain('<!DOCTYPE html>');
  });
});
