/**
 * RoleConfig - Three-role model configuration for model-agnostic LLM routing
 *
 * Each role (Generator, Evaluator, Harness) is independently configurable
 * with its own provider, model, and parameters. Config is loaded from:
 *   1. ~/.liminal/config.json (user-level)
 *   2. ./config/liminal.json (project-level)
 *   3. Environment variables (backward compatible)
 *   4. Conservative defaults
 *
 * Priority: Project config > User config > Env vars > Defaults
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { env } from '../utils/env.js';
import { CapabilityRegistry } from '../llm/CapabilityRegistry.js';
import { Logger } from '../utils/Logger.js';
import type { ModelCapabilities } from '../llm/CapabilityRegistry.js';
import type { ThinkingConfig } from '../llm/ProviderTypes.js';
import { getEffectiveConfig } from './ConfigLoader.js';

// ── Types ──

export type ModelRole = 'generator' | 'evaluator' | 'harness';
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'openrouter' | 'google' | 'minimax';

export interface RoleProviderConfig {
  /** Provider type — auto-detected from baseUrl if omitted */
  provider?: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  thinking?: ThinkingConfig;
  streaming?: boolean;
}

export interface EvolutionTunables {
  enabled?: boolean;
  temperatureRange?: { min: number; max: number };
  maxTokensRange?: { min: number; max: number };
  mutationRate?: number;
}

export interface RoleConfigFile {
  roles: {
    generator: RoleProviderConfig;
    evaluator?: RoleProviderConfig;
    harness?: RoleProviderConfig;
  };
  /** Fallback chain per role — try these if primary fails */
  fallbacks?: Partial<Record<ModelRole, RoleProviderConfig[]>>;
  /** Capability overrides — takes priority over static CapabilityRegistry */
  capabilities?: Record<string, Partial<ModelCapabilities>>;
  /** Evolution tuning parameters */
  evolution?: EvolutionTunables;
}

export interface ResolvedRoleConfig {
  provider?: ProviderType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  thinking: ThinkingConfig;
  streaming: boolean;
}

// ── Defaults ──

const DEFAULT_BASE_URL = 'http://localhost:1234/v1';
const DEFAULT_TEMPERATURES: Record<ModelRole, number> = {
  generator: 0.7,   // Creative — needs variety
  evaluator: 0.2,   // Precise — needs consistency
  harness: 0.5,     // Balanced — reasoning + action
};
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT = 120000;

// ── Config Loading ──

const CONFIG_DIR = join(homedir(), '.liminal');
const USER_CONFIG_PATH = join(CONFIG_DIR, 'config.json');

/**
 * Load and resolve role-based configuration from all sources.
 *
 * Resolution order per role:
 *   1. Project config (config/liminal.json) `roles.<role>`
 *   2. User config (~/.liminal/config.json) `roles.<role>`
 *   3. Environment variables (role-specific then generic)
 *   4. Conservative defaults
 *
 * After loading, applies capability overrides to CapabilityRegistry.
 */
export async function loadRoleConfig(projectDir?: string): Promise<Record<ModelRole, ResolvedRoleConfig>> {
  const fileConfig = await loadConfigFile();
  const projectConfig = await loadProjectConfig(projectDir);

  // Merge: project > user (project overrides user for same keys)
  let merged = mergeConfigs(fileConfig, projectConfig);

  // Fallback: UserConfig shape (defaultProvider/providers) → single role from effective config
  if (!merged?.roles && (fileConfig as any)?.defaultProvider) {
    const effective = await getEffectiveConfig();
    if (effective.baseUrl || effective.model) {
      merged = {
        roles: {
          generator: {
            baseUrl: effective.baseUrl || DEFAULT_BASE_URL,
            model: effective.model || 'unknown',
            apiKey: effective.apiKey,
          },
        },
      };
    }
  }

  // Apply capability overrides to registry
  if (merged?.capabilities) {
    for (const [model, caps] of Object.entries(merged.capabilities)) {
      CapabilityRegistry.override(model, caps);
    }
  }

  // Resolve each role
  const generator = resolveRole('generator', merged);
  const evaluator = resolveRole('evaluator', merged);
  const harness = resolveRole('harness', merged);

  return { generator, evaluator, harness };
}

