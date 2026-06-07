/**
 * Multi-Provider Configuration for Meta-Harness
 * 
 * Supports:
 * - MiniMax (cloud)
 * - OpenAI (cloud)
 * - LM Studio (local)
 * - Ollama (local/cloud)
 * - OpenRouter (cloud)
 * - GLM International Coding Plan API (cloud)
 * - Moonshot/Kimi (cloud)
 * - Custom OpenAI-compatible endpoints
 * 
 * Environment variables:
 * - LIMINAL_LLM_BASE_URL - Default base URL
 * - LIMINAL_LLM_MODEL - Default model
 * - LIMINAL_LLM_API_KEY - Default API key
 * - MINIMAX_API_KEY - MiniMax specific
 * - GLM_API_KEY - GLM specific
 * - OPENAI_API_KEY - OpenAI specific
 * - OPENROUTER_API_KEY - OpenRouter specific
 * - MOONSHOT_API_KEY / KIMI_API_KEY - Moonshot/Kimi specific
 */

import type { LLMConfig } from '../llm/LLMClient.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  PROVIDER_DEFAULTS,
  PROVIDER_ORDER,
  apiKeyEnvNamesForProvider,
  detectRuntimeProviderFromUrl,
  firstUsableApiKey,
  providerRequiresApiKey,
  resolveProviderAlias,
  resolveProviderRuntime,
  selectRuntimeApiKey,
  type RuntimeProviderKey,
} from '../config/ProviderRuntime.js';

/** Read defaultProvider from ~/.sinter/config.json (sync, cached) */
let _cachedDefault: string | null = null;
type ProviderFileConfig = Record<string, { apiKey?: string; baseUrl?: string; model?: string }>;
let _cachedConfig: ProviderFileConfig | null = null;
let _configLoaded = false;

