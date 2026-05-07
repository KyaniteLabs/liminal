import type { LLMConfig } from '../llm/LLMClient.js';

export type RuntimeProviderKey = 'custom' | 'openai' | 'minimax' | 'glm' | 'lmstudio' | 'ollama' | 'openrouter' | 'kimi' | 'moonshot';
export type ProviderStatusLabel = RuntimeProviderKey | 'llm' | 'unknown';
export type ProviderAdapterName = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'google' | 'minimax' | 'custom';
export type ProviderApiStyle = NonNullable<LLMConfig['apiStyle']>;
export type ProviderVisionSupport = 'yes' | 'no' | 'unknown';

export interface ProviderRuntimeDefaults {
  baseUrl: string;
  model: string;
  label: string;
  description: string;
  requiresKey: boolean;
  apiStyle: ProviderApiStyle;
  temperature: number;
  maxTokens: number;
}

export interface ProviderRuntimeSelection {
  provider: RuntimeProviderKey;
  model?: string;
  configuredBaseUrl?: string;
  configuredApiKey?: string;
  current?: {
    provider?: string;
    apiKey?: string;
  };
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export interface ProviderRuntime {
  provider: RuntimeProviderKey;
  statusProvider: ProviderStatusLabel;
  adapter: ProviderAdapterName;
  label: string;
  description: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  requiresKey: boolean;
  apiStyle: ProviderApiStyle;
  temperature: number;
  maxTokens: number;
  vision: ProviderVisionSupport;
}

export const PROVIDER_ALIASES: Record<string, RuntimeProviderKey> = {
  openai: 'openai',
  gpt: 'openai',
  custom: 'custom',
  minimax: 'minimax',
  mini: 'minimax',
  glm: 'glm',
  z: 'glm',
  lmstudio: 'lmstudio',
  lm: 'lmstudio',
  local: 'lmstudio',
  ollama: 'ollama',
  openrouter: 'openrouter',
  or: 'openrouter',
  kimi: 'kimi',
  moonshot: 'moonshot',
};

export const PROVIDER_DEFAULTS: Record<RuntimeProviderKey, ProviderRuntimeDefaults> = {
  custom: {
    baseUrl: 'http://localhost:8000/v1',
    model: 'custom-model',
    label: 'Custom',
    description: 'Custom OpenAI-compatible endpoint',
    requiresKey: true,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    label: 'OpenAI',
    description: 'OpenAI API (OpenAI-compatible chat completions)',
    requiresKey: true,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  minimax: {
    baseUrl: 'https://api.minimax.io/anthropic',
    model: 'MiniMax-M2.7',
    label: 'MiniMax',
    description: 'MiniMax M2.7 and other models (Global Token Plan, Anthropic-compatible)',
    requiresKey: true,
    apiStyle: 'anthropic',
    temperature: 0.7,
    maxTokens: 16384,
  },
  glm: {
    baseUrl: 'https://api.z.ai/api/anthropic',
    model: 'GLM-5v-turbo',
    label: 'GLM',
    description: 'GLM International API (GLM-5v-turbo multimodal, Anthropic-compatible)',
    requiresKey: true,
    apiStyle: 'anthropic',
    temperature: 0.7,
    maxTokens: 16384,
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    label: 'LM Studio',
    description: 'Local LM Studio server',
    requiresKey: false,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    label: 'Ollama',
    description: 'Local Ollama server',
    requiresKey: false,
    apiStyle: 'ollama',
    temperature: 0.7,
    maxTokens: 16384,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    label: 'OpenRouter',
    description: 'OpenRouter API (access to many models)',
    requiresKey: true,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  kimi: {
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'k2p5',
    label: 'Kimi Code',
    description: 'Moonshot AI Kimi Code (K2P5) for Coding Agents',
    requiresKey: true,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2.5',
    label: 'Moonshot AI (Legacy)',
    description: 'Moonshot AI Kimi API',
    requiresKey: true,
    apiStyle: 'openai',
    temperature: 0.7,
    maxTokens: 16384,
  },
};

export const PROVIDER_ORDER: RuntimeProviderKey[] = [
  'minimax',
  'lmstudio',
  'ollama',
  'openai',
  'openrouter',
  'glm',
  'moonshot',
  'kimi',
  'custom',
];

const PLACEHOLDER_API_KEY_PATTERNS = [
  /^YOUR[_-]/i,
  /_HERE$/i,
  /PLACEHOLDER/i,
  /CHANGE[_-]?ME/i,
  /^sk-your/i,
  /^<.*>$/,
] as const;

export function isPlaceholderApiKey(value?: string): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_API_KEY_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function firstUsableApiKey(...values: Array<string | undefined>): string | undefined {
  return values.find(value => !isPlaceholderApiKey(value));
}

export function readRuntimeEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
): string | undefined {
  return env[key] || env[`LIMINAL_${key}`];
}

export function resolveProviderAlias(value: string | undefined): RuntimeProviderKey | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return PROVIDER_ALIASES[normalized] ?? (isRuntimeProviderKey(normalized) ? normalized : undefined);
}

export function isRuntimeProviderKey(value: string): value is RuntimeProviderKey {
  return Object.hasOwn(PROVIDER_DEFAULTS, value);
}

export function providerRequiresApiKey(provider: RuntimeProviderKey | ProviderStatusLabel): boolean {
  return isRuntimeProviderKey(provider) ? PROVIDER_DEFAULTS[provider].requiresKey : false;
}

export function normalizeProviderBaseUrl(
  provider: RuntimeProviderKey,
  configuredBaseUrl?: string,
): string {
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!configuredBaseUrl) return defaults.baseUrl;

