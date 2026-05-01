import { z } from 'zod';
import { getAllProviders, getDefaultProvider } from '../types/providers.js';
import { PROVIDER_DEFAULTS } from './ProviderRuntime.js';
import { ConfigError } from '../errors/ConfigError.js';

const DEFAULT_PROVIDER = getDefaultProvider();
const DEFAULT_RUNTIME = PROVIDER_DEFAULTS[DEFAULT_PROVIDER];

/**
 * LLM Configuration Schema
 */
export const LLMConfigSchema = z.object({
  provider: z.enum(getAllProviders() as [string, ...string[]]).default(DEFAULT_PROVIDER),
  baseUrl: z.string().url().default(DEFAULT_RUNTIME.baseUrl),
  model: z.string().min(1).default(DEFAULT_RUNTIME.model),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).default(DEFAULT_RUNTIME.temperature),
  maxTokens: z.number().int().positive().default(DEFAULT_RUNTIME.maxTokens),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

/**
 * Validate configuration at startup
 * Throws descriptive error if invalid
 */
export function validateLLMConfig(config: unknown): LLMConfig {
  try {
    return LLMConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n  ');
      throw new ConfigError('Configuration validation failed', {
        issues,
        docs: 'docs/config.md'
      });
    }
    throw error;
  }
}
