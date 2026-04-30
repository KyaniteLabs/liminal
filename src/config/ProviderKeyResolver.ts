import {
  apiKeyEnvNamesForEndpoint as runtimeApiKeyEnvNamesForEndpoint,
  readRuntimeEnv,
  selectRuntimeApiKey,
} from './ProviderRuntime.js';

export function apiKeyEnvNamesForEndpoint(baseUrl: string, model = ''): string[] {
  return runtimeApiKeyEnvNamesForEndpoint(baseUrl, model);
}

export function selectApiKeyForEndpoint(
  baseUrl: string,
  model: string | undefined,
  genericFallbackKeys: string[] = [],
): string | undefined {
  return selectRuntimeApiKey({
    baseUrl,
    model,
    genericFallbackKeys,
  });
}

export function readProviderEnvKey(key: string): string | undefined {
  return readRuntimeEnv(process.env, key);
}
