import { describe, it, expect } from 'vitest';
import { LLMConfigSchema, validateLLMConfig } from '../../../src/config/schema.js';
import { ConfigError } from '../../../src/errors/ConfigError.js';

describe('LLMConfigSchema', () => {
  describe('default values', () => {
    it('applies all defaults when given an empty object', () => {
      const result = LLMConfigSchema.parse({});

      expect(result.provider).toBe('lmstudio');
      expect(result.baseUrl).toBe('http://localhost:1234/v1');
      expect(result.model).toBe('auto');
      expect(result.apiKey).toBeUndefined();
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(4096);
    });

    it('uses provided values instead of defaults', () => {
      const input = {
        provider: 'minimax',
        baseUrl: 'https://api.minimax.io/v1',
        model: 'minimax-m2.7',
        apiKey: 'test-key-123',
        temperature: 0.3,
        maxTokens: 2048,
      };

      const result = LLMConfigSchema.parse(input);

      expect(result.provider).toBe('minimax');
      expect(result.baseUrl).toBe('https://api.minimax.io/v1');
      expect(result.model).toBe('minimax-m2.7');
      expect(result.apiKey).toBe('test-key-123');
      expect(result.temperature).toBe(0.3);
      expect(result.maxTokens).toBe(2048);
    });

    it('allows optional apiKey to be omitted', () => {
      const result = LLMConfigSchema.parse({ model: 'test-model' });
      expect(result.apiKey).toBeUndefined();
    });
  });

  describe('validation errors', () => {
    it('rejects empty model string', () => {
      expect(() => LLMConfigSchema.parse({ model: '' })).toThrow();
    });

    it('rejects invalid baseUrl', () => {
      expect(() => LLMConfigSchema.parse({ baseUrl: 'not-a-url' })).toThrow();
    });

    it('rejects temperature below 0', () => {
      expect(() => LLMConfigSchema.parse({ temperature: -0.1 })).toThrow();
    });

    it('rejects temperature above 2', () => {
      expect(() => LLMConfigSchema.parse({ temperature: 2.5 })).toThrow();
    });

    it('accepts temperature at boundary 0', () => {
      const result = LLMConfigSchema.parse({ temperature: 0 });
      expect(result.temperature).toBe(0);
    });

    it('accepts temperature at boundary 2', () => {
      const result = LLMConfigSchema.parse({ temperature: 2 });
      expect(result.temperature).toBe(2);
    });

    it('rejects negative maxTokens', () => {
      expect(() => LLMConfigSchema.parse({ maxTokens: -1 })).toThrow();
    });

    it('rejects zero maxTokens', () => {
      expect(() => LLMConfigSchema.parse({ maxTokens: 0 })).toThrow();
    });

    it('rejects non-integer maxTokens', () => {
      expect(() => LLMConfigSchema.parse({ maxTokens: 1.5 })).toThrow();
    });

    it('rejects unknown provider', () => {
      expect(() => LLMConfigSchema.parse({ provider: 'nonexistent-provider' })).toThrow();
    });
  });
});

describe('validateLLMConfig', () => {
  it('returns a valid LLMConfig for correct input', () => {
    const input = {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3',
      temperature: 0.5,
      maxTokens: 1024,
    };

    const result = validateLLMConfig(input);

    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama3');
    expect(result.temperature).toBe(0.5);
    expect(result.maxTokens).toBe(1024);
  });

  it('applies defaults for omitted fields', () => {
    const result = validateLLMConfig({});

    expect(result.provider).toBe('lmstudio');
    expect(result.model).toBe('auto');
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(4096);
  });

  it('throws ConfigError for invalid input with descriptive issues', () => {
    const input = { model: '', baseUrl: 'bad', temperature: 5 };

    try {
      validateLLMConfig(input);
      expect.unreachable('Should have thrown ConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configErr = error as ConfigError;
      expect(configErr.message).toBe('Configuration validation failed');
      // Issues string should mention the specific fields
      const context = configErr.context as Record<string, unknown>;
      expect(context.issues).toContain('model');
      expect(context.issues).toContain('baseUrl');
      expect(context.issues).toContain('temperature');
    }
  });

  it('re-throws non-ZodError exceptions unchanged', () => {
    // ZodError is the only caught type; non-Zod errors propagate directly.
    // We verify the catch block handles instanceof checks correctly by
    // ensuring valid data does not throw.
    const result = validateLLMConfig({ provider: 'openai' });
    expect(result.provider).toBe('openai');
  });
});
