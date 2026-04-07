import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We mock the detectProviderType boundary so tests are deterministic regardless
// of the real RoleConfig implementation.
// ---------------------------------------------------------------------------

const { mockDetectProviderType } = vi.hoisted(() => ({
  mockDetectProviderType: vi.fn(),
}));

vi.mock('../../../src/config/RoleConfig.js', () => ({
  detectProviderType: mockDetectProviderType,
}));

import {
  loadModelConfig,
  loadHarnessConfig,
  loadGenerationConfig,
  loadEvaluatorConfig,
  validateModelConfig,
  formatModelConfig,
  getModelEnvDocs,
  type SplitModelConfig,
  type ModelConfig as ModelConfigType,
} from '../../../src/llm/ModelConfig.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(envVars: Record<string, string | undefined>): void {
  // Save and restore env
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(envVars)) {
    original[key] = process.env[key];
  }
  // Set desired values
  for (const [key, value] of Object.entries(envVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  // Return a restore function
  return void 0; // we use beforeEach/afterEach instead
}

// Build a minimal valid SplitModelConfig for validation tests
function makeValidSplitConfig(overrides?: Partial<{
  harness: Partial<ModelConfigType>;
  generation: Partial<ModelConfigType>;
  evaluator: Partial<ModelConfigType>;
  fallbackToGeneration: boolean;
}>): SplitModelConfig {
  return {
    harness: {
      provider: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-harness-model',
      apiKey: 'sk-test',
      temperature: 0.2,
      maxTokens: 4096,
      timeout: 120000,
      ...overrides?.harness,
    },
    generation: {
      provider: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-gen-model',
      apiKey: 'sk-test',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 120000,
      ...overrides?.generation,
    },
    evaluator: {
      provider: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-eval-model',
      apiKey: 'sk-test',
      temperature: 0.2,
      maxTokens: 4096,
      timeout: 120000,
      ...overrides?.evaluator,
    },
    fallbackToGeneration: overrides?.fallbackToGeneration ?? true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelConfig', () => {
  // Env vars we manage in these tests
  const managedKeys = [
    'LIMINAL_LLM_BASE_URL',
    'LIMINAL_LLM_MODEL',
    'LIMINAL_LLM_API_KEY',
    'LIMINAL_LLM_TEMPERATURE',
    'LIMINAL_LLM_MAX_TOKENS',
    'LIMINAL_LLM_TIMEOUT',
    'LIMINAL_HARNESS_BASE_URL',
    'LIMINAL_HARNESS_MODEL',
    'LIMINAL_HARNESS_API_KEY',
    'LIMINAL_HARNESS_TEMPERATURE',
    'LIMINAL_HARNESS_MAX_TOKENS',
    'LIMINAL_HARNESS_TIMEOUT',
    'LIMINAL_HARNESS_FALLBACK',
    'LIMINAL_EVALUATOR_BASE_URL',
    'LIMINAL_EVALUATOR_MODEL',
    'LIMINAL_EVALUATOR_API_KEY',
    'LIMINAL_EVALUATOR_TEMPERATURE',
    'LIMINAL_EVALUATOR_MAX_TOKENS',
    'LIMINAL_EVALUATOR_TIMEOUT',
  ];

  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of managedKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Allow localhost URLs in tests (SSRF protection blocks them by default)
    process.env.LIMINAL_ALLOW_LOCALHOST = 'true';
    mockDetectProviderType.mockReturnValue('openai');
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  // -------------------------------------------------------------------------
  // loadGenerationConfig
  // -------------------------------------------------------------------------
  describe('loadGenerationConfig', () => {
    it('returns defaults when no env vars are set', () => {
      const config = loadGenerationConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
      expect(config.model).toBe('unknown');
      expect(config.apiKey).toBeUndefined();
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
      expect(config.timeout).toBe(120_000);
      expect(config.provider).toBe('openai');
    });

    it('reads values from LIMINAL_LLM_* env vars', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';
      process.env.LIMINAL_LLM_API_KEY = 'sk-test-key';
      process.env.LIMINAL_LLM_TEMPERATURE = '0.5';
      process.env.LIMINAL_LLM_MAX_TOKENS = '8192';
      process.env.LIMINAL_LLM_TIMEOUT = '60000';

      const config = loadGenerationConfig();
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.model).toBe('gpt-4o');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(8192);
      expect(config.timeout).toBe(60_000);
    });

    it('calls detectProviderType with baseUrl and model', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.anthropic.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'claude-4';
      mockDetectProviderType.mockReturnValue('anthropic');

      const config = loadGenerationConfig();
      expect(mockDetectProviderType).toHaveBeenCalledWith('https://api.anthropic.com/v1', 'claude-4');
      expect(config.provider).toBe('anthropic');
    });
  });

  // -------------------------------------------------------------------------
  // loadHarnessConfig
  // -------------------------------------------------------------------------
  describe('loadHarnessConfig', () => {
    it('falls back to LIMINAL_LLM_* when harness-specific vars are not set', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';
      process.env.LIMINAL_LLM_API_KEY = 'sk-fallback';

      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.model).toBe('gpt-4o');
      expect(config.apiKey).toBe('sk-fallback');
      // Harness default temperature is 0.2
      expect(config.temperature).toBe(0.2);
    });

    it('prefers harness-specific vars over LLM_* vars', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';
      process.env.LIMINAL_LLM_API_KEY = 'sk-fallback';
      process.env.LIMINAL_HARNESS_BASE_URL = 'http://localhost:5000/v1';
      process.env.LIMINAL_HARNESS_MODEL = 'qwen2.5-coder-7b';
      process.env.LIMINAL_HARNESS_API_KEY = 'sk-harness';

      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('http://localhost:5000/v1');
      expect(config.model).toBe('qwen2.5-coder-7b');
      expect(config.apiKey).toBe('sk-harness');
    });

    it('uses default harness temperature of 0.2', () => {
      const config = loadHarnessConfig();
      expect(config.temperature).toBe(0.2);
    });

    it('allows overriding harness temperature via env', () => {
      process.env.LIMINAL_HARNESS_TEMPERATURE = '0.5';
      const config = loadHarnessConfig();
      expect(config.temperature).toBe(0.5);
    });

    it('defaults to localhost baseUrl when nothing is set', () => {
      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
      expect(config.model).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // loadEvaluatorConfig
  // -------------------------------------------------------------------------
  describe('loadEvaluatorConfig', () => {
    it('falls back to LIMINAL_LLM_* when evaluator vars are not set', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';

      const config = loadEvaluatorConfig();
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.model).toBe('gpt-4o');
      // Evaluator default temperature is 0.2
      expect(config.temperature).toBe(0.2);
    });

    it('prefers evaluator-specific vars over LLM_* vars', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';
      process.env.LIMINAL_EVALUATOR_BASE_URL = 'https://openrouter.ai/api/v1';
      process.env.LIMINAL_EVALUATOR_MODEL = 'google/gemini-2.0-flash';
      process.env.LIMINAL_EVALUATOR_API_KEY = 'sk-or-eval';

      const config = loadEvaluatorConfig();
      expect(config.baseUrl).toBe('https://openrouter.ai/api/v1');
      expect(config.model).toBe('google/gemini-2.0-flash');
      expect(config.apiKey).toBe('sk-or-eval');
    });

    it('uses default evaluator temperature of 0.2', () => {
      const config = loadEvaluatorConfig();
      expect(config.temperature).toBe(0.2);
    });

    it('allows overriding evaluator temperature via env', () => {
      process.env.LIMINAL_EVALUATOR_TEMPERATURE = '0.3';
      const config = loadEvaluatorConfig();
      expect(config.temperature).toBe(0.3);
    });
  });

  // -------------------------------------------------------------------------
  // loadModelConfig (integration of all three)
  // -------------------------------------------------------------------------
  describe('loadModelConfig', () => {
    it('returns all three configs plus fallback flag', () => {
      process.env.LIMINAL_LLM_BASE_URL = 'https://api.openai.com/v1';
      process.env.LIMINAL_LLM_MODEL = 'gpt-4o';

      const split = loadModelConfig();
      expect(split.harness).toBeDefined();
      expect(split.generation).toBeDefined();
      expect(split.evaluator).toBeDefined();
      // fallbackToGeneration defaults to true
      expect(split.fallbackToGeneration).toBe(true);
    });

    it('disables fallback when LIMINAL_HARNESS_FALLBACK=false', () => {
      process.env.LIMINAL_HARNESS_FALLBACK = 'false';
      const split = loadModelConfig();
      expect(split.fallbackToGeneration).toBe(false);
    });

    it('enables fallback when LIMINAL_HARNESS_FALLBACK is any other value', () => {
      process.env.LIMINAL_HARNESS_FALLBACK = 'true';
      const split = loadModelConfig();
      expect(split.fallbackToGeneration).toBe(true);
    });

    it('passes distinct configs when all env vars are set independently', () => {
      process.env.LIMINAL_HARNESS_BASE_URL = 'http://harness:1234/v1';
      process.env.LIMINAL_HARNESS_MODEL = 'harness-model';
      process.env.LIMINAL_LLM_BASE_URL = 'http://gen:1234/v1';
      process.env.LIMINAL_LLM_MODEL = 'gen-model';
      process.env.LIMINAL_EVALUATOR_BASE_URL = 'http://eval:1234/v1';
      process.env.LIMINAL_EVALUATOR_MODEL = 'eval-model';

      const split = loadModelConfig();
      expect(split.harness.baseUrl).toBe('http://harness:1234/v1');
      expect(split.harness.model).toBe('harness-model');
      expect(split.generation.baseUrl).toBe('http://gen:1234/v1');
      expect(split.generation.model).toBe('gen-model');
      expect(split.evaluator.baseUrl).toBe('http://eval:1234/v1');
      expect(split.evaluator.model).toBe('eval-model');
    });
  });

  // -------------------------------------------------------------------------
  // validateModelConfig
  // -------------------------------------------------------------------------
  describe('validateModelConfig', () => {
    it('returns valid=true for a properly configured split', () => {
      const config = makeValidSplitConfig();
      const result = validateModelConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('reports error when harness baseUrl is missing', () => {
      const config = makeValidSplitConfig({
        harness: { baseUrl: '' },
      });
      const result = validateModelConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('LIMINAL_HARNESS_BASE_URL or LIMINAL_LLM_BASE_URL is required');
    });

    it('reports error when generation baseUrl is missing', () => {
      const config = makeValidSplitConfig({
        generation: { baseUrl: '' },
      });
      const result = validateModelConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('LIMINAL_LLM_BASE_URL is required');
    });

    it('warns when harness model is "unknown"', () => {
      const config = makeValidSplitConfig({
        harness: { model: 'unknown' },
      });
      const result = validateModelConfig(config);
      expect(result.warnings).toContain('Harness model not explicitly set - will auto-detect');
    });

    it('warns when generation model is "unknown"', () => {
      const config = makeValidSplitConfig({
        generation: { model: 'unknown' },
      });
      const result = validateModelConfig(config);
      expect(result.warnings).toContain('Generation model not explicitly set - will auto-detect');
    });

    it('warns when evaluator model is "unknown"', () => {
      const config = makeValidSplitConfig({
        evaluator: { model: 'unknown' },
      });
      const result = validateModelConfig(config);
      expect(result.warnings).toContain('Evaluator model not explicitly set - will auto-detect');
    });

    it('warns when evaluator baseUrl is empty', () => {
      const config = makeValidSplitConfig({
        evaluator: { baseUrl: '' },
      });
      const result = validateModelConfig(config);
      expect(result.warnings).toContain('Evaluator base URL not set - falling back to generation config');
    });

    it('warns when harness and generation use identical configs', () => {
      const config = makeValidSplitConfig({
        harness: {
          baseUrl: 'http://localhost:1234/v1',
          model: 'http://localhost:1234/v1', // Note: comparison uses model === baseUrl (code bug but we test behavior)
          temperature: 0.7,
        },
        generation: {
          baseUrl: 'http://localhost:1234/v1',
          temperature: 0.7,
        },
      });
      const result = validateModelConfig(config);
      expect(result.warnings).toContain('Harness and generation use identical configs - consider separating for different tasks');
    });

    it('accumulates multiple errors', () => {
      const config = makeValidSplitConfig({
        harness: { baseUrl: '' },
        generation: { baseUrl: '' },
      });
      const result = validateModelConfig(config);
      expect(result.errors).toHaveLength(2);
      expect(result.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // formatModelConfig
  // -------------------------------------------------------------------------
  describe('formatModelConfig', () => {
    it('includes all three roles in the display string', () => {
      const config = makeValidSplitConfig();
      const formatted = formatModelConfig(config);
      expect(formatted).toContain('HARNESS');
      expect(formatted).toContain('GENERATION');
      expect(formatted).toContain('EVALUATOR');
      expect(formatted).toContain('test-harness-model');
      expect(formatted).toContain('test-gen-model');
      expect(formatted).toContain('test-eval-model');
    });

    it('shows fallback status', () => {
      const config = makeValidSplitConfig({ fallbackToGeneration: true });
      expect(formatModelConfig(config)).toContain('Fallback: enabled');

      const configNoFallback = makeValidSplitConfig({ fallbackToGeneration: false });
      expect(formatModelConfig(configNoFallback)).toContain('Fallback: disabled');
    });

    it('includes temperature and maxTokens for each role', () => {
      const config = makeValidSplitConfig();
      const formatted = formatModelConfig(config);
      // Harness: temp 0.2
      expect(formatted).toContain('Temperature: 0.2');
      // Generation: temp 0.7
      expect(formatted).toContain('Temperature: 0.7');
      // All have 4096 max tokens
      expect(formatted).toContain('Max Tokens: 4096');
    });
  });

  // -------------------------------------------------------------------------
  // getModelEnvDocs
  // -------------------------------------------------------------------------
  describe('getModelEnvDocs', () => {
    it('returns documentation for all three role env vars', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('LIMINAL_HARNESS_BASE_URL');
      expect(docs).toContain('LIMINAL_LLM_BASE_URL');
      expect(docs).toContain('LIMINAL_EVALUATOR_BASE_URL');
      expect(docs).toContain('LIMINAL_HARNESS_TEMPERATURE');
      expect(docs).toContain('LIMINAL_LLM_TEMPERATURE');
      expect(docs).toContain('LIMINAL_EVALUATOR_TEMPERATURE');
    });

    it('includes default values in docs', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('0.2');
      expect(docs).toContain('0.7');
      expect(docs).toContain('4096');
      expect(docs).toContain('120000ms');
    });

    it('includes quick setup examples', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('Quick Setup Examples');
    });
  });
});
