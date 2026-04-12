/**
 * Multi-Provider Configuration for Meta-Harness
 * 
 * Supports:
 * - MiniMax (cloud)
 * - LM Studio (local)
 * - Ollama (local/cloud)
 * - OpenRouter (cloud)
 * - GLM International Coding Plan API (cloud)
 * 
 * Environment variables:
 * - LIMINAL_LLM_BASE_URL - Default base URL
 * - LIMINAL_LLM_MODEL - Default model
 * - LIMINAL_LLM_API_KEY - Default API key
 * - MINIMAX_API_KEY - MiniMax specific
 * - GLM_API_KEY - GLM specific
 * - OPENROUTER_API_KEY - OpenRouter specific
 */

import type { LLMConfig } from '../llm/LLMClient.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** Read defaultProvider from ~/.liminal/config.json (sync, cached) */
let _cachedDefault: string | null = null;
type ProviderFileConfig = Record<string, { apiKey?: string; baseUrl?: string; model?: string }>;
let _cachedConfig: ProviderFileConfig | null = null;
let _configLoaded = false;

function loadConfigFile(): ProviderFileConfig | null {
  if (_configLoaded) return _cachedConfig;
  try {
    const configPath = path.join(os.homedir(), '.liminal', 'config.json');
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

function getApiKeyFromConfig(provider: string): string | undefined {
  const providers = loadConfigFile();
  return providers?.[provider]?.apiKey;
}

export type ProviderType = 'minimax' | 'lmstudio' | 'ollama' | 'openrouter' | 'glm' | 'moonshot' | 'kimi' | 'custom';

export interface ProviderConfig extends LLMConfig {
  provider: ProviderType;
  name: string;
  description?: string;
}

/**
 * Pre-configured provider templates
 */
export const PROVIDER_TEMPLATES: Record<ProviderType, Omit<ProviderConfig, 'apiKey'>> = {
  minimax: {
    provider: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax M2.7 and other models (Global Token Plan)',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-M2.7',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  lmstudio: {
    provider: 'lmstudio',
    name: 'LM Studio',
    description: 'Local LM Studio server',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  ollama: {
    provider: 'ollama',
    name: 'Ollama',
    description: 'Local Ollama server',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    apiStyle: 'ollama',
    temperature: 0.7,
    maxTokens: 16384,
  },
  openrouter: {
    provider: 'openrouter',
    name: 'OpenRouter',
    description: 'OpenRouter API (access to many models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  glm: {
    provider: 'glm',
    name: 'GLM',
    description: 'GLM International Coding Plan API (GLM-5.1 flagship)',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    model: 'glm-5.1',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  moonshot: {
    provider: 'moonshot',
    name: 'Moonshot AI (Legacy)',
    description: 'Moonshot AI Kimi API',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2.5',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  kimi: {
    provider: 'kimi',
    name: 'Kimi Code',
    description: 'Moonshot AI Kimi Code (K2P5) for Coding Agents',
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'k2p5',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  custom: {
    provider: 'custom',
    name: 'Custom',
    description: 'Custom OpenAI-compatible endpoint',
    baseUrl: 'http://localhost:8000/v1',
    model: 'custom-model',
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
};

/**
 * Get provider configuration with API key from environment
 */
function getProviderConfigInternal(
  provider: ProviderType,
  options: { respectGenericEnvOverrides?: boolean } = {},
): ProviderConfig | null {
  const { respectGenericEnvOverrides = true } = options;
  const template = PROVIDER_TEMPLATES[provider];
  
  // Get API key: env var first, then config file
  let apiKey: string | undefined;
  switch (provider) {
    case 'minimax':
      apiKey = process.env.MINIMAX_API_KEY;
      break;
    case 'glm':
      apiKey = process.env.GLM_API_KEY;
      break;
    case 'moonshot':
    case 'kimi':
      apiKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
      break;
    case 'openrouter':
      apiKey = process.env.OPENROUTER_API_KEY;
      break;
    case 'ollama':
    case 'lmstudio':
      // Local providers don't need API keys
      apiKey = undefined;
      break;
    case 'custom':
      apiKey = process.env.LIMINAL_LLM_API_KEY || process.env.OPENAI_API_KEY;
      break;
  }
  // Fallback: read apiKey from ~/.liminal/config.json providers.<name>.apiKey
  if (!apiKey) {
    apiKey = getApiKeyFromConfig(provider);
  }
  
  // Read baseUrl and model: env var → config file → template default
  const fileProviders = loadConfigFile();
  const fileProvider = fileProviders?.[provider];
  const baseUrl = (respectGenericEnvOverrides ? process.env.LIMINAL_LLM_BASE_URL : undefined) || fileProvider?.baseUrl || template.baseUrl;
  const model = (respectGenericEnvOverrides ? process.env.LIMINAL_LLM_MODEL : undefined) || fileProvider?.model || template.model;
  
  return {
    ...template,
    baseUrl,
    model,
    apiKey,
  };
}

export function getProviderConfig(provider: ProviderType): ProviderConfig | null {
  return getProviderConfigInternal(provider);
}

/**
 * Detect provider from base URL
 */
export function detectProviderFromUrl(baseUrl: string): ProviderType {
  if (baseUrl.includes('minimax')) return 'minimax';
  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('z.ai') || baseUrl.includes('bigmodel') || baseUrl.includes('glm')) return 'glm';
  if (baseUrl.includes('kimi.com')) return 'kimi';
  if (baseUrl.includes('moonshot')) return 'moonshot';
  if (baseUrl.includes('localhost:1234')) return 'lmstudio';
  if (baseUrl.includes('localhost:11434')) return 'ollama';
  return 'custom';
}

/**
 * Get active provider from environment
 */
export function getActiveProvider(): ProviderType {
  const baseUrl = process.env.LIMINAL_LLM_BASE_URL;
  if (baseUrl) {
    return detectProviderFromUrl(baseUrl);
  }

  // Check config file defaultProvider before env var sniffing
  const fileDefault = getDefaultProviderFromConfig();
  if (fileDefault && PROVIDER_TEMPLATES[fileDefault as keyof typeof PROVIDER_TEMPLATES]) {
    return fileDefault as ProviderType;
  }

  // Check for specific API keys
  if (process.env.MINIMAX_API_KEY) return 'minimax';
  if (process.env.GLM_API_KEY) return 'glm';
  if (process.env.MOONSHOT_API_KEY) return 'moonshot';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';

  // Default to Ollama (local)
  return 'ollama';
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: ProviderType): boolean {
  const config = getProviderConfig(provider);
  if (!config) return false;
  
  // Local providers don't need API keys
  if (provider === 'ollama' || provider === 'lmstudio') {
    return true;
  }
  
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
    // Use minimax API key if minimax endpoint
    const isMinimax = harnessBaseUrl.includes('minimax');
    const apiKey = harnessApiKey || 
      (isMinimax ? process.env.MINIMAX_API_KEY : undefined) ||
      process.env.LIMINAL_LLM_API_KEY || 
      process.env.OPENAI_API_KEY;
    
    return {
      baseUrl: harnessBaseUrl,
      model: harnessModel,
      apiKey,
      temperature: harnessTemp ? parseFloat(harnessTemp) : 0.2,
      maxTokens: harnessMaxTokens ? parseInt(harnessMaxTokens) : 4096,
      apiStyle: 'openai',
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
