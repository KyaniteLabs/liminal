import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
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

import { HTMLWebGenerator } from '../../../src/generators/html/HTMLWebGenerator.js';

describe('HTMLWebGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
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
    mockGenerate.mockResolvedValueOnce({
      code: 'This is just plain text, not HTML at all.',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    await expect(gen.generate('bad output')).rejects.toThrow('not valid HTML');
  });

  it('validateOutput rejects code without DOCTYPE or html tags', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```html\n<p>Just a paragraph</p>\n```',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    await expect(gen.generate('paragraph')).rejects.toThrow('not valid HTML');
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
