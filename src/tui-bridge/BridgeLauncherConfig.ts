import { getActiveProvider, getProviderConfig, type ProviderType } from '../harness/MultiProviderConfig.js';

export interface BridgeProviderConfig {
  provider: ProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export type BridgeRoleName = 'generator' | 'harness' | 'evaluator';
export type BridgeVisionSupport = 'yes' | 'no' | 'unknown';

export interface BridgeRoleStatus {
  role: BridgeRoleName;
  provider: string;
  baseUrl: string;
  model: string;
  source: 'active-provider' | 'role-env' | 'fallback';
  multimodal: BridgeVisionSupport;
  purpose: string;
}

export interface BridgeRuntimeSummary {
  roles: Record<BridgeRoleName, BridgeRoleStatus>;
  evaluation: {
    renderedEvidence: boolean;
    screenshotInput: boolean;
    multimodal: BridgeVisionSupport;
    note: string;
  };
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
  const setDefault = (key: string, value: string): void => {
    if (!env[key]) env[key] = value;
  };

  const shared: Record<string, string> = {
    LLM_PROVIDER: config.provider,
    LLM_BASE_URL: config.baseUrl,
    LLM_MODEL: config.model,
    LIMINAL_LLM_PROVIDER: config.provider,
    LIMINAL_LLM_BASE_URL: config.baseUrl,
    LIMINAL_LLM_MODEL: config.model,
  };

  for (const [key, value] of Object.entries(shared)) {
    env[key] = value;
  }

  const roleDefaults: Record<string, string> = {
    HARNESS_BASE_URL: config.baseUrl,
    HARNESS_MODEL: config.model,
    EVALUATOR_BASE_URL: config.baseUrl,
    EVALUATOR_MODEL: config.model,
    LIMINAL_HARNESS_BASE_URL: config.baseUrl,
    LIMINAL_HARNESS_MODEL: config.model,
    LIMINAL_EVALUATOR_BASE_URL: config.baseUrl,
    LIMINAL_EVALUATOR_MODEL: config.model,
  };

  for (const [key, value] of Object.entries(roleDefaults)) {
    setDefault(key, value);
  }

  if (!config.apiKey) return;

  const auth: Record<string, string> = {
    HARNESS_API_KEY: config.apiKey,
    EVALUATOR_API_KEY: config.apiKey,
    LIMINAL_HARNESS_API_KEY: config.apiKey,
    LIMINAL_EVALUATOR_API_KEY: config.apiKey,
  };

  for (const [key, value] of Object.entries(auth)) {
    setDefault(key, value);
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

export function summarizeBridgeRuntime(env: NodeJS.ProcessEnv = process.env): BridgeRuntimeSummary {
  const generator = roleStatus('generator', env);
  const harness = roleStatus('harness', env, generator);
  const evaluator = roleStatus('evaluator', env, generator);
  const multimodal = evaluator.multimodal;

  return {
    roles: { generator, harness, evaluator },
    evaluation: {
      renderedEvidence: true,
      screenshotInput: true,
      multimodal,
      note: multimodal === 'yes'
        ? 'Rendered screenshots can be sent to the evaluator model.'
        : multimodal === 'no'
          ? 'Rendered screenshots are captured, but this evaluator is not known to be vision-capable.'
          : 'Rendered screenshots are captured, but evaluator vision support is unknown.',
    },
  };
}

function roleStatus(role: BridgeRoleName, env: NodeJS.ProcessEnv, fallback?: BridgeRoleStatus): BridgeRoleStatus {
  const prefix = role === 'generator' ? 'LLM' : role.toUpperCase();
  const liminalPrefix = role === 'generator' ? 'LIMINAL_LLM' : `LIMINAL_${role.toUpperCase()}`;
  const baseUrl = env[`${liminalPrefix}_BASE_URL`] || env[`${prefix}_BASE_URL`] || fallback?.baseUrl || '';
  const model = env[`${liminalPrefix}_MODEL`] || env[`${prefix}_MODEL`] || fallback?.model || 'unknown';
  const explicitProvider = role === 'generator' ? env.LIMINAL_LLM_PROVIDER || env.LLM_PROVIDER : undefined;
  const provider = explicitProvider || inferProvider(baseUrl, model);
  const source =
    role === 'generator'
      ? 'active-provider'
      : env[`${liminalPrefix}_MODEL`] || env[`${prefix}_MODEL`]
        ? 'role-env'
        : 'fallback';

  return {
    role,
    provider,
    baseUrl,
    model,
    source,
    multimodal: inferVisionSupport(provider, model),
    purpose: rolePurpose(role),
  };
}

function inferProvider(baseUrl: string, model: string): string {
  const lowerUrl = baseUrl.toLowerCase();
  const lowerModel = model.toLowerCase();
  if (lowerUrl.includes('openrouter')) return 'openrouter';
  if (lowerUrl.includes('z.ai') || lowerUrl.includes('bigmodel') || lowerModel.includes('glm')) return 'glm';
  if (lowerUrl.includes('minimax')) return 'minimax';
  if (lowerUrl.includes('openai')) return 'openai';
  if (lowerUrl.includes('moonshot')) return 'moonshot';
  if (lowerUrl.includes('kimi')) return 'kimi';
  if (lowerUrl.includes('localhost:11434')) return 'ollama';
  if (lowerUrl.includes('localhost:1234')) return 'lmstudio';
  return lowerUrl ? 'custom' : 'unknown';
}

function inferVisionSupport(provider: string, model: string): BridgeVisionSupport {
  const lower = `${provider} ${model}`.toLowerCase();
  if (lower.includes('glm') || lower.includes('minimax') || lower.includes('kimi') || lower.includes('moonshot')) {
    return 'no';
  }
  if (lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('claude') || lower.includes('vision') || lower.includes('-vl')) {
    return 'yes';
  }
  return 'unknown';
}

function rolePurpose(role: BridgeRoleName): string {
  switch (role) {
    case 'generator':
      return 'Writes the creative code candidates.';
    case 'harness':
      return 'Runs bridge orchestration, repair prompts, and operator actions.';
    case 'evaluator':
      return 'Scores rendered evidence and produces repair advice.';
  }
}
