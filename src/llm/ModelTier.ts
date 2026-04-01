/**
 * Model Tier Detection - Simplified approach based on capability, not provider
 * 
 * We categorize models into 3 tiers:
 * - FLAGSHIP: Big models (Claude 3.5/4, GPT-4, etc) - 200k+ context, very capable
 * - MEDIUM: Mid-tier models - 100k context, decent capability  
 * - LOCAL: Small local models - 32k context, needs more guidance
 * - TINY: Very small/slow local models - 8k context, minimal prompting
 * 
 * The prompt style adapts to the tier, not the specific provider.
 */

import type { LLMConfig } from './LLMClient.js';

export type ModelTier = 'flagship' | 'medium' | 'local' | 'tiny';

export interface ModelProfile {
  tier: ModelTier;
  contextWindow: number;
  recommendedContextTokens: number;  // How much context to actually use
  supportsSystemPrompt: boolean;
  needsExplicitInstructions: boolean;
  fewShotExamples: number;  // How many examples to include
}

// Known models and their tiers
const MODEL_TIERS: Record<string, ModelTier> = {
  // Flagship models
  'claude-3-5-sonnet': 'flagship',
  'claude-3-5': 'flagship',
  'claude-3-opus': 'flagship',
  'claude-4': 'flagship',
  'gpt-4': 'flagship',
  'gpt-4o': 'flagship',
  'gpt-4-turbo': 'flagship',
  
  // Medium models
  'claude-3-haiku': 'medium',
  'gpt-3.5-turbo': 'medium',
  'gpt-4o-mini': 'medium',
  
  // Local models (common names)
  'qwen': 'local',
  'qwen2.5': 'local',
  'qwen3': 'local',
  'llama': 'local',
  'llama-3': 'local',
  'mistral': 'local',
  'mixtral': 'local',
  'phi': 'local',
  'gemma': 'local',
  
  // Tiny models
  'qwen2.5-0.5b': 'tiny',
  'qwen2.5-1.5b': 'tiny',
  'phi-2': 'tiny',
  'tinyllama': 'tiny',
};

// Default profiles for each tier
const TIER_PROFILES: Record<ModelTier, ModelProfile> = {
  flagship: {
    tier: 'flagship',
    contextWindow: 200000,
    recommendedContextTokens: 8000,  // Can handle lots of context
    supportsSystemPrompt: true,
    needsExplicitInstructions: false,  // Smart enough to infer
    fewShotExamples: 3,
  },
  medium: {
    tier: 'medium',
    contextWindow: 100000,
    recommendedContextTokens: 4000,
    supportsSystemPrompt: true,
    needsExplicitInstructions: true,
    fewShotExamples: 2,
  },
  local: {
    tier: 'local',
    contextWindow: 16000,  // Currently 16k for local models
    recommendedContextTokens: 2000,  // Keep it tight
    supportsSystemPrompt: true,
    needsExplicitInstructions: true,  // Needs clear guidance
    fewShotExamples: 1,
  },
  tiny: {
    tier: 'tiny',
    contextWindow: 8000,
    recommendedContextTokens: 1000,  // Minimal context
    supportsSystemPrompt: false,  // Often doesn't work well
    needsExplicitInstructions: true,  // Needs very clear instructions
    fewShotExamples: 1,
  },
};

/**
 * Detect model tier from config
 */
export function detectModelTier(config: LLMConfig): ModelTier {
  const modelLower = config.model?.toLowerCase() || '';
  
  // Check for exact matches first
  if (MODEL_TIERS[modelLower]) {
    return MODEL_TIERS[modelLower];
  }
  
  // Check for partial matches
  for (const [key, tier] of Object.entries(MODEL_TIERS)) {
    if (modelLower.includes(key)) {
      return tier;
    }
  }
  
  // Detect from context window if provided
  if (config.maxTokens && config.maxTokens > 100000) {
    return 'flagship';
  }
  if (config.maxTokens && config.maxTokens > 50000) {
    return 'medium';
  }
  if (config.maxTokens && config.maxTokens < 10000) {
    return 'tiny';
  }
  
  // Default based on base URL hints
  const baseUrl = config.baseUrl?.toLowerCase() || '';
  if (baseUrl.includes('anthropic') || baseUrl.includes('openai.com')) {
    return 'flagship';  // Assume cloud = capable
  }
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('ollama')) {
    return 'local';  // Local = smaller
  }
  
  return 'medium';  // Safe default
}

/**
 * Get profile for a tier
 */
export function getModelProfile(tier: ModelTier): ModelProfile {
  return TIER_PROFILES[tier];
}

/**
 * Get full model info from config
 */
export function getModelInfo(config: LLMConfig): ModelProfile {
  const tier = detectModelTier(config);
  return getModelProfile(tier);
}

/**
 * Trim context to fit within token budget
 */
export function trimContext(context: string, maxTokens: number): string {
  // Rough approximation: 4 chars ≈ 1 token
  const maxChars = maxTokens * 4;
  
  if (context.length <= maxChars) {
    return context;
  }
  
  // Keep the beginning (instructions) and end (user request)
  // Trim from the middle (documentation/examples)
  const keepStart = Math.floor(maxChars * 0.3);  // 30% from start
  const keepEnd = Math.floor(maxChars * 0.4);    // 40% from end
  
  return context.slice(0, keepStart) + 
         '\n\n[... context trimmed for length ...]\n\n' +
         context.slice(-keepEnd);
}

/**
 * Select prompt style based on tier
 */
export function selectPromptStyle(tier: ModelTier): {
  format: 'concise' | 'detailed' | 'minimal';
  useXmlTags: boolean;
  useMarkdown: boolean;
  includeExamples: boolean;
} {
  switch (tier) {
    case 'flagship':
      return {
        format: 'concise',      // Smart enough, don't over-explain
        useXmlTags: true,       // Claude-style works well
        useMarkdown: true,
        includeExamples: true,  // Can learn from examples
      };
    case 'medium':
      return {
        format: 'detailed',     // Needs more guidance
        useXmlTags: false,      // Keep it simple
        useMarkdown: true,
        includeExamples: true,
      };
    case 'local':
      return {
        format: 'detailed',     // Needs explicit instructions
        useXmlTags: false,      // Simple formatting
        useMarkdown: true,
        includeExamples: true,  // Few-shot helps a lot
      };
    case 'tiny':
      return {
        format: 'minimal',      // Keep it short
        useXmlTags: false,      // Too verbose
        useMarkdown: false,     // Plain text
        includeExamples: false, // No room for examples
      };
  }
}
