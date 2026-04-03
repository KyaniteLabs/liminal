/**
 * Default configuration values for the Compost Mill.
 *
 * These defaults can be overridden via ProjectConfig.compost in
 * config/liminal.json, which is loaded by ConfigLoader.
 */

import type { CompostConfig, LLMProviderConfig } from './types.js';

/** Default cloud model for compost fallback — configurable via roles.evaluator */
const DEFAULT_CLOUD_MODEL = 'claude-sonnet-4-20250514';

/** Deep partial — makes all nested properties optional too. */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** User-facing config type that allows partial overrides at any depth. */
export type UserCompostConfig = DeepPartial<CompostConfig>;

/**
 * Build defaults, optionally merging values from a ProjectConfig.compost section.
 */
export function buildDefaults(projectCompost?: {
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
}): CompostConfig {
  const base: CompostConfig = {
  heapDir: 'compost/heap/',
  maxHeapSizeBytes: 50 * 1024 * 1024, // 50MB
  digestDir: 'compost/digest/',
  seedDir: 'compost/seeds/',
  digestSchedule: 'weekly',
  digestDayOfWeek: 0, // Sunday
  soupEnabled: true,
  soupPopulationSize: 20,
  soupMaxStepsPerCycle: 50,
  soupSeedPromotionThreshold: 0.7,
  soupCycleIntervalMs: 60000, // 1 minute
  llm: {
    baseUrl: 'http://localhost:1234/v1',
    model: 'auto',
    timeoutMs: 30000,
    /** @deprecated Fields retained for backward compatibility */
    provider: 'auto',
    localBaseUrl: 'http://localhost:1234/v1',
    localModel: 'auto',
    cloudApiKeyEnvVar: 'ANTHROPIC_API_KEY',
    cloudModel: DEFAULT_CLOUD_MODEL,
    localTimeoutMs: 30000,
  },
  seedPromotionThreshold: projectCompost?.seedPromotionThreshold ?? 0.4,
  maxSeedsPerDigest: 20,
  nuggetRetentionDays: projectCompost?.nuggetRetentionDays ?? 90,
  lirEnabled: false,
  lirSummaryBudget: 500,
  lirBatchSize: 10,
  lirMaxSymbolsPerFile: 200,
  };

  return base;
}

/** Default Compost Mill configuration (no project overrides). */
export const DEFAULT_CONFIG: CompostConfig = buildDefaults();

/**
 * Deep-merge user config over defaults. Does not mutate defaults.
 */
export function mergeConfig(user?: UserCompostConfig, projectCompost?: CompostConfig['seedPromotionThreshold'] extends number ? Parameters<typeof buildDefaults>[0] : never): CompostConfig {
  const defaults = buildDefaults(projectCompost);
  if (!user) return defaults;

  return {
    ...defaults,
    ...user,
    llm: {
      ...defaults.llm,
      ...(user.llm as Partial<LLMProviderConfig>),
    },
  };
}
