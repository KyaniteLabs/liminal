/**
 * ProviderFactory - Creates provider instances from configuration
 *
 * Maps provider identifiers to concrete BaseProvider subclasses.
 * Single entry point for all provider instantiation.
 */

import type { ProviderConfig } from './ProviderTypes.js';
import { detectProviderAdapter } from '../config/ProviderRuntime.js';
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
  return detectProviderAdapter(config);
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
