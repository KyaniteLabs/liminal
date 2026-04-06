/**
 * ModelConfig - Configuration management for three-role model split
 *
 * Supports separate model configurations for:
 * - Harness: Self-improvement, code fixes, validation (needs precision)
 * - Generation: Creative coding output (needs creativity)
 * - Evaluator: Quality assessment, scoring, comparison (needs consistency)
 *
 * Provider detection delegates to RoleConfig.detectProviderType().
 * Backward compatible with existing LIMINAL_HARNESS_* and LIMINAL_LLM_* env vars.
 */

import { detectProviderType } from '../config/RoleConfig.js';
import type { ProviderType, ModelRole } from '../config/RoleConfig.js';

export { ProviderType, ModelRole };

/**
 * Validate URL to prevent SSRF attacks.
 * Localhost URLs are only allowed if explicitly enabled via environment variable.
 */
function validateBaseUrl(url: string): void {
  try {
    const parsed = new URL(url);

    // Check if localhost is explicitly allowed
    const allowLocalhost = process.env.LIMINAL_ALLOW_LOCALHOST === 'true';

    // Block localhost URLs unless explicitly allowed
    if (!allowLocalhost) {
      const hostname = parsed.hostname.toLowerCase();
      const dangerousHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        'localhost.localdomain',
        'ip6-localhost',
        'ip6-loopback',
      ];

      if (dangerousHosts.includes(hostname) || hostname.startsWith('127.') || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        throw new Error(
          `Local/private URL detected: ${url}. Set LIMINAL_ALLOW_LOCALHOST=true to allow localhost connections for development.`
        );
      }
    }

    // Ensure URL uses HTTPS or HTTP (no file://, data://, etc.)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}. Only http:// and https:// are allowed.`);
    }

    // Basic URL structure validation
    if (!parsed.hostname || parsed.hostname.length > 253) {
      throw new Error('Invalid hostname');
    }

  } catch (error) {
    if (error instanceof Error && error.message.includes('Local/private URL detected')) {
      throw error;
    }
    throw new Error(`Invalid base URL "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ModelConfig {
  provider: ProviderType;
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
  evaluator: ModelConfig;
  fallbackToGeneration: boolean;  // If harness model fails, use generation
}

// Default configuration values
const DEFAULT_HARNESS_TEMPERATURE = 0.2;  // Low temp for precision
const DEFAULT_GENERATION_TEMPERATURE = 0.7;  // Higher temp for creativity
const DEFAULT_EVALUATOR_TEMPERATURE = 0.2;  // Low temp for consistent scoring
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT = 120000;

/**
 * Load model configuration from environment
 */
export function loadModelConfig(): SplitModelConfig {
  const harnessConfig = loadHarnessConfig();
  const generationConfig = loadGenerationConfig();
  const evaluatorConfig = loadEvaluatorConfig();
  const fallbackToGeneration = process.env.LIMINAL_HARNESS_FALLBACK !== 'false';

  return {
    harness: harnessConfig,
    generation: generationConfig,
    evaluator: evaluatorConfig,
    fallbackToGeneration,
  };
}

/**
 * Load harness-specific configuration
 * Falls back to generation config if not explicitly set
 */
export function loadHarnessConfig(): ModelConfig {
  // Check for explicit harness configuration
  const harnessBaseUrl = process.env.LIMINAL_HARNESS_BASE_URL || process.env.LIMINAL_LLM_BASE_URL;
  const harnessModel = process.env.LIMINAL_HARNESS_MODEL || process.env.LIMINAL_LLM_MODEL;
  const harnessApiKey = process.env.LIMINAL_HARNESS_API_KEY || process.env.LIMINAL_LLM_API_KEY;
  const harnessTemp = parseFloat(process.env.LIMINAL_HARNESS_TEMPERATURE || String(DEFAULT_HARNESS_TEMPERATURE));
  const harnessTokens = parseInt(process.env.LIMINAL_HARNESS_MAX_TOKENS || String(DEFAULT_MAX_TOKENS));
  const harnessTimeout = parseInt(process.env.LIMINAL_HARNESS_TIMEOUT || String(DEFAULT_TIMEOUT));

  const baseUrl = harnessBaseUrl || 'http://localhost:1234/v1';
  const model = harnessModel || 'unknown';

  // Validate URL to prevent SSRF attacks
  validateBaseUrl(baseUrl);

  return {
    provider: detectProviderType(baseUrl, model),
    baseUrl,
    model,
    apiKey: harnessApiKey,
    temperature: harnessTemp,
    maxTokens: harnessTokens,
    timeout: harnessTimeout,
  };
}

/**
 * Load generation-specific configuration
 */
export function loadGenerationConfig(): ModelConfig {
  const baseUrl = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:1234/v1';
  const model = process.env.LIMINAL_LLM_MODEL || 'unknown';
  const apiKey = process.env.LIMINAL_LLM_API_KEY;
  const temp = parseFloat(process.env.LIMINAL_LLM_TEMPERATURE || String(DEFAULT_GENERATION_TEMPERATURE));
  const tokens = parseInt(process.env.LIMINAL_LLM_MAX_TOKENS || String(DEFAULT_MAX_TOKENS));
  const timeout = parseInt(process.env.LIMINAL_LLM_TIMEOUT || String(DEFAULT_TIMEOUT));

  // Validate URL to prevent SSRF attacks
  validateBaseUrl(baseUrl);

  return {
    provider: detectProviderType(baseUrl, model),
    baseUrl,
    model,
    apiKey,
    temperature: temp,
    maxTokens: tokens,
    timeout,
  };
}

/**
 * Load evaluator-specific configuration
 * Falls back to generation config if not explicitly set
 */
export function loadEvaluatorConfig(): ModelConfig {
  const evaluatorBaseUrl = process.env.LIMINAL_EVALUATOR_BASE_URL || process.env.LIMINAL_LLM_BASE_URL;
  const evaluatorModel = process.env.LIMINAL_EVALUATOR_MODEL || process.env.LIMINAL_LLM_MODEL;
  const evaluatorApiKey = process.env.LIMINAL_EVALUATOR_API_KEY || process.env.LIMINAL_LLM_API_KEY;
  const evaluatorTemp = parseFloat(process.env.LIMINAL_EVALUATOR_TEMPERATURE || String(DEFAULT_EVALUATOR_TEMPERATURE));
  const evaluatorTokens = parseInt(process.env.LIMINAL_EVALUATOR_MAX_TOKENS || String(DEFAULT_MAX_TOKENS));
  const evaluatorTimeout = parseInt(process.env.LIMINAL_EVALUATOR_TIMEOUT || String(DEFAULT_TIMEOUT));

  const baseUrl = evaluatorBaseUrl || 'http://localhost:1234/v1';
  const model = evaluatorModel || 'unknown';

  // Validate URL to prevent SSRF attacks
  validateBaseUrl(baseUrl);

  return {
    provider: detectProviderType(baseUrl, model),
    baseUrl,
    model,
    apiKey: evaluatorApiKey,
    temperature: evaluatorTemp,
    maxTokens: evaluatorTokens,
    timeout: evaluatorTimeout,
  };
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

  // Check evaluator config
  if (!config.evaluator.baseUrl) {
    warnings.push('Evaluator base URL not set - falling back to generation config');
  }
  if (!config.evaluator.model || config.evaluator.model === 'unknown') {
    warnings.push('Evaluator model not explicitly set - will auto-detect');
  }

  // Check for common configuration issues
  if (config.harness.model === config.generation.baseUrl &&
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
  const e = config.evaluator;

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

EVALUATOR (Quality Assessment):
  Provider: ${e.provider}
  Model: ${e.model}
  Base URL: ${e.baseUrl}
  Temperature: ${e.temperature}
  Max Tokens: ${e.maxTokens}

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

## Evaluator (Quality Assessment, Scoring)
LIMINAL_EVALUATOR_BASE_URL   # API endpoint for evaluator (falls back to LLM_BASE_URL)
LIMINAL_EVALUATOR_MODEL      # Model name for evaluator (falls back to LLM_MODEL)
LIMINAL_EVALUATOR_API_KEY    # API key for evaluator (falls back to LLM_API_KEY)
LIMINAL_EVALUATOR_TEMPERATURE # Default: 0.2 (low for consistent scoring)
LIMINAL_EVALUATOR_MAX_TOKENS  # Default: 4096
LIMINAL_EVALUATOR_TIMEOUT     # Default: 120000ms

## Quick Setup Examples

# Same provider, different models:
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-14b
LIMINAL_HARNESS_MODEL=qwen2.5-coder-7b
LIMINAL_EVALUATOR_MODEL=qwen2.5-coder-14b

# Different providers:
LIMINAL_HARNESS_BASE_URL=http://localhost:1234/v1
LIMINAL_HARNESS_MODEL=qwen2.5-coder-7b
LIMINAL_LLM_BASE_URL=https://api.minimaxi.com/v1
LIMINAL_LLM_MODEL=MiniMax-M2.7
LIMINAL_LLM_API_KEY=sk-...
LIMINAL_EVALUATOR_BASE_URL=https://openrouter.ai/api/v1
LIMINAL_EVALUATOR_MODEL=google/gemini-2.0-flash
LIMINAL_EVALUATOR_API_KEY=sk-or-...
`;
}
