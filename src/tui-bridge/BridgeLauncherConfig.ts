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
  'openai',
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
export function applyBridgeProviderEnv(
  env: NodeJS.ProcessEnv,
  config: BridgeProviderConfig,
): void {
  const shared: Record<string, string> = {
    LLM_PROVIDER: config.provider,
    LLM_BASE_URL: config.baseUrl,
    LLM_MODEL: config.model,
    HARNESS_BASE_URL: config.baseUrl,
    HARNESS_MODEL: config.model,
    EVALUATOR_BASE_URL: config.baseUrl,
    EVALUATOR_MODEL: config.model,
    LIMINAL_LLM_PROVIDER: config.provider,
    LIMINAL_LLM_BASE_URL: config.baseUrl,
    LIMINAL_LLM_MODEL: config.model,
    LIMINAL_HARNESS_BASE_URL: config.baseUrl,
    LIMINAL_HARNESS_MODEL: config.model,
    LIMINAL_EVALUATOR_BASE_URL: config.baseUrl,
    LIMINAL_EVALUATOR_MODEL: config.model,
  };

  for (const [key, value] of Object.entries(shared)) {
    env[key] = value;
  }

  if (!config.apiKey) return;

  const auth: Record<string, string> = {
    HARNESS_API_KEY: config.apiKey,
    EVALUATOR_API_KEY: config.apiKey,
    LIMINAL_HARNESS_API_KEY: config.apiKey,
    LIMINAL_EVALUATOR_API_KEY: config.apiKey,
  };

  for (const [key, value] of Object.entries(auth)) {
    env[key] = value;
  }

  if (config.provider === 'glm') env.GLM_API_KEY = config.apiKey;
  if (config.provider === 'minimax') env.MINIMAX_API_KEY = config.apiKey;
  if (config.provider === 'openai') env.OPENAI_API_KEY = config.apiKey;
  if (config.provider === 'custom') env.OPENAI_API_KEY = config.apiKey;
  if (config.provider === 'openrouter') env.OPENROUTER_API_KEY = config.apiKey;
  if (config.provider === 'moonshot' || config.provider === 'kimi') {
    env.MOONSHOT_API_KEY = config.apiKey;
    if (config.provider === 'kimi') env.KIMI_API_KEY = config.apiKey;
  }
}