/**
 * Resolve a single role's configuration from merged file config + env vars.
 */
function resolveRole(role: ModelRole, fileConfig: RoleConfigFile | null): ResolvedRoleConfig {
  const fileRole = fileConfig?.roles?.[role];

  // Environment variable fallbacks per role
  const envMap: Record<ModelRole, { baseUrl: string[]; model: string[]; apiKey: string[] }> = {
    generator: {
      baseUrl: ['LLM_BASE_URL'],
      model: ['LLM_MODEL'],
      apiKey: ['LLM_API_KEY', 'OPENAI_API_KEY', 'GLM_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY'],
    },
    evaluator: {
      baseUrl: ['EVALUATOR_BASE_URL', 'LLM_BASE_URL'],
      model: ['EVALUATOR_MODEL', 'LLM_MODEL'],
      apiKey: ['EVALUATOR_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY', 'GLM_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY'],
    },
    harness: {
      baseUrl: ['HARNESS_BASE_URL', 'LLM_BASE_URL'],
      model: ['HARNESS_MODEL', 'LLM_MODEL'],
      apiKey: ['HARNESS_API_KEY', 'LLM_API_KEY', 'OPENAI_API_KEY', 'GLM_API_KEY', 'MOONSHOT_API_KEY', 'MINIMAX_API_KEY'],
    },
  };

  const envSources = envMap[role];
  const baseUrl = fileRole?.baseUrl
    || envSources.baseUrl.map(k => env(k)).find(Boolean)
    || DEFAULT_BASE_URL;
  const model = fileRole?.model
    || envSources.model.map(k => env(k)).find(Boolean)
    || 'unknown';
  const apiKey = fileRole?.apiKey
    || envSources.apiKey.map(k => process.env[k] || env(k)).find(Boolean);

  return {
    provider: fileRole?.provider || detectProviderType(baseUrl, model),
    baseUrl,
    apiKey,
    model,
    temperature: fileRole?.temperature ?? DEFAULT_TEMPERATURES[role],
    maxTokens: fileRole?.maxTokens ?? DEFAULT_MAX_TOKENS,
    timeout: fileRole?.timeout ?? DEFAULT_TIMEOUT,
    thinking: fileRole?.thinking ?? { enabled: false },
    streaming: fileRole?.streaming ?? (role === 'harness'),
  };
}

/**
 * Auto-detect provider type from baseUrl and model name.
 */
export function detectProviderType(baseUrl: string, model?: string): ProviderType {
  const url = baseUrl.toLowerCase();
  const m = (model || '').toLowerCase();

  if (url.includes('openrouter')) return 'openrouter';
  if (url.includes('minimax')) return 'minimax'; // Before anthropic — api.minimax.io/anthropic contains "anthropic"
  if (url.includes('anthropic')) return 'anthropic';
  if (url.includes('generativelanguage.googleapis')) return 'google';
  if (url.includes('11434') || url.includes('ollama')) return 'ollama';

  // Model-based hints
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('gemini')) return 'google';
  if (m.startsWith('deepseek-r1')) return 'ollama';

  // Default: OpenAI-compatible (covers LM Studio, vLLM, LocalAI, etc.)
  // ZhipuAI GLM — OpenAI-compatible
  if (url.includes('bigmodel.cn')) return 'openai';
  // Moonshot KimiCode — OpenAI-compatible
  if (url.includes('moonshot')) return 'openai';

  // Default: OpenAI-compatible (covers LM Studio, vLLM, LocalAI, Minimax, etc.)
  return 'openai';
}

// ── File Loading ──

async function loadConfigFile(): Promise<RoleConfigFile | null> {
  try {
    const content = await readFile(USER_CONFIG_PATH, 'utf-8');
    return JSON.parse(content) as RoleConfigFile;
  } catch {
    // No user config file — that's fine, env vars work
    return null;
  }
}

async function loadProjectConfig(projectDir?: string): Promise<RoleConfigFile | null> {
  if (!projectDir) {
    projectDir = process.cwd();
  }

  const configPath = join(projectDir, 'config', 'liminal.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Project config uses different shape — extract role info from it
    return projectToRoleConfig(parsed);
  } catch (err) {
    Logger.debug('RoleConfig', `Failed to load role config from ${configPath}:`, err);
    return null;
  }
}

