import { z } from 'zod';

/**
 * LLM Configuration Schema
 */
export const LLMConfigSchema = z.object({
  provider: z.enum(['lmstudio', 'ollama', 'minimax', 'openai', 'openrouter', 'glm', 'custom']).default('lmstudio'),
  baseUrl: z.string().url().default('http://localhost:1234/v1'),
  model: z.string().min(1).default('qwen2.5-coder-7b-instruct'),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().default(4096),
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
      throw new Error(`Configuration validation failed:\n  ${issues}\n\nSee docs/config.md for configuration options.`);
    }
    throw error;
  }
}
