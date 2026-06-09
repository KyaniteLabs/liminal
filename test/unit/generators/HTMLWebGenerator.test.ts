import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockComplete, mockGenerateWithToolLoop } = vi.hoisted(() => ({
  mockComplete: vi.fn().mockResolvedValue({
    text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test</title></head><body><h1>Hello</h1></body></html>',
    success: true,
  }),
  mockGenerateWithToolLoop: vi.fn().mockImplementation(async () => {
    const r = await mockComplete();
    return { content: r.text, toolCalls: [], success: r.success, error: r.error };
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    complete = mockComplete;
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
    mockComplete.mockReset();
    mockComplete.mockResolvedValue({
      text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Test</title></head><body><h1>Hello</h1></body></html>',
      success: true,
    });
    mockGenerateWithToolLoop.mockClear();
    mockGenerateWithToolLoop.mockImplementation(async () => {
      const r = await mockComplete();
      return { content: r.text, toolCalls: [], success: r.success, error: r.error };
    });
  });

  it('extracts HTML from markdown code fences', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '```html\n<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hi</title></head><body>Hi</body></html>\n```',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('simple page');
    expect(result).toBe('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hi</title></head><body>Hi</body></html>');
    expect(result).not.toContain('```');
  });

  it('returns raw HTML when no code fences present', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Direct</title></head><body>Direct</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('direct html');
    expect(result).toBe('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Direct</title></head><body>Direct</body></html>');
  });

  it('strips an opening html fence even when the closing fence is missing', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '```html\n<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unclosed</title></head><body>Unclosed fence</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('html with unclosed fence');
    expect(result).toBe('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unclosed</title></head><body>Unclosed fence</body></html>');
    expect(result).not.toContain('```html');
  });

  it('preserves doctype when provider emits doctype before an html fence', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '<!DOCTYPE html>\n```html\n<html><head><meta charset="UTF-8"><title>Fenced</title></head><body>Fenced body</body></html>\n```',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('doctype before fence');
    expect(result).toBe('<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>Fenced</title></head><body>Fenced body</body></html>');
  });

  it('returns complete HTML documents with an <html> tag', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>No doctype</title></head><body>No doctype</body></html>',
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
    mockComplete.mockResolvedValueOnce({
      text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Valid</title></head><body>Valid</body></html>',
      success: true,
    });
    const gen = new HTMLWebGenerator();
    const result = await gen.generate('valid page');
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('validateOutput rejects truncated HTML before RalphLoop sees it', async () => {
    const gen = new HTMLWebGenerator();
    const result = gen.validateOutput('<!DOCTYPE html><html><head><title>Broken</title>');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('closing </html>');
  });

  it('uses bounded direct completion instead of the generic tool loop', async () => {
    mockComplete.mockResolvedValueOnce({
      text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Options</title></head><body>Options test</body></html>',
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
    expect(mockComplete.mock.calls[0]?.[0].maxTokens).toBe(5000);
    expect(mockComplete.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(mockGenerateWithToolLoop).not.toHaveBeenCalled();
  });
});
