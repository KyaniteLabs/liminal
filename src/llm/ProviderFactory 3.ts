/**
 * ProviderFactory - Creates provider instances from configuration
 *
 * Maps provider identifiers to concrete BaseProvider subclasses.
 * Single entry point for all provider instantiation.
 */

import type { ProviderConfig } from './ProviderTypes.js';
import { BaseProvider } from './providers/BaseProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { GoogleProvider } from './providers/GoogleProvider.js';
import { MiniMaxProvider } from './providers/MiniMaxProvider.js';

export type ProviderName = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'google' | 'minimax' | 'custom';

/**
 * Detect provider from baseUrl or config hints.
 */
export function detectProvider(config: ProviderConfig): ProviderName {
  const baseUrl = config.baseUrl.toLowerCase();

  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('minimax')) return 'minimax'; // Before anthropic — api.minimax.io/anthropic contains "anthropic"
  if (baseUrl.includes('anthropic') || baseUrl.includes('api.anthropic')) return 'anthropic';
  if (baseUrl.includes('generativelanguage') || baseUrl.includes('googleapis')) return 'google';
  if (baseUrl.includes(':11434') || baseUrl.includes('ollama')) return 'ollama';
  if (baseUrl.includes('z.ai') || baseUrl.includes('bigmodel.cn')) return 'openai'; // ZhipuAI GLM — OpenAI-compatible
  if (baseUrl.includes('moonshot.ai') || baseUrl.includes('moonshot.cn')) return 'openai'; // KimiCode — OpenAI-compatible
  if (baseUrl.includes('kimi.com')) return 'openai'; // Kimi Code — OpenAI-compatible, requires User-Agent
  if (baseUrl.includes('openai') || baseUrl.includes('api.openai')) return 'openai';

  // Local endpoints: check model name for hints
  const model = config.model.toLowerCase();
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'google';
  if (model.includes('deepseek-r1') && baseUrl.includes('11434')) return 'ollama';

  // Default: OpenAI-compatible (covers LM Studio, LocalAI, vLLM, etc.)
  return 'openai';
}

/**
 * Create a provider instance from config.
 * Auto-detects provider from baseUrl if not explicitly specified.
 */
export function createProvider(
  config: ProviderConfig,
  providerHint?: ProviderName,
): BaseProvider {
  const providerName = providerHint || detectProvider(config);

  switch (providerName) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'google':
      return new GoogleProvider(config);
    case 'minimax':
      return new MiniMaxProvider(config);
    case 'openai':
    case 'custom':
    default:
      return new OpenAIProvider(config);
  }
}
