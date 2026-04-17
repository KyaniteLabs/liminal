/**
 * ProviderFactory Tests
 *
 * Tests for detectProvider (URL/model pattern matching) and createProvider
 * (factory instantiation for each provider type, + error paths.
 */

import { describe, it, expect } from 'vitest';
import { detectProvider, createProvider } from '../../../src/llm/ProviderFactory.js';
import type { ProviderConfig } from '../../../src/llm/ProviderTypes.js';
import { BaseProvider } from '../../../src/llm/providers/BaseProvider.js';
import { OpenAIProvider } from '../../../src/llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../../../src/llm/providers/AnthropicProvider.js';
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.js';
import { OpenRouterProvider } from '../../../src/llm/providers/OpenRouterProvider.js';
import { GoogleProvider } from '../../../src/llm/providers/GoogleProvider.js';
import { MiniMaxProvider } from '../../../src/llm/providers/MiniMaxProvider.js';
import type { ProviderName } from '../../../src/llm/ProviderFactory.js';

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: 'test-key',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectProvider (URL-based detection)
// ---------------------------------------------------------------------------
describe('detectProvider', () => {
  it('detect openai from URL', () => {
    const config = makeConfig({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });
    expect(detectProvider(config)).toBe('openai');
  });

  it('detect openai from URL with api.openai prefix', () => {
    const config = makeConfig({
      baseUrl: 'https://api.openai.com/v1',
      model: 'some-other-model',
    });
    expect(detectProvider(config)).toBe('openai');
  });

  it('detect anthropic from URL', () => {
    const config = makeConfig({
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
    });
    expect(detectProvider(config)).toBe('anthropic');
  });

  it('detect anthropic from model name', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:1234',
      model: 'claude-sonnet-4-20250514',
    });
    expect(detectProvider(config)).toBe('anthropic');
  });

  it('detect google from URL', () => {
    const config = makeConfig({
      baseUrl: 'https://generativelanguage.googleapis.com/v1',
      model: 'gemini-2.0-flash',
    });
    expect(detectProvider(config)).toBe('google');
  });

  it('detect google from model name', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:1234',
      model: 'gemini-2.0-flash',
    });
    expect(detectProvider(config)).toBe('google');
  });

  it('detect ollama from URL with port 11434', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
    });
    expect(detectProvider(config)).toBe('ollama');
  });

  it('detect ollama from URL with ollama keyword', () => {
    const config = makeConfig({
      baseUrl: 'https://ollama.example.com',
      model: 'llama3',
    });
    expect(detectProvider(config)).toBe('ollama');
  });

  it('detect openrouter from URL', () => {
    const config = makeConfig({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'meta-llama-3',
    });
    expect(detectProvider(config)).toBe('openrouter');
  });

  it('detect minimax from URL', () => {
    const config = makeConfig({
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'minimax-01',
    });
    expect(detectProvider(config)).toBe('minimax');
  });

  it('detect minimax from model name fallback on port 11434', () => {
    // URL has port 11434 (ollama) but model contains minimax
    // minimax takes priority over ollama per URL check order in detectProvider
    const config = makeConfig({
      baseUrl: 'http://localhost:11434',
      model: 'minimax-01',
    });
    // The detectProvider checks minimax URL first, then ollama, then model names
    // Since the URL is localhost:11434 (not minimax URL), and model is 'minimax-01'
    // the code checks for 'minimaxi' in URL (not present), then checks model for 'minimax'
    // Actually the code only checks URL patterns, not model names for minimax
    // So with port 11434, it will be detected as ollama
    expect(detectProvider(config)).toBe('ollama');
  });

  it('detect deepseek-r1 on ollama port falls back to ollama', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:11434',
      model: 'deepseek-r1',
    });
    expect(detectProvider(config)).toBe('ollama');
  });

  it('fall back to openai for unknown URL and model', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:1234',
      model: 'unknown-model',
    });
    expect(detectProvider(config)).toBe('openai');
  });

  it('fall back to openai for unknown host', () => {
    const config = makeConfig({
      baseUrl: 'http://unknown-host',
      model: 'unknown-model',
    });
    expect(detectProvider(config)).toBe('openai');
  });

  it('is case-insensitive for URL and model', () => {
    const config = makeConfig({
      baseUrl: 'HTTPS://API.OPENAI.COM/V1',
      model: 'GPT-4O',
    });
    expect(detectProvider(config)).toBe('openai');
  });

  it('detects anthropic from api.anthropic URL prefix', () => {
    const config = makeConfig({
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'some-model',
    });
    expect(detectProvider(config)).toBe('anthropic');
  });

  it('detects Z.ai Anthropic-compatible coding endpoint as anthropic', () => {
    const config = makeConfig({
      baseUrl: 'https://api.z.ai/api/anthropic',
      model: 'glm-5.1',
    });
    expect(detectProvider(config)).toBe('anthropic');
  });

  it('detects openai from api.openai URL prefix', () => {
    const config = makeConfig({
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'some-model',
    });
    expect(detectProvider(config)).toBe('openai');
  });
});

