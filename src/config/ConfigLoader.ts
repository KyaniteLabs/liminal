import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { env } from '../utils/env.js';
import { Logger } from '../utils/Logger.js';
import { SERVICE_DEFAULTS } from '../constants.js';
import { loadRoleConfig } from './RoleConfig.js';
import type { ModelRole, ResolvedRoleConfig } from './RoleConfig.js';

/** Routing mode for multi-model generation */
export type RoutingMode = 'cascade' | 'speculative' | 'ensemble' | 'specialized' | 'thompson';

export interface UserConfig {
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

/** Project config shape (config/liminal.json) */
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
  /** Dual-model configuration for cascade/specialized routing */
  multiModel?: {
    /** Primary/fast model configuration */
    primary?: {
      provider?: string;
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    /** Secondary/powerful model configuration */
    secondary?: {
      provider?: string;
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    /** Routing configuration */
    routing?: {
      mode?: RoutingMode;
      confidenceThreshold?: number;
      primaryConcurrency?: number;
      secondaryConcurrency?: number;
    };
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
  swarm?: {
    ollamaHost?: string;
    maxRounds?: number;
    mode?: 'competitive' | 'hybrid' | 'ring' | 'mesh';
    streamDir?: string;
  };
  scavenger?: {
    scanPaths?: string[];
    outputDir?: string;
    autoRegister?: boolean;
  };
  compost?: {
    heapDir?: string;
    maxHeapSizeBytes?: number;
    digestDir?: string;
    seedDir?: string;
    digestSchedule?: 'manual' | 'daily' | 'weekly';
    soupEnabled?: boolean;
    soupPopulationSize?: number;
    soupMaxStepsPerCycle?: number;
    seedPromotionThreshold?: number;
    nuggetRetentionDays?: number;
  };
  collab?: {
    mode?: 'swarm' | 'phases' | 'simple';
    maxRounds?: number;
    convergenceThreshold?: number;
    domain?: string;
  };
  evolution?: {
    useMapElites?: boolean;
    mapElitesDims?: [number, number];
    useAestheticModel?: boolean;
    stagnationThreshold?: number;
    useArchiveLearning?: boolean;
  };
}

export interface EffectiveConfig {
  /** @deprecated Provider is no longer used - baseUrl determines the endpoint */
  provider?: 'ollama' | 'openai' | 'minimax' | 'lmstudio' | 'hybrid';
  baseUrl?: string;
  model: string;
  apiKey?: string;
}

/** Individual model configuration */
export interface ModelConfig {
  /** @deprecated Provider is no longer used - baseUrl determines the endpoint */
  provider?: 'ollama' | 'openai' | 'minimax' | 'lmstudio';
  baseUrl?: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Multi-model router configuration */
export interface MultiModelConfig {
  /** Primary/fast model (e.g., Qwen3.5-9B for speed) */
  primary: ModelConfig;
  /** Secondary/powerful model (e.g., Qwen3-30B-A3B for reasoning) */
  secondary?: ModelConfig;
  /** How to route requests between models */
  routing: {
    mode: RoutingMode;
    /** Confidence threshold for cascade escalation (0-1) */
    confidenceThreshold?: number;
    /** Maximum concurrent requests for primary model */
    primaryConcurrency?: number;
    /** Maximum concurrent requests for secondary model */
    secondaryConcurrency?: number;
  };
}

const LIMINAL_CONFIG_DIR = '.liminal';
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), LIMINAL_CONFIG_DIR, 'config.json');

const PROJECT_CONFIG_FILENAME = 'liminal.json';

/**
 * Migrate config from legacy ~/.atelier/ to ~/.liminal/ if it exists.
 * Runs once on first load — does not delete the old directory.
 */
async function migrateLegacyConfig(): Promise<void> {
  const legacyPath = path.join(os.homedir(), '.atelier', 'config.json');
  const newPath = DEFAULT_CONFIG_PATH;

  try {
    // Check if legacy config exists without throwing
    try {
      await fs.access(legacyPath);
    } catch {
      // No legacy config exists, skip migration silently
      return;
    }

    // Legacy config exists — check if new config already exists
    try {
      await fs.access(newPath);
      // New config already exists, skip migration
    } catch (accessError) {
      // New config doesn't exist — copy legacy
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.copyFile(legacyPath, newPath);
    }
  } catch (err) {
    Logger.warn('ConfigLoader', 'Config migration failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Load project config from config/liminal.json in the given directory (or path to file).
 * Falls back to config/atelier.json for backward compatibility.
 * @param configDirOrPath - Directory containing config/liminal.json (e.g. cwd), or path to file
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
  } catch (readError) {
    // Fallback: try legacy atelier.json filename
    const legacyPath = projectConfigPath.replace(/liminal\.json$/, 'atelier.json');
    try {
      const content = await fs.readFile(legacyPath, 'utf-8');
      return JSON.parse(content) as ProjectConfig;
    } catch (err) {
      Logger.warn('ConfigLoader', 'Failed to load legacy config:', err);
      return null;
    }
  }
}

/**
 * Load config from JSON file
 * @param configPath Path to config file (defaults to ~/.liminal/config.json)
 * @returns Config object or null if file doesn't exist or is invalid
 */
export async function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<UserConfig | null> {
  // Run migration on first load
  await migrateLegacyConfig();

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as UserConfig;
    return config;
  } catch (err) {
    Logger.warn('ConfigLoader', 'Failed to load config:', err);
    return null;
  }
}

/**
 * Save config to JSON file
 * @param config Config object to save
 * @param configPath Path to config file (defaults to ~/.liminal/config.json)
 */
export async function saveConfig(config: UserConfig, configPath: string = DEFAULT_CONFIG_PATH): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get effective configuration by merging project config (optional), file config, and env vars.
 * Env vars take precedence over file config; project config overrides user file for overlapping keys.
 * @param projectConfigPath - Optional directory or path to load config/liminal.json from
 */
export async function getEffectiveConfig(configPath?: string, projectConfigPath?: string): Promise<EffectiveConfig> {
  const fileConfig = configPath ? await loadConfig(configPath) : await loadConfig();
  const projectConfig = projectConfigPath ? await loadProjectConfig(projectConfigPath) : null;

  // Provider: env > project llm > user file
  const projectProvider = projectConfig?.llm?.provider;
  const providerName = env('LLM_PROVIDER') || projectProvider || fileConfig?.defaultProvider || 'lmstudio';

  // Map provider names (including legacy aliases) to canonical types
  const providerMap: Record<string, 'ollama' | 'openai' | 'minimax' | 'lmstudio' | 'hybrid'> = {
    'lmstudio': 'lmstudio',
    'inception': 'lmstudio',  // Legacy alias — inception used same OpenAI-compatible format
    'ollama': 'ollama',
    'openai': 'openai',
    'anthropic': 'openai',   // Legacy alias — removed provider, route to openai as closest match
    'minimax': 'minimax',
    'hybrid': 'hybrid',
  };

  const provider = providerMap[providerName] || 'lmstudio';

  const fileProviderConfig = fileConfig?.providers?.[providerName] || {};
  const projectLlm = projectConfig?.llm || {};

  return {
    provider,
    baseUrl: env('LLM_BASE_URL') || projectLlm.baseUrl || fileProviderConfig.baseUrl,
    model: env('LLM_MODEL') || projectLlm.model || fileProviderConfig.model || SERVICE_DEFAULTS.DEFAULT_MODEL,
    apiKey: env('LLM_API_KEY') || projectLlm.apiKey || fileProviderConfig.apiKey || process.env.OPENAI_API_KEY || process.env.MINIMAX_API_KEY,
  };
}

/**
 * Load role-based configuration and apply capability overrides to the registry.
 *
 * This is the unified entry point for callers that want the new three-role
 * config system (generator / evaluator / harness). Internally delegates to
 * `loadRoleConfig()` from RoleConfig which handles file merging, env-var
 * fallbacks, and CapabilityRegistry.override() calls.
 *
 * @param projectDir - Optional project directory (defaults to cwd)
 * @returns Resolved config keyed by role, with capability overrides already applied
 */
export async function getEffectiveRoleConfig(
  projectDir?: string,
): Promise<Record<ModelRole, ResolvedRoleConfig>> {
  return loadRoleConfig(projectDir);
}
