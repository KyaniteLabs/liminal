// Allow localhost for tests
process.env.LIMINAL_ALLOW_LOCALHOST_LLM = "true";
process.env.LIMINAL_ALLOW_LOCALHOST = "true";

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── vi.hoisted for all mock variables used in vi.mock factories ──

const { mockDetectProviderType } = vi.hoisted(() => {
  return { mockDetectProviderType: vi.fn() };
});

// ── Boundary mock: only the external dependency (RoleConfig) ──

vi.mock('../../../src/config/RoleConfig.js', () => ({
  detectProviderType: mockDetectProviderType,
  // Re-export types so imports don't break
  // (TypeScript erases these at runtime but vitest needs the mock)
}));

// Import after mocks — use .js extension for ESM
import {
  loadModelConfig,
  loadHarnessConfig,
  loadGenerationConfig,
  loadEvaluatorConfig,
  validateModelConfig,
  formatModelConfig,
  getModelEnvDocs,
} from '../../../src/llm/ModelConfig.js';
import type { SplitModelConfig, ModelConfig } from '../../../src/llm/ModelConfig.js';

describe('ModelConfig', () => {
  // Snapshot of env vars to restore after each test.
  // We use a Symbol marker to distinguish "never set" (undefined) from "set to empty string".
  // process.env[key] = undefined creates the STRING 'undefined', so we must delete instead.
  const UNSET = Symbol('UNSET');
  let savedEnv: Record<string, string | typeof UNSET>;

  beforeEach(() => {
    savedEnv = {};
    vi.clearAllMocks();
    // Default: detectProviderType returns 'openai' for unknown providers
    mockDetectProviderType.mockReturnValue('openai');
  });

  afterEach(() => {
    // Restore all env vars we touched
    const envVars = [
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

    for (const key of envVars) {
      if (key in savedEnv) {
        // UNSET means the env var was never set — delete it rather than restoring the string 'undefined'
        if (savedEnv[key] === UNSET) {
          delete process.env[key];
        } else {
          process.env[key] = savedEnv[key] as string;
        }
      } else {
        delete process.env[key];
      }
    }
  });

  // Helper to set env vars (tracks originals for cleanup)
  function setEnv(key: string, value: string | undefined) {
    if (!(key in savedEnv)) {
      // Distinguish "never set" from "set to empty string" so afterEach can restore correctly
      savedEnv[key] = key in process.env ? process.env[key] ?? '' : UNSET;
    }
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // Helper to build a valid SplitModelConfig
  function makeConfig(overrides?: Partial<{ harness: Partial<ModelConfig>; generation: Partial<ModelConfig>; evaluator: Partial<ModelConfig>; fallbackToGeneration: boolean }>): SplitModelConfig {
    return {
      harness: {
        provider: 'openai',
        baseUrl: 'http://localhost:1234/v1',
        model: 'test-harness-model',
        apiKey: 'harness-key',
        temperature: 0.2,
        maxTokens: 4096,
        timeout: 120000,
        ...overrides?.harness,
      },
      generation: {
        provider: 'openai',
        baseUrl: 'http://localhost:1234/v1',
        model: 'test-gen-model',
        apiKey: 'gen-key',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 120000,
        ...overrides?.generation,
      },
      evaluator: {
        provider: 'openai',
        baseUrl: 'http://localhost:1234/v1',
        model: 'test-eval-model',
        apiKey: 'eval-key',
        temperature: 0.2,
        maxTokens: 4096,
        timeout: 120000,
        ...overrides?.evaluator,
      },
      fallbackToGeneration: overrides?.fallbackToGeneration ?? true,
    };
  }

  // ── loadGenerationConfig ──

  describe('loadGenerationConfig', () => {
    it('returns defaults when no env vars are set', () => {
      const config = loadGenerationConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
      expect(config.model).toBe('unknown');
      expect(config.apiKey).toBeUndefined();
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
      expect(config.timeout).toBe(120000);
    });

    it('reads LIMINAL_LLM_BASE_URL from environment', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://api.openai.com/v1');
      const config = loadGenerationConfig();
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('reads LIMINAL_LLM_MODEL from environment', () => {
      setEnv('LIMINAL_LLM_MODEL', 'gpt-4');
      const config = loadGenerationConfig();
      expect(config.model).toBe('gpt-4');
    });

    it('reads LIMINAL_LLM_API_KEY from environment', () => {
      setEnv('LIMINAL_LLM_API_KEY', 'sk-test123');
      const config = loadGenerationConfig();
      expect(config.apiKey).toBe('sk-test123');
    });

    it('reads LIMINAL_LLM_TEMPERATURE from environment', () => {
      setEnv('LIMINAL_LLM_TEMPERATURE', '0.5');
      const config = loadGenerationConfig();
      expect(config.temperature).toBe(0.5);
    });

    it('reads LIMINAL_LLM_MAX_TOKENS from environment', () => {
      setEnv('LIMINAL_LLM_MAX_TOKENS', '8192');
      const config = loadGenerationConfig();
      expect(config.maxTokens).toBe(8192);
    });

    it('reads LIMINAL_LLM_TIMEOUT from environment', () => {
      setEnv('LIMINAL_LLM_TIMEOUT', '60000');
      const config = loadGenerationConfig();
      expect(config.timeout).toBe(60000);
    });

    it('calls detectProviderType with baseUrl and model', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://api.anthropic.com/v1');
      setEnv('LIMINAL_LLM_MODEL', 'claude-3');
      loadGenerationConfig();
      expect(mockDetectProviderType).toHaveBeenCalledWith('https://api.anthropic.com/v1', 'claude-3');
    });
  });

  // ── loadHarnessConfig ──

  describe('loadHarnessConfig', () => {
    it('falls back to LLM_BASE_URL when HARNESS_BASE_URL is not set', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://fallback.example.com/v1');
      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('https://fallback.example.com/v1');
    });

    it('prefers HARNESS_BASE_URL over LLM_BASE_URL', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://fallback.example.com/v1');
      setEnv('LIMINAL_HARNESS_BASE_URL', 'https://harness.example.com/v1');
      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('https://harness.example.com/v1');
    });

    it('falls back to LLM_MODEL when HARNESS_MODEL is not set', () => {
      setEnv('LIMINAL_LLM_MODEL', 'fallback-model');
      const config = loadHarnessConfig();
      expect(config.model).toBe('fallback-model');
    });

    it('prefers HARNESS_MODEL over LLM_MODEL', () => {
      setEnv('LIMINAL_LLM_MODEL', 'fallback-model');
      setEnv('LIMINAL_HARNESS_MODEL', 'harness-model');
      const config = loadHarnessConfig();
      expect(config.model).toBe('harness-model');
    });

    it('falls back to LLM_API_KEY when HARNESS_API_KEY is not set', () => {
      setEnv('LIMINAL_LLM_API_KEY', 'llm-key');
      const config = loadHarnessConfig();
      expect(config.apiKey).toBe('llm-key');
    });

    it('prefers HARNESS_API_KEY over LLM_API_KEY', () => {
      setEnv('LIMINAL_LLM_API_KEY', 'llm-key');
      setEnv('LIMINAL_HARNESS_API_KEY', 'harness-key');
      const config = loadHarnessConfig();
      expect(config.apiKey).toBe('harness-key');
    });

    it('defaults baseUrl to localhost when nothing is set', () => {
      const config = loadHarnessConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('defaults model to "unknown" when nothing is set', () => {
      const config = loadHarnessConfig();
      expect(config.model).toBe('unknown');
    });

    it('uses default harness temperature of 0.2', () => {
      const config = loadHarnessConfig();
      expect(config.temperature).toBe(0.2);
    });

    it('reads custom HARNESS_TEMPERATURE', () => {
      setEnv('LIMINAL_HARNESS_TEMPERATURE', '0.5');
      const config = loadHarnessConfig();
      expect(config.temperature).toBe(0.5);
    });

    it('reads custom HARNESS_MAX_TOKENS', () => {
      setEnv('LIMINAL_HARNESS_MAX_TOKENS', '2048');
      const config = loadHarnessConfig();
      expect(config.maxTokens).toBe(2048);
    });

    it('reads custom HARNESS_TIMEOUT', () => {
      setEnv('LIMINAL_HARNESS_TIMEOUT', '30000');
      const config = loadHarnessConfig();
      expect(config.timeout).toBe(30000);
    });
  });

  // ── loadEvaluatorConfig ──

  describe('loadEvaluatorConfig', () => {
    it('falls back to LLM_BASE_URL when EVALUATOR_BASE_URL is not set', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://fallback.example.com/v1');
      const config = loadEvaluatorConfig();
      expect(config.baseUrl).toBe('https://fallback.example.com/v1');
    });

    it('prefers EVALUATOR_BASE_URL over LLM_BASE_URL', () => {
      setEnv('LIMINAL_LLM_BASE_URL', 'https://fallback.example.com/v1');
      setEnv('LIMINAL_EVALUATOR_BASE_URL', 'https://eval.example.com/v1');
      const config = loadEvaluatorConfig();
      expect(config.baseUrl).toBe('https://eval.example.com/v1');
    });

    it('falls back to LLM_MODEL when EVALUATOR_MODEL is not set', () => {
      setEnv('LIMINAL_LLM_MODEL', 'fallback-model');
      const config = loadEvaluatorConfig();
      expect(config.model).toBe('fallback-model');
    });

    it('prefers EVALUATOR_MODEL over LLM_MODEL', () => {
      setEnv('LIMINAL_LLM_MODEL', 'fallback-model');
      setEnv('LIMINAL_EVALUATOR_MODEL', 'eval-model');
      const config = loadEvaluatorConfig();
      expect(config.model).toBe('eval-model');
    });

    it('falls back to LLM_API_KEY when EVALUATOR_API_KEY is not set', () => {
      setEnv('LIMINAL_LLM_API_KEY', 'llm-key');
      const config = loadEvaluatorConfig();
      expect(config.apiKey).toBe('llm-key');
    });

    it('prefers EVALUATOR_API_KEY over LLM_API_KEY', () => {
      setEnv('LIMINAL_LLM_API_KEY', 'llm-key');
      setEnv('LIMINAL_EVALUATOR_API_KEY', 'eval-key');
      const config = loadEvaluatorConfig();
      expect(config.apiKey).toBe('eval-key');
    });

    it('defaults baseUrl to localhost when nothing is set', () => {
      const config = loadEvaluatorConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('defaults model to "unknown" when nothing is set', () => {
      const config = loadEvaluatorConfig();
      expect(config.model).toBe('unknown');
    });

    it('uses default evaluator temperature of 0.2', () => {
      const config = loadEvaluatorConfig();
      expect(config.temperature).toBe(0.2);
    });

    it('reads custom EVALUATOR_TEMPERATURE', () => {
      setEnv('LIMINAL_EVALUATOR_TEMPERATURE', '0.3');
      const config = loadEvaluatorConfig();
      expect(config.temperature).toBe(0.3);
    });

    it('reads custom EVALUATOR_MAX_TOKENS', () => {
      setEnv('LIMINAL_EVALUATOR_MAX_TOKENS', '16384');
      const config = loadEvaluatorConfig();
      expect(config.maxTokens).toBe(16384);
    });

    it('reads custom EVALUATOR_TIMEOUT', () => {
      setEnv('LIMINAL_EVALUATOR_TIMEOUT', '45000');
      const config = loadEvaluatorConfig();
      expect(config.timeout).toBe(45000);
    });
  });

  // ── loadModelConfig (composite) ──

  describe('loadModelConfig', () => {
    it('returns all three role configs with defaults', () => {
      const config = loadModelConfig();
      expect(config.harness).not.toBeNull();
      expect(config.generation).not.toBeNull();
      expect(config.evaluator).not.toBeNull();
      expect(config.fallbackToGeneration).toBe(true);
    });

    it('sets fallbackToGeneration to true by default', () => {
      const config = loadModelConfig();
      expect(config.fallbackToGeneration).toBe(true);
    });

    it('sets fallbackToGeneration to false when LIMINAL_HARNESS_FALLBACK is "false"', () => {
      setEnv('LIMINAL_HARNESS_FALLBACK', 'false');
      const config = loadModelConfig();
      expect(config.fallbackToGeneration).toBe(false);
    });

    it('sets fallbackToGeneration to true when LIMINAL_HARNESS_FALLBACK is "true"', () => {
      setEnv('LIMINAL_HARNESS_FALLBACK', 'true');
      const config = loadModelConfig();
      expect(config.fallbackToGeneration).toBe(true);
    });

    it('sets fallbackToGeneration to true for any value other than "false"', () => {
      setEnv('LIMINAL_HARNESS_FALLBACK', 'yes');
      const config = loadModelConfig();
      expect(config.fallbackToGeneration).toBe(true);
    });
  });

  // ── validateModelConfig ──

  describe('validateModelConfig', () => {
    it('returns valid=true for a fully configured setup', () => {
      const config = makeConfig();
      const result = validateModelConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns error when harness baseUrl is empty', () => {
      const config = makeConfig({ harness: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining(['LIMINAL_HARNESS_BASE_URL or LIMINAL_LLM_BASE_URL is required'])
      );
    });

    it('returns error when generation baseUrl is empty', () => {
      const config = makeConfig({ generation: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining(['LIMINAL_LLM_BASE_URL is required'])
      );
    });

    it('returns error when harness baseUrl is empty string (falsy)', () => {
      const config = makeConfig({ harness: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('HARNESS_BASE_URL');
    });

    it('returns error when generation baseUrl is empty string (falsy)', () => {
      const config = makeConfig({ generation: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('LLM_BASE_URL');
    });

    it('returns multiple errors when both harness and generation baseUrl are empty', () => {
      const config = makeConfig({ harness: { baseUrl: '' }, generation: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.errors).toHaveLength(2);
    });

    it('warns when harness model is "unknown"', () => {
      const config = makeConfig({ harness: { model: 'unknown' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Harness model not explicitly set')])
      );
    });

    it('warns when harness model is empty string', () => {
      const config = makeConfig({ harness: { model: '' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Harness model not explicitly set')])
      );
    });

    it('does not warn when harness model is explicitly set', () => {
      const config = makeConfig({ harness: { model: 'qwen2.5-coder-7b' } });
      const result = validateModelConfig(config);
      const harnessModelWarning = result.warnings.some(w => w.includes('Harness model'));
      expect(harnessModelWarning).toBe(false);
    });

    it('warns when generation model is "unknown"', () => {
      const config = makeConfig({ generation: { model: 'unknown' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Generation model not explicitly set')])
      );
    });

    it('warns when generation model is empty string', () => {
      const config = makeConfig({ generation: { model: '' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Generation model not explicitly set')])
      );
    });

    it('warns when evaluator baseUrl is empty', () => {
      const config = makeConfig({ evaluator: { baseUrl: '' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Evaluator base URL not set')])
      );
    });

    it('warns when evaluator model is "unknown"', () => {
      const config = makeConfig({ evaluator: { model: 'unknown' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Evaluator model not explicitly set')])
      );
    });

    it('warns when evaluator model is empty string', () => {
      const config = makeConfig({ evaluator: { model: '' } });
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Evaluator model not explicitly set')])
      );
    });

    it('warns when harness and generation use identical configs', () => {
      // The identical-config check compares:
      // harness.model === generation.baseUrl AND harness.baseUrl === generation.baseUrl AND harness.temperature === generation.temperature
      // This is likely a bug in the source (comparing model to baseUrl), but we test the actual behavior
      const sharedBaseUrl = 'http://localhost:1234/v1';
      const config: SplitModelConfig = {
        harness: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: sharedBaseUrl, // Intentionally set model to baseUrl to trigger the warning
          apiKey: 'key',
          temperature: 0.7,
          maxTokens: 4096,
          timeout: 120000,
        },
        generation: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: 'any-model',
          apiKey: 'key',
          temperature: 0.7,
          maxTokens: 4096,
          timeout: 120000,
        },
        evaluator: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: 'eval-model',
          apiKey: 'key',
          temperature: 0.2,
          maxTokens: 4096,
          timeout: 120000,
        },
        fallbackToGeneration: true,
      };
      const result = validateModelConfig(config);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('identical configs')])
      );
    });

    it('does not warn about identical configs when temperatures differ', () => {
      const sharedBaseUrl = 'http://localhost:1234/v1';
      const config: SplitModelConfig = {
        harness: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: sharedBaseUrl,
          apiKey: 'key',
          temperature: 0.2, // Different from generation
          maxTokens: 4096,
          timeout: 120000,
        },
        generation: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: 'any-model',
          apiKey: 'key',
          temperature: 0.7,
          maxTokens: 4096,
          timeout: 120000,
        },
        evaluator: {
          provider: 'openai',
          baseUrl: sharedBaseUrl,
          model: 'eval-model',
          apiKey: 'key',
          temperature: 0.2,
          maxTokens: 4096,
          timeout: 120000,
        },
        fallbackToGeneration: true,
      };
      const result = validateModelConfig(config);
      const identicalWarning = result.warnings.some(w => w.includes('identical'));
      expect(identicalWarning).toBe(false);
    });

    it('returns valid=true even when there are warnings', () => {
      const config = makeConfig({ harness: { model: 'unknown' } });
      const result = validateModelConfig(config);
      // Debug: check what's in errors
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── formatModelConfig ──

  describe('formatModelConfig', () => {
    it('produces a string containing all three role labels', () => {
      const config = makeConfig();
      const output = formatModelConfig(config);
      expect(output).toContain('HARNESS');
      expect(output).toContain('GENERATION');
      expect(output).toContain('EVALUATOR');
    });

    it('includes the model names in output', () => {
      const config = makeConfig({
        harness: { model: 'harness-test-model' },
        generation: { model: 'gen-test-model' },
        evaluator: { model: 'eval-test-model' },
      });
      const output = formatModelConfig(config);
      expect(output).toContain('harness-test-model');
      expect(output).toContain('gen-test-model');
      expect(output).toContain('eval-test-model');
    });

    it('includes base URLs in output', () => {
      const config = makeConfig({
        harness: { baseUrl: 'https://h.example.com/v1' },
        generation: { baseUrl: 'https://g.example.com/v1' },
        evaluator: { baseUrl: 'https://e.example.com/v1' },
      });
      const output = formatModelConfig(config);
      expect(output).toContain('https://h.example.com/v1');
      expect(output).toContain('https://g.example.com/v1');
      expect(output).toContain('https://e.example.com/v1');
    });

    it('shows temperature values for each role', () => {
      const config = makeConfig({
        harness: { temperature: 0.1 },
        generation: { temperature: 0.9 },
        evaluator: { temperature: 0.3 },
      });
      const output = formatModelConfig(config);
      expect(output).toContain('0.1');
      expect(output).toContain('0.9');
      expect(output).toContain('0.3');
    });

    it('shows maxTokens for each role', () => {
      const config = makeConfig({
        harness: { maxTokens: 2048 },
        generation: { maxTokens: 8192 },
        evaluator: { maxTokens: 4096 },
      });
      const output = formatModelConfig(config);
      expect(output).toContain('2048');
      expect(output).toContain('8192');
    });

    it('shows "enabled" when fallbackToGeneration is true', () => {
      const config = makeConfig({ fallbackToGeneration: true });
      const output = formatModelConfig(config);
      expect(output).toContain('Fallback: enabled');
    });

    it('shows "disabled" when fallbackToGeneration is false', () => {
      const config = makeConfig({ fallbackToGeneration: false });
      const output = formatModelConfig(config);
      expect(output).toContain('Fallback: disabled');
    });

    it('includes provider type for each role', () => {
      const config = makeConfig({
        harness: { provider: 'anthropic' },
        generation: { provider: 'openai' },
        evaluator: { provider: 'ollama' },
      });
      const output = formatModelConfig(config);
      expect(output).toContain('anthropic');
      expect(output).toContain('openai');
      expect(output).toContain('ollama');
    });
  });

  // ── getModelEnvDocs ──

  describe('getModelEnvDocs', () => {
    it('returns a non-empty string', () => {
      const docs = getModelEnvDocs();
      expect(docs.length).toBeGreaterThan(100);
    });

    it('documents LIMINAL_HARNESS_BASE_URL', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('LIMINAL_HARNESS_BASE_URL');
    });

    it('documents LIMINAL_LLM_BASE_URL', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('LIMINAL_LLM_BASE_URL');
    });

    it('documents LIMINAL_EVALUATOR_BASE_URL', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('LIMINAL_EVALUATOR_BASE_URL');
    });

    it('documents temperature defaults', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('0.2');
      expect(docs).toContain('0.7');
    });

    it('documents max tokens default', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('4096');
    });

    it('documents timeout default', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('120000');
    });

    it('includes quick setup examples', () => {
      const docs = getModelEnvDocs();
      expect(docs).toContain('Quick Setup Examples');
    });
  });

  // ── Edge cases: NaN from bad env values ──

  describe('malformed environment variables', () => {
    it('handles NaN from non-numeric LLM_TEMPERATURE gracefully', () => {
      setEnv('LIMINAL_LLM_TEMPERATURE', 'not-a-number');
      const config = loadGenerationConfig();
      // parseFloat('not-a-number') => NaN — the module does not guard against this
      expect(config.temperature).toBeNaN();
    });

    it('handles NaN from non-numeric LLM_MAX_TOKENS gracefully', () => {
      setEnv('LIMINAL_LLM_MAX_TOKENS', 'abc');
      const config = loadGenerationConfig();
      expect(config.maxTokens).toBeNaN();
    });

    it('handles NaN from non-numeric LLM_TIMEOUT gracefully', () => {
      setEnv('LIMINAL_LLM_TIMEOUT', 'xyz');
      const config = loadGenerationConfig();
      expect(config.timeout).toBeNaN();
    });

    it('handles NaN from non-numeric HARNESS_TEMPERATURE', () => {
      setEnv('LIMINAL_HARNESS_TEMPERATURE', 'bad');
      const config = loadHarnessConfig();
      expect(config.temperature).toBeNaN();
    });

    it('handles NaN from non-numeric EVALUATOR_TEMPERATURE', () => {
      setEnv('LIMINAL_EVALUATOR_TEMPERATURE', 'bad');
      const config = loadEvaluatorConfig();
      expect(config.temperature).toBeNaN();
    });

    it('handles empty string env vars for numeric fields', () => {
      setEnv('LIMINAL_LLM_TEMPERATURE', '');
      // parseFloat('') => NaN, falls back to default via || '0.7'
      // Actually: process.env.LIMINAL_LLM_TEMPERATURE is '' which is falsy,
      // so String(DEFAULT_GENERATION_TEMPERATURE) is used
      const config = loadGenerationConfig();
      expect(config.temperature).toBe(0.7);
    });

    it('handles empty string env var for base URL', () => {
      setEnv('LIMINAL_LLM_BASE_URL', '');
      // '' is falsy, falls back to localhost default
      const config = loadGenerationConfig();
      expect(config.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('handles empty string env var for model', () => {
      setEnv('LIMINAL_LLM_MODEL', '');
      const config = loadGenerationConfig();
      expect(config.model).toBe('unknown');
    });
  });

  // ── Provider detection delegation ──

  describe('provider detection', () => {
    it('passes harness baseUrl and model to detectProviderType', () => {
      setEnv('LIMINAL_HARNESS_BASE_URL', 'http://harness:1234/v1');
      setEnv('LIMINAL_HARNESS_MODEL', 'hmodel');
      loadHarnessConfig();
      expect(mockDetectProviderType).toHaveBeenCalledWith('http://harness:1234/v1', 'hmodel');
    });

    it('passes evaluator baseUrl and model to detectProviderType', () => {
      setEnv('LIMINAL_EVALUATOR_BASE_URL', 'http://eval:1234/v1');
      setEnv('LIMINAL_EVALUATOR_MODEL', 'emodel');
      loadEvaluatorConfig();
      expect(mockDetectProviderType).toHaveBeenCalledWith('http://eval:1234/v1', 'emodel');
    });

    it('returns the provider type from detectProviderType', () => {
      mockDetectProviderType.mockReturnValue('anthropic');
      setEnv('LIMINAL_LLM_BASE_URL', 'https://api.anthropic.com/v1');
      const config = loadGenerationConfig();
      expect(config.provider).toBe('anthropic');
    });
  });
});