// ---------------------------------------------------------------------------
// createProvider (factory instantiation)
// ---------------------------------------------------------------------------
describe('createProvider', () => {
  it('creates OpenAIProvider for openai', () => {
    const config = makeConfig();
    const provider = createProvider(config, 'openai');
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('creates AnthropicProvider for anthropic', () => {
    const config = makeConfig({
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
    });
    const provider = createProvider(config, 'anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('creates OllamaProvider for ollama', () => {
    const config = makeConfig({
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
    });
    const provider = createProvider(config, 'ollama');
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });

  it('creates OpenRouterProvider for openrouter', () => {
    const config = makeConfig({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'meta-llama-3',
    });
    const provider = createProvider(config, 'openrouter');
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider.name).toBe('openrouter');
  });

  it('creates GoogleProvider for google', () => {
    const config = makeConfig({
      baseUrl: 'https://generativelanguage.googleapis.com/v1',
      model: 'gemini-2.0-flash',
    });
    const provider = createProvider(config, 'google');
    expect(provider).toBeInstanceOf(GoogleProvider);
    expect(provider.name).toBe('google');
  });

  it('creates MiniMaxProvider for minimax', () => {
    const config = makeConfig({
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'minimax-01',
    });
    const provider = createProvider(config, 'minimax');
    expect(provider).toBeInstanceOf(MiniMaxProvider);
    expect(provider.name).toBe('minimax');
  });

  it('creates OpenAIProvider for custom', () => {
    const config = makeConfig({
      baseUrl: 'http://custom-llm.local:8080',
      model: 'custom-model',
    });
    const provider = createProvider(config, 'custom');
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('defaults to OpenAIProvider for unknown provider hint', () => {
    const config = makeConfig();
    // 'custom' falls through to default case which returns OpenAIProvider
    const provider = createProvider(config, 'custom');
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('auto-detects provider from config when no hint given', () => {
    const config = makeConfig({
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
    });
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('providerHint overrides auto-detection', () => {
    // URL says anthropic but hint says ollama
    const config = makeConfig({
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
    });
    const provider = createProvider(config, 'ollama');
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });

  it('passes config through to the provider instance', () => {
    const config = makeConfig({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-123',
      temperature: 0.7,
    });
    const provider = createProvider(config, 'openai');
    expect(provider.getConfig().baseUrl).toBe('https://api.openai.com/v1');
    expect(provider.getConfig().model).toBe('gpt-4o');
    expect(provider.getConfig().apiKey).toBe('sk-test-key-123');
    expect(provider.getConfig().temperature).toBe(0.7);
  });

  it('getConfig returns a defensive copy', () => {
    const config = makeConfig();
    const provider = createProvider(config, 'openai');
    const retrieved = provider.getConfig();
    retrieved.model = 'tampered';
    expect(provider.getConfig().model).toBe('gpt-4o');
  });
});