interface ProjectConfigLike {
  llm?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
  };
  multiModel?: {
    primary?: {
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    secondary?: {
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  };
}

/**
 * Map existing ProjectConfig shape to RoleConfigFile.
 * The existing project config has `llm` and `multiModel` fields
 * that map to generator and harness roles.
 */
function projectToRoleConfig(project: ProjectConfigLike): RoleConfigFile | null {
  if (!project.llm && !project.multiModel) return null;

  const roles: RoleConfigFile['roles'] = {
    generator: {
      baseUrl: project.llm?.baseUrl || project.multiModel?.primary?.baseUrl || '',
      model: project.llm?.model || project.multiModel?.primary?.model || '',
      apiKey: project.llm?.apiKey,
      temperature: project.llm?.temperature || project.multiModel?.primary?.temperature,
      maxTokens: project.llm?.maxTokens || project.multiModel?.primary?.maxTokens,
    },
  };

  if (project.multiModel?.secondary) {
    roles.harness = {
      baseUrl: project.multiModel.secondary.baseUrl || '',
      model: project.multiModel.secondary.model || '',
      temperature: project.multiModel.secondary.temperature,
      maxTokens: project.multiModel.secondary.maxTokens,
    };
  }

  return { roles };
}

/**
 * Merge two RoleConfigFile objects. `overlay` takes priority.
 */
function mergeConfigs(base: RoleConfigFile | null, overlay: RoleConfigFile | null): RoleConfigFile | null {
  if (!base) return overlay;
  if (!overlay) return base;

  return {
    roles: {
      generator: { ...base.roles.generator, ...overlay.roles.generator },
      evaluator: overlay.roles.evaluator || base.roles.evaluator,
      harness: overlay.roles.harness || base.roles.harness,
    },
    fallbacks: { ...base.fallbacks, ...overlay.fallbacks },
    capabilities: { ...base.capabilities, ...overlay.capabilities },
    evolution: { ...base.evolution, ...overlay.evolution },
  };
}

/**
 * Write a role config file (for `liminal config` CLI command).
 */
export async function saveRoleConfig(config: RoleConfigFile, configPath?: string): Promise<void> {
  const target = configPath || USER_CONFIG_PATH;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get fallback configs for a role.
 */
export function getFallbacks(
  role: ModelRole,
  config: RoleConfigFile | null,
): RoleProviderConfig[] {
  return config?.fallbacks?.[role] || [];
}

/**
 * Get evolution tunables with sensible defaults.
 */
export function getEvolutionTunables(config: RoleConfigFile | null): EvolutionTunables {
  return {
    enabled: config?.evolution?.enabled ?? false,
    temperatureRange: config?.evolution?.temperatureRange ?? { min: 0.0, max: 1.0 },
    maxTokensRange: config?.evolution?.maxTokensRange ?? { min: 512, max: 8192 },
    mutationRate: config?.evolution?.mutationRate ?? 0.1,
  };
}

/**
 * Get a single role's resolved config from an already-loaded roles record.
 * Returns undefined if the role was not configured.
 */
export function getRoleConfig(
  role: ModelRole,
  roles: Partial<Record<ModelRole, ResolvedRoleConfig>>,
): ResolvedRoleConfig | undefined {
  return roles[role];
}

/**
 * Format role config for display.
 */
export function formatRoleConfig(roles: Record<ModelRole, ResolvedRoleConfig>): string {
  const lines: string[] = ['Role Configuration:', '=================='];

  for (const [role, cfg] of Object.entries(roles)) {
    lines.push('');
    lines.push(`  ${role.toUpperCase()}:`);
    lines.push(`    Provider: ${cfg.provider || 'auto'}`);
    lines.push(`    Model:    ${cfg.model}`);
    lines.push(`    Base URL: ${cfg.baseUrl}`);
    lines.push(`    Temp:     ${cfg.temperature}`);
    lines.push(`    Tokens:   ${cfg.maxTokens}`);
    lines.push(`    Thinking: ${cfg.thinking.enabled ? 'on' : 'off'}`);
    lines.push(`    Stream:   ${cfg.streaming ? 'on' : 'off'}`);
  }

  return lines.join('\n');
}
