import { describe, it, expect } from 'vitest';

import {
  normalizeThinking,
  stripThinkTags,
  extractAnthropicThinking,
  extractReasoningContent,
  extractOpenRouterThinking,
  extractOllamaThinking,
} from '../../../src/llm/ThinkingNormalizer.js';

// ── extractAnthropicThinking ──

describe('extractAnthropicThinking', () => {
  it('extracts thinking text from thinking content blocks', () => {
    const response = {
      content: [
        { type: 'thinking', thinking: 'reasoning text' },
        { type: 'text', text: 'final answer' },
      ],
    };

    const result = extractAnthropicThinking(response);

    expect(result.text).toBe('reasoning text');
    expect(result.source).toBe('thinking_blocks');
  });

  it('returns empty when no thinking blocks present', () => {
    const response = {
      content: [{ type: 'text', text: 'just output' }],
    };

    const result = extractAnthropicThinking(response);

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('returns empty when content array is missing', () => {
    const result = extractAnthropicThinking({});

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('concatenates multiple thinking blocks', () => {
    const response = {
      content: [
        { type: 'thinking', thinking: 'step one' },
        { type: 'thinking', thinking: 'step two' },
      ],
    };

    const result = extractAnthropicThinking(response);

    expect(result.text).toBe('step one\nstep two');
    expect(result.source).toBe('thinking_blocks');
  });
});

// ── extractReasoningContent ──

describe('extractReasoningContent', () => {
  it('extracts reasoning_content from choices[0].message', () => {
    const response = {
      choices: [
        { message: { reasoning_content: 'model reasoning', content: 'answer' } },
      ],
    };

    const result = extractReasoningContent(response);

    expect(result.text).toBe('model reasoning');
    expect(result.source).toBe('reasoning_content');
  });

  it('returns empty when no reasoning_content present', () => {
    const response = {
      choices: [{ message: { content: 'answer only' } }],
    };

    const result = extractReasoningContent(response);

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('returns empty when choices array is missing', () => {
    const result = extractReasoningContent({});

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('falls back to top-level reasoning_content', () => {
    const response = {
      reasoning_content: 'top-level reasoning',
    };

    const result = extractReasoningContent(response);

    expect(result.text).toBe('top-level reasoning');
    expect(result.source).toBe('reasoning_content');
  });
});

// ── extractOpenRouterThinking ──

describe('extractOpenRouterThinking', () => {
  it('extracts from reasoning_details array', () => {
    const response = {
      choices: [
        {
          message: {
            reasoning_details: [
              { type: 'reasoning.summary', text: 'summary' },
            ],
            content: 'answer',
          },
        },
      ],
    };

    const result = extractOpenRouterThinking(response);

    expect(result.text).toBe('summary');
    expect(result.source).toBe('reasoning_details');
  });

  it('extracts from reasoning_details with reasoning.text type', () => {
    const response = {
      choices: [
        {
          message: {
            reasoning_details: [
              { type: 'reasoning.text', text: 'detailed reasoning' },
            ],
          },
        },
      ],
    };

    const result = extractOpenRouterThinking(response);

    expect(result.text).toBe('detailed reasoning');
    expect(result.source).toBe('reasoning_details');
  });

  it('falls back to reasoning string field', () => {
    const response = {
      choices: [
        {
          message: {
            reasoning: 'raw reasoning string',
          },
        },
      ],
    };

    const result = extractOpenRouterThinking(response);

    expect(result.text).toBe('raw reasoning string');
    expect(result.source).toBe('reasoning_details');
  });

  it('returns empty when no reasoning fields present', () => {
    const response = {
      choices: [{ message: { content: 'plain answer' } }],
    };

    const result = extractOpenRouterThinking(response);

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('returns empty when choices is missing', () => {
    const result = extractOpenRouterThinking({});

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });
});

// ── extractOllamaThinking ──

describe('extractOllamaThinking', () => {
  it('extracts thinking field', () => {
    const response = {
      thinking: 'local thinking',
      response: 'final output',
    };

    const result = extractOllamaThinking(response);

    expect(result.text).toBe('local thinking');
    expect(result.source).toBe('think_tags');
  });

  it('returns empty when no thinking field', () => {
    const response = { response: 'output only' };

    const result = extractOllamaThinking(response);

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });

  it('returns empty for empty object', () => {
    const result = extractOllamaThinking({});

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });
});

// ── stripThinkTags ──

describe('stripThinkTags', () => {
  it('strips think tags and returns content and thinking', () => {
    // Build string with proper HTML-style angle brackets
    const open = '<think' + '>';
    const close = '</' + 'think>';
    const input = `${open}deeper analysis${close}code here`;

    const result = stripThinkTags(input);

    expect(result.content).toBe('code here');
    expect(result.thinking).toBe('deeper analysis');
  });

  it('returns original content when no think tags present', () => {
    const input = 'just regular content';

    const result = stripThinkTags(input);

    expect(result.content).toBe('just regular content');
    expect(result.thinking).toBe('');
  });

  it('concatenates thinking from multiple think blocks', () => {
    const open = '<think' + '>';
    const close = '</' + 'think>';
    const input = `${open}first thought${close}middle text${open}second thought${close}end text`;

    const result = stripThinkTags(input);

    expect(result.thinking).toContain('first thought');
    expect(result.thinking).toContain('second thought');
    expect(result.content).toContain('middle text');
    expect(result.content).toContain('end text');
  });

  it('handles tags with attributes', () => {
    const open = '<think data-step="1"' + '>';
    const close = '</' + 'think>';
    const input = `${open}reasoning here${close}final output`;

    const result = stripThinkTags(input);

    expect(result.content).toBe('final output');
    expect(result.thinking).toBe('reasoning here');
  });
});

// ── normalizeThinking ──

describe('normalizeThinking', () => {
  it('delegates to extractAnthropicThinking for anthropic', () => {
    const response = {
      content: [
        { type: 'thinking', thinking: 'anthropic reasoning' },
        { type: 'text', text: 'answer' },
      ],
    };

    const result = normalizeThinking(response, 'anthropic');

    expect(result.text).toBe('anthropic reasoning');
    expect(result.source).toBe('thinking_blocks');
  });

  it('delegates to extractOllamaThinking for ollama', () => {
    const response = {
      thinking: 'ollama reasoning',
      response: 'answer',
    };

    const result = normalizeThinking(response, 'ollama');

    expect(result.text).toBe('ollama reasoning');
    expect(result.source).toBe('think_tags');
  });

  it('delegates to extractReasoningContent for openai', () => {
    const response = {
      choices: [
        { message: { reasoning_content: 'openai reasoning', content: 'answer' } },
      ],
    };

    const result = normalizeThinking(response, 'openai');

    expect(result.text).toBe('openai reasoning');
    expect(result.source).toBe('reasoning_content');
  });

  it('delegates to extractOpenRouterThinking for openrouter', () => {
    const response = {
      choices: [
        {
          message: {
            reasoning_details: [
              { type: 'reasoning.summary', text: 'router reasoning' },
            ],
          },
        },
      ],
    };

    const result = normalizeThinking(response, 'openrouter');

    expect(result.text).toBe('router reasoning');
    expect(result.source).toBe('reasoning_details');
  });

  it('falls back to stripThinkTags for unknown providers', () => {
    const open = '<think' + '>';
    const close = '</' + 'think>';
    const response = {
      choices: [
        {
          message: {
            content: `${open}fallback thinking${close}final answer`,
          },
        },
      ],
    };

    const result = normalizeThinking(response, 'unknown-provider');

    expect(result.text).toBe('fallback thinking');
    expect(result.source).toBe('think_tags');
  });

  it('returns none when no thinking found for unknown provider', () => {
    const response = {
      choices: [{ message: { content: 'plain text answer' } }],
    };

    const result = normalizeThinking(response, 'unknown-provider');

    expect(result.text).toBe('');
    expect(result.source).toBe('none');
  });
});
