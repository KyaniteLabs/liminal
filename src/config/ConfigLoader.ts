import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface AtelierConfig {
  defaultProvider: string;
  providers: {
    [key: string]: {
      baseUrl?: string;
      model?: string;
      apiKey?: string;
    };
  };
  /** Optional loop options (GUI / user prefs) */
  loop?: {
    maxIterations?: number;
    timeoutMinutes?: number;
  };
  /** Optional creative options */
  creative?: {
    minQualityScore?: number;
  };
  /** Optional gallery directory name (e.g. "gallery") */
  galleryPath?: string;
}

/** Project config shape (config/atelier.json) */
export interface ProjectConfig {
  name?: string;
  version?: string;
  loop?: {
    maxIterations?: number;
    timeoutMinutes?: number;
    completionPromise?: string;
  };
  llm?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    localFallback?: boolean;
  };
  creative?: {
    defaultFramework?: string;
    evaluationCriteria?: string[];
    minQualityScore?: number;
  };
  gallery?: {
    autoSave?: boolean;
    maxHistoryPerProject?: number;
  };
  renderer?: {
    port?: number;
    screenshotOnIteration?: boolean;
  };
  /** Optional live performance config (MIDI, OSC, sync). Not implemented; load and pass through only. */
  live?: {
    midiOutput?: string;
    oscHost?: string;
    oscPort?: number;
    syncMode?: string;
  };
}

export interface EffectiveConfig {
  provider: 'inception' | 'ollama' | 'openai' | 'anthropic';
  baseUrl?: string;
  model: string;
  apiKey?: string;
}

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.atelier', 'config.json');

const PROJECT_CONFIG_FILENAME = 'atelier.json';

/**
 * Load project config from config/atelier.json in the given directory (or path to file).
 * @param configDirOrPath - Directory containing config/atelier.json (e.g. cwd), or path to atelier.json
 * @returns Project config or null if file doesn't exist or is invalid
 */
export async function loadProjectConfig(configDirOrPath?: string): Promise<ProjectConfig | null> {
  let projectConfigPath: string;
  if (!configDirOrPath) {
    projectConfigPath = path.join(process.cwd(), 'config', PROJECT_CONFIG_FILENAME);
  } else {
    const stat = await fs.stat(configDirOrPath).catch(() => null);
    if (stat?.isDirectory()) {
      projectConfigPath = path.join(configDirOrPath, 'config', PROJECT_CONFIG_FILENAME);
    } else {
      projectConfigPath = configDirOrPath;
    }
  }
  try {
    const content = await fs.readFile(projectConfigPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

/**
 * Load config from JSON file
 * @param configPath Path to config file (defaults to ~/.atelier/config.json)
 * @returns Config object or null if file doesn't exist or is invalid
 */
export async function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<AtelierConfig | null> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as AtelierConfig;
    return config;
  } catch {
    return null;
  }
}

/**
 * Get effective configuration by merging project config (optional), file config, and env vars.
 * Env vars take precedence over file config; project config overrides user file for overlapping keys.
 * @param projectConfigPath - Optional directory or path to load config/atelier.json from
 */
export async function getEffectiveConfig(configPath?: string, projectConfigPath?: string): Promise<EffectiveConfig> {
  const fileConfig = configPath ? await loadConfig(configPath) : await loadConfig();
  const projectConfig = projectConfigPath ? await loadProjectConfig(projectConfigPath) : null;

  // Provider: env > project llm > user file
  const projectProvider = projectConfig?.llm?.provider;
  const providerName = process.env.ATELIER_LLM_PROVIDER || projectProvider || fileConfig?.defaultProvider || 'inception';

  const providerMap: Record<string, 'inception' | 'ollama' | 'openai' | 'anthropic'> = {
    'lmstudio': 'inception',
    'inception': 'inception',
    'ollama': 'ollama',
    'openai': 'openai',
    'anthropic': 'anthropic',
  };

  const provider = providerMap[providerName] || 'inception';

  const fileProviderConfig = fileConfig?.providers?.[providerName] || {};
  const projectLlm = projectConfig?.llm || {};

  return {
    provider,
    baseUrl: process.env.ATELIER_LLM_BASE_URL || projectLlm.baseUrl || fileProviderConfig.baseUrl,
    model: process.env.ATELIER_LLM_MODEL || projectLlm.model || fileProviderConfig.model || 'inception-001',
    apiKey: process.env.ATELIER_LLM_API_KEY || projectLlm.apiKey || fileProviderConfig.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.INCEPTION_API_KEY
  };
}

/**
 * Save config to file
 */
export async function saveConfig(config: AtelierConfig, configPath: string = DEFAULT_CONFIG_PATH): Promise<void> {
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