  const lower = configuredBaseUrl.toLowerCase().replace(/\/+$/, '');
  if (provider === 'glm' && lower.includes('api.z.ai/api/coding/paas')) return defaults.baseUrl;
  if (provider === 'minimax' && lower === 'https://api.minimax.io/v1') return defaults.baseUrl;
  return configuredBaseUrl;
}

function endpointHost(baseUrl: string): string {
  try {
    return new URL(baseUrl.toLowerCase()).hostname;
  } catch {
    return '';
  }
}

export function detectProviderLabel(baseUrl: string, model = ''): ProviderStatusLabel {
  const lowerUrl = baseUrl.toLowerCase();
  const lowerModel = model.toLowerCase();
  const host = endpointHost(baseUrl);
  if (host === 'api.openai.com') return 'openai';
  if (lowerUrl.includes('z.ai') || lowerUrl.includes('bigmodel') || lowerUrl.includes('glm') || lowerModel.includes('glm')) return 'glm';
  if (lowerUrl.includes('minimax') || lowerUrl.includes('minimaxi')) return 'minimax';
  if (lowerUrl.includes('openrouter')) return 'openrouter';
  if (lowerUrl.includes('moonshot')) return 'moonshot';
  if (lowerUrl.includes('kimi')) return 'kimi';
  if (lowerUrl.includes(':11434') || lowerUrl.includes('ollama')) return 'ollama';
  if (lowerUrl.includes('localhost:1234') || lowerUrl.includes('127.0.0.1:1234')) return 'lmstudio';
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'lmstudio';
  return baseUrl ? 'llm' : 'unknown';
}

export function detectRuntimeProviderFromUrl(baseUrl: string, model = ''): RuntimeProviderKey {
  const lowerUrl = baseUrl.toLowerCase();
  const host = endpointHost(baseUrl);
  const lowerModel = model.toLowerCase();
  if (lowerUrl.includes('minimax') || lowerUrl.includes('minimaxi')) return 'minimax';
  if (lowerUrl.includes('openrouter')) return 'openrouter';
  if (host === 'api.openai.com') return 'openai';
  if (lowerUrl.includes('z.ai') || lowerUrl.includes('bigmodel') || lowerUrl.includes('glm') || lowerModel.includes('glm')) return 'glm';
  if (lowerUrl.includes('api.kimi.com') || lowerUrl.includes('kimi.com')) return 'kimi';
  if (lowerUrl.includes('moonshot')) return 'moonshot';
  if (lowerUrl.includes(':11434') || lowerUrl.includes('ollama')) return 'ollama';
  if (lowerUrl.includes('localhost:1234') || lowerUrl.includes('127.0.0.1:1234')) return 'lmstudio';
  return 'custom';
}

export function detectProviderAdapter(config: { baseUrl: string; model: string }): ProviderAdapterName {
  const baseUrl = config.baseUrl.toLowerCase();
  const model = config.model.toLowerCase();

  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('minimax') || baseUrl.includes('minimaxi')) return 'minimax';
  if (baseUrl.includes('anthropic') || baseUrl.includes('api.anthropic')) return 'anthropic';
  if (baseUrl.includes('generativelanguage') || baseUrl.includes('googleapis')) return 'google';
  if (baseUrl.includes(':11434') || baseUrl.includes('ollama')) return 'ollama';
  if (baseUrl.includes('z.ai')) return 'anthropic';
  if (baseUrl.includes('bigmodel.cn')) return 'openai';
  if (baseUrl.includes('moonshot.ai') || baseUrl.includes('moonshot.cn')) return 'openai';
  if (baseUrl.includes('kimi.com')) return 'openai';
  if (endpointHost(baseUrl) === 'api.openai.com') return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('deepseek-r1')) return 'ollama';
  return 'openai';
}

export function detectRoleProviderType(baseUrl: string, model = ''): ProviderAdapterName {
  return detectProviderAdapter({ baseUrl, model });
}

export function apiStyleForEndpoint(baseUrl: string, provider?: RuntimeProviderKey): ProviderApiStyle {
  const lowerUrl = baseUrl.toLowerCase();
  if (lowerUrl.includes(':11434') || lowerUrl.includes('ollama')) return 'ollama';
  if (
    lowerUrl.includes('/anthropic')
    || lowerUrl.includes('api.anthropic')
  ) {
    return 'anthropic';
  }
  if (provider && PROVIDER_DEFAULTS[provider].apiStyle === 'ollama') return 'ollama';
  return 'openai';
}

