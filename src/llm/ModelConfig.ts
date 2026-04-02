/**
 * ModelConfig - Configuration management for Harness/Generation model split
 *
 * Supports separate model configurations for:
 * - Harness: Self-improvement, code fixes, validation (needs precision)
 * - Generation: Creative coding output (needs creativity)
 */

export interface ModelConfig {
  provider: 'lmstudio' | 'ollama' | 'minimax' | 'openrouter' | 'glm' | 'custom';
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface SplitModelConfig {
  harness: ModelConfig;
  generation: ModelConfig;
  fallbackToGeneration: boolean;  // If harness model fails, use generation
}

// Default configuration values
const DEFAULT_HARNESS_TEMPERATURE = 0.2;  // Low temp for precision
const DEFAULT_GENERATION_TEMPERATURE = 0.7;  // Higher temp for creativity
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT = 120000;

/**
 * Load model configuration from environment
 */
export function loadModelConfig(): SplitModelConfig {
  const harnessConfig = loadHarnessConfig();
  const generationConfig = loadGenerationConfig();
  const fallbackToGeneration = process.env.LIMINAL_HARNESS_FALLBACK !== 'false';

  return {
    harness: harnessConfig,
    generation: generationConfig,
    fallbackToGeneration,
  };
}

/**
 * Load harness-specific configuration
 * Falls back to generation config if not explicitly set
 */
function loadHarnessConfig(): ModelConfig {
  // Check for explicit harness configuration
  const harnessBaseUrl = process.env.LIMINAL_HARNESS_BASE_URL || process.env.LIMINAL_LLM_BASE_URL;
  const harnessModel = process.env.LIMINAL_HARNESS_MODEL || process.env.LIMINAL_LLM_MODEL;
  const harnessApiKey = process.env.LIMINAL_HARNESS_API_KEY || process.env.LIMINAL_LLM_API_KEY;
  const harnessTemp = parseFloat(process.env.LIMINAL_HARNESS_TEMPERATURE || String(DEFAULT_HARNESS_TEMPERATURE));
  const harnessTokens = parseInt(process.env.LIMINAL_HARNESS_MAX_TOKENS || String(DEFAULT_MAX_TOKENS));
  const harnessTimeout = parseInt(process.env.LIMINAL_HARNESS_TIMEOUT || String(DEFAULT_TIMEOUT));

  // Determine provider
  const provider = detectProvider(harnessBaseUrl);

  return {
    provider,
    baseUrl: harnessBaseUrl || 'http://localhost:1234/v1',
    model: harnessModel || 'unknown',
    apiKey: harnessApiKey,
    temperature: harnessTemp,
    maxTokens: harnessTokens,
    timeout: harnessTimeout,
  };
}

/**
 * Load generation-specific configuration
 */
function loadGenerationConfig(): ModelConfig {
  const baseUrl = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:1234/v1';
  const model = process.env.LIMINAL_LLM_MODEL || 'unknown';
  const apiKey = process.env.LIMINAL_LLM_API_KEY;
  const temp = parseFloat(process.env.LIMINAL_LLM_TEMPERATURE || String(DEFAULT_GENERATION_TEMPERATURE));
  
  // Use defaults if not set (silence unused warnings)
  void DEFAULT_HARNESS_TEMPERATURE;
  const tokens = parseInt(process.env.LIMINAL_LLM_MAX_TOKENS || String(DEFAULT_MAX_TOKENS));
  const timeout = parseInt(process.env.LIMINAL_LLM_TIMEOUT || String(DEFAULT_TIMEOUT));

  return {
    provider: detectProvider(baseUrl),
    baseUrl,
    model,
    apiKey,
    temperature: temp,
    maxTokens: tokens,
    timeout,
  };
}

/**
 * Detect provider from base URL
 */
function detectProvider(baseUrl?: string): ModelConfig['provider'] {
  if (!baseUrl) return 'lmstudio';
  
  if (baseUrl.includes('minimax')) return 'minimax';
  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('glm') || baseUrl.includes('bigmodel')) return 'glm';
  if (baseUrl.includes('11434') || baseUrl.includes('ollama')) return 'ollama';
  if (baseUrl.includes('1234') || baseUrl.includes('lmstudio')) return 'lmstudio';
  
  return 'custom';
}

/**
 * Validate that configuration is usable
 */
export function validateModelConfig(config: SplitModelConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check harness config
  if (!config.harness.baseUrl) {
    errors.push('LIMINAL_HARNESS_BASE_URL or LIMINAL_LLM_BASE_URL is required');
  }
  if (!config.harness.model || config.harness.model === 'unknown') {
    warnings.push('Harness model not explicitly set - will auto-detect');
  }

  // Check generation config
  if (!config.generation.baseUrl) {
    errors.push('LIMINAL_LLM_BASE_URL is required');
  }
  if (!config.generation.model || config.generation.model === 'unknown') {
    warnings.push('Generation model not explicitly set - will auto-detect');
  }

  // Check for common configuration issues
  if (config.harness.model === config.generation.model && 
      config.harness.baseUrl === config.generation.baseUrl &&
      config.harness.temperature === config.generation.temperature) {
    warnings.push('Harness and generation use identical configs - consider separating for different tasks');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get display string for configuration
 */
export function formatModelConfig(config: SplitModelConfig): string {
  const h = config.harness;
  const g = config.generation;

  return `
Model Configuration:
===================

HARNESS (Self-Improvement):
  Provider: ${h.provider}
  Model: ${h.model}
  Base URL: ${h.baseUrl}
  Temperature: ${h.temperature}
  Max Tokens: ${h.maxTokens}

GENERATION (Creative Output):
  Provider: ${g.provider}
  Model: ${g.model}
  Base URL: ${g.baseUrl}
  Temperature: ${g.temperature}
  Max Tokens: ${g.maxTokens}

Fallback: ${config.fallbackToGeneration ? 'enabled' : 'disabled'}
`;
}

/**
 * Environment variable documentation
 */
export function getModelEnvDocs(): string {
  return `
# Model Configuration Environment Variables

## Harness (Code Fixes, Validation)
LIMINAL_HARNESS_BASE_URL     # API endpoint for harness tasks
LIMINAL_HARNESS_MODEL        # Model name for harness tasks
LIMINAL_HARNESS_API_KEY      # API key for harness provider
LIMINAL_HARNESS_TEMPERATURE  # Default: 0.2 (low for precision)
LIMINAL_HARNESS_MAX_TOKENS   # Default: 4096
LIMINAL_HARNESS_TIMEOUT      # Default: 120000ms
LIMINAL_HARNESS_FALLBACK     # Fallback to generation model on fail (default: true)

## Generation (Creative Coding)
LIMINAL_LLM_BASE_URL         # API endpoint for generation
LIMINAL_LLM_MODEL            # Model name for generation
LIMINAL_LLM_API_KEY          # API key for generation provider
LIMINAL_LLM_TEMPERATURE      # Default: 0.7 (higher for creativity)
LIMINAL_LLM_MAX_TOKENS       # Default: 4096
LIMINAL_LLM_TIMEOUT          # Default: 120000ms

## Quick Setup Examples

# Same provider, different models:
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-14b
LIMINAL_HARNESS_MODEL=qwen2.5-coder-7b

# Different providers:
LIMINAL_HARNESS_BASE_URL=http://localhost:1234/v1
LIMINAL_HARNESS_MODEL=qwen2.5-coder-7b
LIMINAL_LLM_BASE_URL=https://api.minimax.chat/v1
LIMINAL_LLM_MODEL=MiniMax-Text-01
LIMINAL_LLM_API_KEY=sk-...
`;
}
