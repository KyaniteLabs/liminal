import { env } from '../utils/env.js';

function readEnvKey(key: string): string | undefined {
  return process.env[key] || env(key);
}

export function apiKeyEnvNamesForEndpoint(baseUrl: string, model = ''): string[] {
  const url = baseUrl.toLowerCase();
  const modelName = model.toLowerCase();

  if (url.includes('minimax')) return ['MINIMAX_API_KEY'];
  if (url.includes('z.ai') || url.includes('bigmodel') || url.includes('glm') || modelName.startsWith('glm')) {
    return ['GLM_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
  }
  if (url.includes('openrouter')) return ['OPENROUTER_API_KEY'];
  if (url.includes('api.kimi.com') || url.includes('kimi.com')) return ['KIMI_API_KEY', 'MOONSHOT_API_KEY'];
  if (url.includes('moonshot')) return ['MOONSHOT_API_KEY', 'KIMI_API_KEY'];
  if (url.includes('api.openai.com') || url.includes('openai')) return ['OPENAI_API_KEY'];
  if (url.includes('api.anthropic.com')) return ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('ollama')) return [];

  return [];
}

export function selectApiKeyForEndpoint(
  baseUrl: string,
  model: string | undefined,
  genericFallbackKeys: string[] = [],
): string | undefined {
  const providerKeys = apiKeyEnvNamesForEndpoint(baseUrl, model);
  const providerKey = providerKeys.map(readEnvKey).find(Boolean);
  if (providerKey) return providerKey;

  return genericFallbackKeys.map(readEnvKey).find(Boolean);
}
