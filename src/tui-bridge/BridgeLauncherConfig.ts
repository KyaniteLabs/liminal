import { getActiveProvider, getProviderConfig, type ProviderType } from '../harness/MultiProviderConfig.js';

export interface BridgeProviderConfig {
  provider: ProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const API_KEY_REQUIRED_PROVIDERS = new Set<ProviderType>([
  'minimax',
  'glm',
  'openrouter',
  'moonshot',
  'kimi',
]);

export function resolveBridgeProviderConfig(): BridgeProviderConfig {
  const provider = getActiveProvider();
  const config = getProviderConfig(provider);

  if (!config) {
    throw new Error(`No provider config found for ${provider}`);
  }

  if (API_KEY_REQUIRED_PROVIDERS.has(provider) && !config.apiKey) {
    throw new Error(
      `Missing API key for ${provider}. Set the provider key in ~/.liminal/config.json or environment variables.`,
    );
  }

  return {
    provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey,
  };
}
