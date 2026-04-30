import { apiKeyEnvNamesForEndpoint as runtimeApiKeyEnvNamesForEndpoint } from './ProviderRuntime.js';
import { env } from '../utils/env.js';

function readEnvKey(key: string): string | undefined {
  return process.env[key] || env(key);
}

export function apiKeyEnvNamesForEndpoint(baseUrl: string, model = ''): string[] {
  return runtimeApiKeyEnvNamesForEndpoint(baseUrl, model);
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