function loadConfigFile(): ProviderFileConfig | null {
  if (_configLoaded) return _cachedConfig;
  try {
    const configPath = path.join(os.homedir(), '.sinter', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    _cachedConfig = parsed.providers || null;
    _cachedDefault = parsed.defaultProvider || null;
  } catch {
    _cachedConfig = null;
  }
  _configLoaded = true;
  return _cachedConfig;
}

/** @internal Reset config file cache for test isolation */
export function _resetConfigCache(): void {
  _cachedDefault = null;
  _cachedConfig = null;
  _configLoaded = false;
}

function getDefaultProviderFromConfig(): string | null {
  if (!_configLoaded) loadConfigFile();
  return _cachedDefault;
}

export type ProviderType = RuntimeProviderKey;

export interface ProviderConfig extends LLMConfig {
  provider: ProviderType;
  name: string;
  description?: string;
}

/**
 * Pre-configured provider templates.
 *
 * The provider/runtime truth lives in ProviderRuntime.ts. This export remains
 * for callers that need the legacy harness template shape.
 */
export const PROVIDER_TEMPLATES: Record<ProviderType, Omit<ProviderConfig, 'apiKey'>> = Object.fromEntries(
  PROVIDER_ORDER.map((provider) => {
    const runtime = PROVIDER_DEFAULTS[provider];
    return [provider, {
      provider,
      name: runtime.label,
      description: runtime.description,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      apiStyle: runtime.apiStyle,
      temperature: runtime.temperature,
      maxTokens: runtime.maxTokens,
    } satisfies Omit<ProviderConfig, 'apiKey'>];
  }),
) as Record<ProviderType, Omit<ProviderConfig, 'apiKey'>>;

/**
 * Get provider configuration with API key from environment
 */
function getProviderConfigInternal(
  provider: ProviderType,
  options: { respectGenericEnvOverrides?: boolean } = {},
): ProviderConfig | null {
  const { respectGenericEnvOverrides = true } = options;
  const template = PROVIDER_TEMPLATES[provider];
  const fileProviders = loadConfigFile();
  const fileProvider = fileProviders?.[provider];
  const configuredBaseUrl = (respectGenericEnvOverrides ? process.env.LIMINAL_LLM_BASE_URL : undefined) || fileProvider?.baseUrl;
  const model = (respectGenericEnvOverrides ? process.env.LIMINAL_LLM_MODEL : undefined) || fileProvider?.model;

  const runtime = resolveProviderRuntime({
    provider,
    configuredBaseUrl,
    model,
    configuredApiKey: fileProvider?.apiKey,
  });
  const apiKey = selectRuntimeApiKey({
    provider,
    baseUrl: runtime.baseUrl,
    model: runtime.model,
    configuredApiKey: fileProvider?.apiKey,
    genericFirst: provider === 'custom',
  });

  return {
    ...template,
    baseUrl: runtime.baseUrl,
    model: runtime.model,
    apiKey,
    apiStyle: runtime.apiStyle,
    temperature: runtime.temperature,
    maxTokens: runtime.maxTokens,
  };
}

export function getProviderConfig(provider: ProviderType): ProviderConfig | null {
  return getProviderConfigInternal(provider);
}

/**
 * Detect provider from base URL.
 */
export function detectProviderFromUrl(baseUrl: string): ProviderType {
  return detectRuntimeProviderFromUrl(baseUrl);
}

/**
 * Get active provider from environment.
 */
export function getActiveProvider(): ProviderType {
  const baseUrl = process.env.LIMINAL_LLM_BASE_URL;
  if (baseUrl) {
    return detectProviderFromUrl(baseUrl);
  }

  const explicitProvider = resolveProviderAlias(process.env.LIMINAL_LLM_PROVIDER);
  if (explicitProvider) return explicitProvider;

  // Check config file defaultProvider before env var sniffing
  const fileDefault = resolveProviderAlias(getDefaultProviderFromConfig() ?? undefined);
  if (fileDefault) return fileDefault;

  // Check for specific API keys. Preserve legacy preference order.
  const keyedProviders: ProviderType[] = ['minimax', 'glm', 'moonshot', 'kimi', 'openrouter', 'openai'];
  for (const provider of keyedProviders) {
    const apiKey = firstUsableApiKey(...apiKeyEnvNamesForProvider(provider).map((key) => process.env[key]));
    if (apiKey) return provider;
  }

  // Default to Ollama (local)
  return 'ollama';
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: ProviderType): boolean {
  const config = getProviderConfig(provider);
  if (!config) return false;
  if (!providerRequiresApiKey(provider)) return true;
  return !!config.apiKey;
}

/**
 * List all configured providers
 */
export function listConfiguredProviders(): ProviderType[] {
  return (Object.keys(PROVIDER_TEMPLATES) as ProviderType[]).filter(isProviderConfigured);
}

/**
 * Get LLMConfig for the active provider
 */
export function getActiveProviderConfig(): LLMConfig | null {
  const provider = getActiveProvider();
  const config = getProviderConfig(provider);
  if (!config) return null;
  
  // Destructure to remove extra fields not in LLMConfig
  const { provider: _, name: _name, description: _description, ...llmConfig } = config;
  return llmConfig;
}

// ------------------------------------------------------------------------------
// Harness-Specific Configuration
// Used by Meta-Harness for code fixes (lower temperature for precision)
// ------------------------------------------------------------------------------

export interface HarnessLLMConfig {
  /** Temperature for code fixes (default: 0.2 for precision) */
  temperature: number;
  /** Max tokens for code generation (default: 4096) */
  maxTokens: number;
  /** Request timeout in ms (default: 60000) */
  timeoutMs: number;
  /** Max retries for failed requests (default: 3) */
  maxRetries: number;
  /** Context window size (default: 8192) */
  contextWindow: number;
}

// Default harness config values (used when env vars not set)
const HARNESS_DEFAULTS = {
  temperature: 0.2,      // Low temp for precise code fixes
  maxTokens: 16384,      // Generous budget for complex code fixes
  timeoutMs: 120000,     // 2 minute timeout (cloud providers can be slow)
  maxRetries: 3,         // Retry failed requests
  contextWindow: 32768,  // Generous context for large files
} as const;

/**
 * Get harness-specific LLM configuration
 * Reads from environment variables with defaults
 */
export function getHarnessLLMConfig(): HarnessLLMConfig {
  return {
    temperature: parseFloat(process.env.LIMINAL_HARNESS_TEMPERATURE || String(HARNESS_DEFAULTS.temperature)),
    maxTokens: parseInt(process.env.LIMINAL_HARNESS_MAX_TOKENS || String(HARNESS_DEFAULTS.maxTokens), 10),
    timeoutMs: parseInt(process.env.LIMINAL_HARNESS_TIMEOUT || String(HARNESS_DEFAULTS.timeoutMs), 10),
    maxRetries: parseInt(process.env.LIMINAL_HARNESS_MAX_RETRIES || String(HARNESS_DEFAULTS.maxRetries), 10),
    contextWindow: parseInt(process.env.LIMINAL_HARNESS_CONTEXT_WINDOW || String(HARNESS_DEFAULTS.contextWindow), 10),
  };
}

/**
 * Get LLMConfig for harness use (applies harness-specific overrides)
 * 
 * Supports separate harness provider via environment variables:
 * - LIMINAL_HARNESS_BASE_URL - Separate base URL for harness
 * - LIMINAL_HARNESS_MODEL - Separate model for harness
 * - LIMINAL_HARNESS_API_KEY - Separate API key for harness
 * 
 * Falls back to active provider if harness-specific config not set.
 */
export function getHarnessProviderConfig(): LLMConfig | null {
  // Check for separate harness provider configuration
  const harnessBaseUrl = process.env.LIMINAL_HARNESS_BASE_URL;
  const harnessModel = process.env.LIMINAL_HARNESS_MODEL;
  const harnessApiKey = process.env.LIMINAL_HARNESS_API_KEY;
  const harnessTemp = process.env.LIMINAL_HARNESS_TEMPERATURE;
  const harnessMaxTokens = process.env.LIMINAL_HARNESS_MAX_TOKENS;
  
  // If harness-specific config exists, use it
  if (harnessBaseUrl && harnessModel) {
    const provider = detectProviderFromUrl(harnessBaseUrl);
    const runtime = resolveProviderRuntime({
      provider,
      configuredBaseUrl: harnessBaseUrl,
      model: harnessModel,
      configuredApiKey: harnessApiKey,
    });
    const apiKey = selectRuntimeApiKey({
      provider,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      configuredApiKey: harnessApiKey,
      genericFallbackKeys: ['HARNESS_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY'],
    });

    return {
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      apiKey,
      temperature: harnessTemp ? parseFloat(harnessTemp) : 0.2,
      maxTokens: harnessMaxTokens ? parseInt(harnessMaxTokens, 10) : 4096,
      apiStyle: runtime.apiStyle,
    };
  }
  
  // Otherwise fall back to active provider with harness overrides
  const activeProvider = getActiveProvider();
  const selectedProvider = activeProvider === 'openrouter' ? 'lmstudio' : activeProvider;
  const baseConfig = selectedProvider === activeProvider
    ? getActiveProviderConfig()
    : getProviderConfigInternal(selectedProvider, { respectGenericEnvOverrides: false });
  if (!baseConfig) return null;
  
  const harnessConfig = getHarnessLLMConfig();
  
  return {
    ...baseConfig,
    temperature: harnessConfig.temperature,
    maxTokens: harnessConfig.maxTokens,
  };
}
