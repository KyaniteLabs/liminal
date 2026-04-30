import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getActiveProvider, getProviderConfig, type ProviderType } from '../harness/MultiProviderConfig.js';
import {
  apiKeyEnvNamesForProvider,
  detectProviderLabel,
  inferProviderVisionSupport,
  providerRequiresApiKey,
} from '../config/ProviderRuntime.js';

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

interface PersistedBridgeRoleConfig {
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export function resolveBridgeProviderConfig(): BridgeProviderConfig {
  const provider = getActiveProvider();
  const config = getProviderConfig(provider);

  if (!config) {
    throw new Error(`No provider config found for ${provider}`);
  }

  if (providerRequiresApiKey(provider) && !config.apiKey) {
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
  const explicitRoleEnv = {
    generator: hasAnyEnv(env, ['LLM_BASE_URL', 'LLM_MODEL', 'LIMINAL_LLM_BASE_URL', 'LIMINAL_LLM_MODEL']),
    harness: hasAnyEnv(env, ['HARNESS_BASE_URL', 'HARNESS_MODEL', 'LIMINAL_HARNESS_BASE_URL', 'LIMINAL_HARNESS_MODEL']),
    evaluator: hasAnyEnv(env, ['EVALUATOR_BASE_URL', 'EVALUATOR_MODEL', 'LIMINAL_EVALUATOR_BASE_URL', 'LIMINAL_EVALUATOR_MODEL']),
  };
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

  if (config.apiKey) {
    const auth: Record<string, string> = {
      HARNESS_API_KEY: config.apiKey,
      EVALUATOR_API_KEY: config.apiKey,
      LIMINAL_HARNESS_API_KEY: config.apiKey,
      LIMINAL_EVALUATOR_API_KEY: config.apiKey,
    };

    for (const [key, value] of Object.entries(auth)) {
      setDefault(key, value);
    }

    applyProviderApiKey(env, config.provider, config.apiKey, true);
  }

  const persistedRoles = loadPersistedBridgeRoles();
  for (const role of ['generator', 'harness', 'evaluator'] as const) {
    const roleConfig = persistedRoles[role];
    if (!roleConfig || explicitRoleEnv[role]) continue;
    applyRoleEnv(env, role, roleConfig, true);
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
  const label = detectProviderLabel(baseUrl, model);
  return label === 'llm' ? 'custom' : label;
}

function inferVisionSupport(provider: string, model: string): BridgeVisionSupport {
  return inferProviderVisionSupport(provider, model);
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

function hasAnyEnv(env: NodeJS.ProcessEnv, keys: string[]): boolean {
  return keys.some((key) => Boolean(env[key]));
}

function loadPersistedBridgeRoles(): Partial<Record<BridgeRoleName, PersistedBridgeRoleConfig>> {
  try {
    const configPath = process.env.LIMINAL_CONFIG_PATH || path.join(os.homedir(), '.liminal', 'config.json');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      roles?: Partial<Record<BridgeRoleName, PersistedBridgeRoleConfig>>;
    };
    return parsed.roles ?? {};
  } catch {
    return {};
  }
}

function applyRoleEnv(
  env: NodeJS.ProcessEnv,
  role: BridgeRoleName,
  config: PersistedBridgeRoleConfig,
  overwrite: boolean,
): void {
  const prefix = role === 'generator' ? 'LLM' : role.toUpperCase();
  const liminalPrefix = role === 'generator' ? 'LIMINAL_LLM' : `LIMINAL_${role.toUpperCase()}`;
  setEnvValue(env, `${prefix}_BASE_URL`, config.baseUrl, overwrite);
  setEnvValue(env, `${prefix}_MODEL`, config.model, overwrite);
  setEnvValue(env, `${liminalPrefix}_BASE_URL`, config.baseUrl, overwrite);
  setEnvValue(env, `${liminalPrefix}_MODEL`, config.model, overwrite);
  if (role === 'generator') {
    setEnvValue(env, 'LLM_PROVIDER', config.provider, overwrite);
    setEnvValue(env, 'LIMINAL_LLM_PROVIDER', config.provider, overwrite);
  }
  setEnvValue(env, `${prefix}_API_KEY`, config.apiKey, overwrite);
  setEnvValue(env, `${liminalPrefix}_API_KEY`, config.apiKey, overwrite);
}

function setEnvValue(env: NodeJS.ProcessEnv, key: string, value: string | undefined, overwrite: boolean): void {
  if (!value) return;
  if (overwrite || !env[key]) env[key] = value;
}

function applyProviderApiKey(env: NodeJS.ProcessEnv, provider: string, apiKey: string | undefined, overwrite: boolean): void {
  if (!apiKey) return;
  for (const key of apiKeyEnvNamesForProvider(provider as ProviderType)) {
    setEnvValue(env, key, apiKey, overwrite);
  }
}
