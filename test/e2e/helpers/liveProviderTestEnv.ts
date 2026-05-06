import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { getProviderConfig, type ProviderType } from '../../../src/harness/MultiProviderConfig.js';
import { providerRequiresApiKey } from '../../../src/config/ProviderRuntime.js';

type EnvBackup = Record<string, string | undefined>;

const PROVIDER_ENV_KEYS = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_LLM_API_KEY',
  'LIMINAL_LLM_API_STYLE',
  'OPENAI_API_KEY',
  'MINIMAX_API_KEY',
  'GLM_API_KEY',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ZAI_API_KEY',
];

const GENERIC_LLM_ENV_KEYS = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_LLM_API_KEY',
  'LIMINAL_LLM_API_STYLE',
] as const;

export function backupProviderEnv(extraKeys: string[] = []): EnvBackup {
  return [...PROVIDER_ENV_KEYS, ...extraKeys].reduce<EnvBackup>((backup, key) => {
    backup[key] = process.env[key];
    return backup;
  }, {});
}

export function restoreProviderEnv(backup: EnvBackup): void {
  for (const [key, value] of Object.entries(backup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export function applyProviderEnv(provider: ProviderType, modelOverride?: string): ReturnType<typeof getProviderConfig> {
  const genericBackup = backupProviderEnv([...GENERIC_LLM_ENV_KEYS]);
  for (const key of GENERIC_LLM_ENV_KEYS) {
    delete process.env[key];
  }
  const config = getProviderConfig(provider);
  restoreProviderEnv(genericBackup);
  if (!config) return null;
  if (providerRequiresApiKey(provider) && !config.apiKey) return null;

  process.env.LIMINAL_LLM_PROVIDER = provider;
  process.env.LIMINAL_LLM_BASE_URL = config.baseUrl;
  process.env.LIMINAL_LLM_MODEL = modelOverride ?? config.model;
  process.env.LIMINAL_LLM_API_STYLE = config.apiStyle;
  if (config.apiKey) process.env.LIMINAL_LLM_API_KEY = config.apiKey;
  else delete process.env.LIMINAL_LLM_API_KEY;

  return { ...config, model: modelOverride ?? config.model };
}

export function createLiveProviderClient(provider: ProviderType, modelOverride?: string): {
  config: NonNullable<ReturnType<typeof getProviderConfig>>;
  client: LLMClient;
} | null {
  const config = applyProviderEnv(provider, modelOverride);
  if (!config) return null;
  return {
    config,
    client: new LLMClient({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      apiStyle: config.apiStyle,
      temperature: 0.3,
      maxTokens: 4096,
    }),
  };
}

export async function listLmStudioModels(baseUrl = 'http://localhost:1234/v1'): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) {
    throw new Error(`LM Studio model list failed with ${response.status}`);
  }
  const body = await response.json() as { data?: Array<{ id?: string }> };
  return (body.data ?? []).map(model => model.id).filter((id): id is string => Boolean(id));
}

export async function selectLmStudioModel(patterns: RegExp[]): Promise<string> {
  const models = await listLmStudioModels();
  const selected = patterns
    .map(pattern => models.find(model => pattern.test(model)))
    .find((model): model is string => Boolean(model));
  if (!selected) {
    throw new Error(`No LM Studio model matched ${patterns.map(String).join(', ')}. Available: ${models.join(', ') || 'none'}`);
  }
  return selected;
}

export function createLmStudioClient(model: string): LLMClient {
  const baseUrl = 'http://localhost:1234/v1';
  process.env.LIMINAL_LLM_PROVIDER = 'lmstudio';
  process.env.LIMINAL_LLM_BASE_URL = baseUrl;
  process.env.LIMINAL_LLM_MODEL = model;
  delete process.env.LIMINAL_LLM_API_KEY;

  return new LLMClient({
    baseUrl,
    model,
    temperature: 0.3,
    maxTokens: 1024,
  });
}

export interface IsolatedRunRoot {
  root: string;
  galleryDir: string;
  cleanup(): Promise<void>;
}

export async function createIsolatedRunRoot(prefix: string): Promise<IsolatedRunRoot> {
  const originalCwd = process.cwd();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const galleryDir = 'gallery';
  await fs.mkdir(path.join(root, galleryDir), { recursive: true });

  // run() persists .liminal/project.liminal under process.cwd(); isolate the
  // root per e2e file so parallel provider suites cannot lock one database.
  process.chdir(root);

  return {
    root,
    galleryDir,
    async cleanup() {
      process.chdir(originalCwd);
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
