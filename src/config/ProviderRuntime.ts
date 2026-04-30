export type RuntimeProviderKey = 'custom' | 'minimax' | 'glm' | 'lmstudio' | 'ollama' | 'openrouter' | 'kimi' | 'moonshot';
export type ProviderStatusLabel = RuntimeProviderKey | 'openai' | 'llm' | 'unknown';
export type ProviderAdapterName = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'google' | 'minimax' | 'custom';
export type ProviderVisionSupport = 'yes' | 'no' | 'unknown';

export interface ProviderRuntimeDefaults {
  baseUrl: string;
  model: string;
  label: string;
  requiresKey: boolean;
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
  baseUrl: string;
  model: string;
  apiKey?: string;
  requiresKey: boolean;
  vision: ProviderVisionSupport;
}

export const PROVIDER_ALIASES: Record<string, RuntimeProviderKey> = {
  openai: 'custom',
  gpt: 'custom',
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
  custom: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini', label: 'OpenAI', requiresKey: true },
  minimax: { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7', label: 'MiniMax', requiresKey: true },
  glm: { baseUrl: 'https://api.z.ai/api/anthropic', model: 'GLM-5v-turbo', label: 'GLM', requiresKey: true },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', label: 'LM Studio', requiresKey: false },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2', label: 'Ollama', requiresKey: false },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-5.4-mini', label: 'OpenRouter', requiresKey: true },
  kimi: { baseUrl: 'https://api.kimi.com/coding/v1', model: 'k2p5', label: 'Kimi', requiresKey: true },
  moonshot: { baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k2.5', label: 'Moonshot', requiresKey: true },
};

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

export function resolveProviderAlias(value: string | undefined): RuntimeProviderKey | undefined {
  if (!value) return undefined;
  return PROVIDER_ALIASES[value.toLowerCase()] ?? (isRuntimeProviderKey(value) ? value : undefined);
}

export function isRuntimeProviderKey(value: string): value is RuntimeProviderKey {
  return Object.hasOwn(PROVIDER_DEFAULTS, value);
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

export function detectProviderLabel(baseUrl: string, model = ''): ProviderStatusLabel {
  const lowerUrl = baseUrl.toLowerCase();
  const lowerModel = model.toLowerCase();
  if (lowerUrl.includes('api.openai.com')) return 'openai';
  if (lowerUrl.includes('z.ai') || lowerUrl.includes('bigmodel') || lowerModel.includes('glm')) return 'glm';
  if (lowerUrl.includes('minimax')) return 'minimax';
  if (lowerUrl.includes('openrouter')) return 'openrouter';
  if (lowerUrl.includes('moonshot')) return 'moonshot';
  if (lowerUrl.includes('kimi')) return 'kimi';
  if (lowerUrl.includes(':11434') || lowerUrl.includes('ollama')) return 'ollama';
  if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) return 'lmstudio';
  return baseUrl ? 'llm' : 'unknown';
}

export function detectProviderAdapter(config: { baseUrl: string; model: string }): ProviderAdapterName {
  const baseUrl = config.baseUrl.toLowerCase();
  const model = config.model.toLowerCase();

  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('minimax')) return 'minimax';
  if (baseUrl.includes('api.kimi.com/coding')) return 'anthropic';
  if (baseUrl.includes('anthropic') || baseUrl.includes('api.anthropic')) return 'anthropic';
  if (baseUrl.includes('generativelanguage') || baseUrl.includes('googleapis')) return 'google';
  if (baseUrl.includes(':11434') || baseUrl.includes('ollama')) return 'ollama';
  if (baseUrl.includes('z.ai')) return 'anthropic';
  if (baseUrl.includes('bigmodel.cn')) return 'openai';
  if (baseUrl.includes('moonshot.ai') || baseUrl.includes('moonshot.cn')) return 'openai';
  if (baseUrl.includes('kimi.com')) return 'openai';
  if (baseUrl.includes('openai') || baseUrl.includes('api.openai')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('deepseek-r1')) return 'ollama';
  return 'openai';
}

export function detectRoleProviderType(baseUrl: string, model = ''): ProviderAdapterName {
  return detectProviderAdapter({ baseUrl, model });
}

export function apiKeyEnvNamesForProvider(provider: RuntimeProviderKey | ProviderStatusLabel): string[] {
  switch (provider) {
    case 'minimax': return ['MINIMAX_API_KEY'];
    case 'glm': return ['GLM_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
    case 'openrouter': return ['OPENROUTER_API_KEY'];
    case 'kimi': return ['KIMI_API_KEY', 'MOONSHOT_API_KEY'];
    case 'moonshot': return ['MOONSHOT_API_KEY', 'KIMI_API_KEY'];
    case 'custom':
    case 'openai': return ['OPENAI_API_KEY'];
    default: return [];
  }
}

export function apiKeyEnvNamesForEndpoint(baseUrl: string, model = ''): string[] {
  const lowerUrl = baseUrl.toLowerCase();
  const adapter = detectProviderAdapter({ baseUrl, model });
  if (adapter === 'anthropic' && !lowerUrl.includes('z.ai') && !lowerUrl.includes('kimi')) {
    return ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
  }
  if (adapter === 'google') return ['GOOGLE_API_KEY', 'GEMINI_API_KEY'];
  return apiKeyEnvNamesForProvider(detectProviderLabel(baseUrl, model));
}

export function inferProviderVisionSupport(provider: string, model: string): ProviderVisionSupport {
  const lower = `${provider} ${model}`.toLowerCase();
  if (lower.includes('glm-5v') || lower.includes('glm 5v')) return 'yes';
  if (lower.includes('glm') || lower.includes('minimax') || lower.includes('kimi') || lower.includes('moonshot')) return 'no';
  if (lower.includes('gemini') || lower.includes('gpt-5') || lower.includes('gpt-4o') || lower.includes('claude') || lower.includes('vision') || lower.includes('-vl')) return 'yes';
  return 'unknown';
}

function readEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>, key: string): string | undefined {
  return env[key] || env[`LIMINAL_${key}`];
}

export function resolveProviderRuntime(selection: ProviderRuntimeSelection): ProviderRuntime {
  const defaults = PROVIDER_DEFAULTS[selection.provider];
  const baseUrl = normalizeProviderBaseUrl(selection.provider, selection.configuredBaseUrl);
  const model = selection.model || defaults.model;
  const statusProvider = selection.provider === 'custom' ? 'openai' : selection.provider;
  const env = selection.env ?? process.env;
  const currentMatches = selection.current?.provider === statusProvider || (selection.provider === 'custom' && selection.current?.provider === 'openai');
  const currentApiKey = currentMatches ? selection.current?.apiKey : undefined;
  const envKeys = apiKeyEnvNamesForProvider(selection.provider);
  const providerKey = envKeys.map(key => readEnv(env, key)).find(value => !isPlaceholderApiKey(value));
  const genericKey = firstUsableApiKey(readEnv(env, 'LLM_API_KEY'));
  const apiKey = firstUsableApiKey(selection.configuredApiKey, currentApiKey, providerKey, genericKey);

  return {
    provider: selection.provider,
    statusProvider,
    adapter: detectProviderAdapter({ baseUrl, model }),
    label: defaults.label,
    baseUrl,
    model,
    apiKey,
    requiresKey: defaults.requiresKey,
    vision: inferProviderVisionSupport(statusProvider, model),
  };
}