export function apiKeyEnvNamesForProvider(provider: RuntimeProviderKey | ProviderStatusLabel): string[] {
  switch (provider) {
    case 'minimax': return ['MINIMAX_API_KEY'];
    case 'glm': return ['GLM_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
    case 'openrouter': return ['OPENROUTER_API_KEY'];
    case 'kimi': return ['KIMI_API_KEY', 'MOONSHOT_API_KEY'];
    // Moonshot and Kimi have shared operator setups in the wild; keep
    // KIMI_API_KEY as a compatibility fallback for renamed moonshot configs.
    case 'moonshot': return ['MOONSHOT_API_KEY', 'KIMI_API_KEY'];
    case 'custom':
    case 'openai': return ['OPENAI_API_KEY'];
    default: return [];
  }
}

export function apiKeyEnvNamesForEndpoint(baseUrl: string, model = ''): string[] {
  const lowerUrl = baseUrl.toLowerCase();
  const adapter = detectProviderAdapter({ baseUrl, model });
  if (adapter === 'anthropic' && !lowerUrl.includes('z.ai') && !lowerUrl.includes('kimi') && !lowerUrl.includes('minimax')) {
    return ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
  }
  if (adapter === 'google') return ['GOOGLE_API_KEY', 'GEMINI_API_KEY'];
  return apiKeyEnvNamesForProvider(detectProviderLabel(baseUrl, model));
}

export function selectRuntimeApiKey(args: {
  provider?: RuntimeProviderKey | ProviderStatusLabel;
  baseUrl: string;
  model?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  configuredApiKey?: string;
  currentApiKey?: string;
  genericFallbackKeys?: string[];
  /**
   * Prefer generic Liminal keys over provider-specific keys for user-facing
   * default config. Endpoint-specific callers should keep the default false.
   */
  genericFirst?: boolean;
}): string | undefined {
  const env = args.env ?? process.env;
  const providerKeys = args.provider ? apiKeyEnvNamesForProvider(args.provider) : [];
  const endpointKeys = apiKeyEnvNamesForEndpoint(args.baseUrl, args.model);
  const genericKeys = args.genericFallbackKeys ?? ['LLM_API_KEY'];
  const providerValues = [
    ...providerKeys.map(key => readRuntimeEnv(env, key)),
    ...endpointKeys.map(key => readRuntimeEnv(env, key)),
  ];
  const genericValues = genericKeys.map(key => readRuntimeEnv(env, key));
  const values = [
    args.configuredApiKey,
    args.currentApiKey,
    ...(args.genericFirst ? genericValues : providerValues),
    ...(args.genericFirst ? providerValues : genericValues),
  ];
  return firstUsableApiKey(...values);
}

export function inferProviderVisionSupport(provider: string, model: string): ProviderVisionSupport {
  const lower = `${provider} ${model}`.toLowerCase();
  if (lower.includes('glm-5v') || lower.includes('glm 5v')) return 'yes';
  if (lower.includes('glm') || lower.includes('minimax') || lower.includes('kimi') || lower.includes('moonshot')) return 'no';
  if (lower.includes('gemini') || lower.includes('gpt-5') || lower.includes('gpt-4o') || lower.includes('claude') || lower.includes('vision') || lower.includes('-vl')) return 'yes';
  return 'unknown';
}

function statusProviderFor(provider: RuntimeProviderKey, baseUrl: string, model: string): ProviderStatusLabel {
  if (provider !== 'custom') return provider;
  const detected = detectRuntimeProviderFromUrl(baseUrl, model);
  return detected === 'custom' ? 'custom' : detected;
}

export function resolveProviderRuntime(selection: ProviderRuntimeSelection): ProviderRuntime {
  const defaults = PROVIDER_DEFAULTS[selection.provider];
  const baseUrl = normalizeProviderBaseUrl(selection.provider, selection.configuredBaseUrl);
  const model = selection.model || defaults.model;
  const statusProvider = statusProviderFor(selection.provider, baseUrl, model);
  const currentMatches = selection.current?.provider === statusProvider || selection.current?.provider === selection.provider;
  const currentApiKey = currentMatches ? selection.current?.apiKey : undefined;
  const apiKey = selectRuntimeApiKey({
    provider: selection.provider,
    baseUrl,
    model,
    env: selection.env,
    configuredApiKey: selection.configuredApiKey,
    currentApiKey,
  });

  return {
    provider: selection.provider,
    statusProvider,
    adapter: detectProviderAdapter({ baseUrl, model }),
    label: defaults.label,
    description: defaults.description,
    baseUrl,
    model,
    apiKey,
    requiresKey: defaults.requiresKey,
    apiStyle: apiStyleForEndpoint(baseUrl, selection.provider),
    temperature: defaults.temperature,
    maxTokens: defaults.maxTokens,
    vision: inferProviderVisionSupport(statusProvider, model),
  };
}
