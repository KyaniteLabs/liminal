/**
 * ThinkingNormalizer - Unified thinking trace extraction
 *
 * Extracts reasoning traces from ANY provider's response into a
 * consistent NormalizedThinking format. Operates at the API level
 * (structured responses), complementing ReasoningCapture which
 * operates at the text level (regex extraction).
 */

import type { NormalizedThinking } from './ProviderTypes.js';

/**
 * Extract normalized thinking from an Anthropic-style response.
 * Anthropic returns thinking_blocks[] as separate content blocks.
 */
export function extractAnthropicThinking(response: unknown): NormalizedThinking {
  const resp = response as Record<string, unknown>;
  const contentBlocks = resp.content as Array<{ type: string; thinking?: string }> | undefined;

  if (!contentBlocks) {
    return { text: '', source: 'none' };
  }

  const thinkingBlocks = contentBlocks.filter(b => b.type === 'thinking');
  if (thinkingBlocks.length === 0) {
    return { text: '', source: 'none' };
  }

  const text = thinkingBlocks
    .map(b => b.thinking || '')
    .filter(t => t.length > 0)
    .join('\n');

  return {
    text,
    source: text ? 'thinking_blocks' : 'none',
  };
}

/**
 * Extract normalized thinking from a DeepSeek/OpenAI-style response.
 * These providers return reasoning_content as a string field alongside content.
 */
export function extractReasoningContent(response: unknown): NormalizedThinking {
  const resp = response as Record<string, unknown>;
  const choices = resp.choices as Array<{ message?: { reasoning_content?: string } }> | undefined;

  if (choices?.[0]?.message?.reasoning_content) {
    const text = choices[0].message.reasoning_content;
    return {
      text,
      source: text ? 'reasoning_content' : 'none',
    };
  }

  // Also check top-level reasoning_content (some providers)
  const reasoning = resp.reasoning_content as string | undefined;
  if (reasoning) {
    return { text: reasoning, source: 'reasoning_content' };
  }

  return { text: '', source: 'none' };
}

/**
 * Extract normalized thinking from OpenRouter response.
 * OpenRouter returns reasoning_details as an array.
 */
export function extractOpenRouterThinking(response: unknown): NormalizedThinking {
  const resp = response as Record<string, unknown>;
  const choices = resp.choices as Array<{ message?: { reasoning?: string; reasoning_details?: Array<{ type: string; text?: string }> } }> | undefined;

  // Try reasoning_details first (structured)
  const details = choices?.[0]?.message?.reasoning_details;
  if (details && details.length > 0) {
    const text = details
      .filter(d => d.type === 'reasoning.text' || d.type === 'reasoning.summary')
      .map(d => d.text || '')
      .filter(t => t.length > 0)
      .join('\n');

    if (text) {
      return { text, source: 'reasoning_details' };
    }
  }

  // Fall back to simple reasoning string
  const reasoning = choices?.[0]?.message?.reasoning as string | undefined;
  if (reasoning) {
    return { text: reasoning, source: 'reasoning_details' };
  }

  return { text: '', source: 'none' };
}

/**
 * Extract thinking from Ollama native response.
 * Ollama returns a 'thinking' field for models that support it.
 */
export function extractOllamaThinking(response: unknown): NormalizedThinking {
  const resp = response as Record<string, unknown>;
  const thinking = resp.thinking as string | undefined;

  if (thinking) {
    return { text: thinking, source: 'think_tags' };
  }

  return { text: '', source: 'none' };
}

/**
 * Strip <think/> tags from content.
 * Used as fallback for any provider that leaks tags into output.
 * Returns cleaned content and extracted thinking text.
 */
export function stripThinkTags(content: string): { content: string; thinking: string } {
  const thinkPattern = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
  let thinking = '';
  let cleanContent = content;

  const matches = content.matchAll(thinkPattern);
  for (const match of matches) {
    thinking += match[1] + '\n';
  }
  cleanContent = content.replace(thinkPattern, '').trim();

  return {
    content: cleanContent,
    thinking: thinking.trim(),
  };
}

/**
 * Normalize thinking from any provider response.
 * Tries all extraction methods and returns the first non-empty result.
 */
export function normalizeThinking(
  response: unknown,
  providerName: string,
): NormalizedThinking {
  // Try provider-specific extraction first
  switch (providerName) {
    case 'anthropic':
      return extractAnthropicThinking(response);
    case 'openrouter':
      return extractOpenRouterThinking(response);
    case 'ollama':
      return extractOllamaThinking(response);
    default:
      break;
  }

  // Generic: try reasoning_content (works for DeepSeek, OpenAI GPT-5, etc.)
  const reasoningResult = extractReasoningContent(response);
  if (reasoningResult.source !== 'none') {
    return reasoningResult;
  }

  // Last resort: check for <think/> tags in content
  const resp = response as Record<string, unknown>;
  const choices = resp.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content || (resp.response as string) || '';
  const { thinking } = stripThinkTags(content);

  if (thinking) {
    return { text: thinking, source: 'think_tags' };
  }

  return { text: '', source: 'none' };
}
