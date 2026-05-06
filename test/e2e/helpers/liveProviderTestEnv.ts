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
];

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
  const config = getProviderConfig(provider);
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
