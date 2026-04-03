/**
 * CapabilityRegistry - Static model → capabilities lookup
 *
 * Zero-cost capability detection. No token burning, no API probes.
 * Uses glob-style matching against a built-in model database.
 * Config overrides take priority over static data.
 */

import type { ProviderCapabilities } from './ProviderTypes.js';

export interface ModelCapabilities extends ProviderCapabilities {
  thinkingStyle: 'budget_tokens' | 'effort_level' | 'think_tags' | 'reasoning_content' | 'none';
  streamingStyle: 'sse' | 'json_lines' | 'tag_based';
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  thinking: false,
  streaming: true,
  jsonMode: true,
  toolUse: false,
  maxContextTokens: 4096,
  thinkingStyle: 'none',
  streamingStyle: 'sse',
};

// Static model database — update with new model releases
const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  // Anthropic
  'claude-opus-4-*':    { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 200000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'claude-sonnet-4-*':  { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 200000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'claude-haiku-4-*':   { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 200000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },

  // OpenAI
  'gpt-5*':             { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 400000, thinkingStyle: 'effort_level', streamingStyle: 'sse' },
  'o3*':                { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'effort_level', streamingStyle: 'sse' },
  'o4-mini*':           { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'effort_level', streamingStyle: 'sse' },
  'gpt-4o*':            { thinking: false, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'none', streamingStyle: 'sse' },

  // Google
  'gemini-2.5-pro*':    { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 2000000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'gemini-2.5-flash*':  { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 1000000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },

  // DeepSeek
  'deepseek-r1*':       { thinking: true, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'think_tags', streamingStyle: 'sse' },
  'deepseek-chat*':     { thinking: false, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'none', streamingStyle: 'sse' },

  // Local (via Ollama/LM Studio)
  'qwen3.5-coder-480b': { thinking: true, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 128000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'qwen3.5-coder-14b':  { thinking: true, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 128000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'qwen3.5-coder-7b':   { thinking: false, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 32768, thinkingStyle: 'none', streamingStyle: 'json_lines' },
  'qwen3.5*':           { thinking: true, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 128000, thinkingStyle: 'budget_tokens', streamingStyle: 'sse' },
  'qwen2.5*':           { thinking: false, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 32768, thinkingStyle: 'none', streamingStyle: 'json_lines' },
  'llama4-maverick*':   { thinking: true, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 128000, thinkingStyle: 'reasoning_content', streamingStyle: 'json_lines' },
  'llama*':             { thinking: false, streaming: true, jsonMode: true, toolUse: false, maxContextTokens: 128000, thinkingStyle: 'none', streamingStyle: 'json_lines' },
  'devstral-small*':    { thinking: false, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 128000, thinkingStyle: 'none', streamingStyle: 'json_lines' },
  'codestral*':         { thinking: false, streaming: true, jsonMode: true, toolUse: true, maxContextTokens: 32000, thinkingStyle: 'none', streamingStyle: 'json_lines' },
};

// User overrides — populated from config
const userOverrides: Map<string, Partial<ModelCapabilities>> = new Map();

/**
 * Glob-style pattern match for model names.
 * Supports trailing wildcard: 'claude-sonnet-4-*' matches 'claude-sonnet-4-20250514'
 */
function matchesPattern(model: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    return model.startsWith(pattern.slice(0, -1));
  }
  return model === pattern;
}

export class CapabilityRegistry {
  /**
   * Look up capabilities for a model.
   * Priority: user overrides > static registry > conservative defaults.
   */
  static getCapabilities(model: string): ModelCapabilities {
    // Check user overrides first
    const override = userOverrides.get(model);
    if (override) {
      return { ...DEFAULT_CAPABILITIES, ...override };
    }

    // Search static registry (most specific patterns first — longer patterns are more specific)
    const patterns = Object.keys(MODEL_CAPABILITIES).sort((a, b) => b.length - a.length);
    for (const pattern of patterns) {
      if (matchesPattern(model, pattern)) {
        return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES[pattern] };
      }
    }

    // Conservative default: no thinking, basic streaming
    return { ...DEFAULT_CAPABILITIES };
  }

  /**
   * Register a user override from config.
   * Takes priority over static registry for the exact model name.
   */
  static override(model: string, caps: Partial<ModelCapabilities>): void {
    userOverrides.set(model, caps);
  }

  /**
   * Clear all user overrides (useful for testing).
   */
  static clearOverrides(): void {
    userOverrides.clear();
  }
}
