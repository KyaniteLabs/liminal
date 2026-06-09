import { describe, it, expect } from 'vitest';
import {
  resolveOpenRouterModelAlias,
  OPENROUTER_MODEL_CATALOG,
} from '../../../src/tui-bridge/OpenRouterModelCatalog.js';

describe('OpenRouterModelCatalog', () => {
  it('has at least 3 entries', () => {
    expect(OPENROUTER_MODEL_CATALOG.length).toBeGreaterThanOrEqual(3);
  });

  it('each entry has alias, model, and label', () => {
    for (const entry of OPENROUTER_MODEL_CATALOG) {
      expect(entry.alias).toBeTruthy();
      expect(entry.model).toContain('/');
      expect(entry.label).toBeTruthy();
    }
  });

  it('resolves by alias', () => {
    const result = resolveOpenRouterModelAlias('claude');
    expect(result).not.toBeNull();
    expect(result!.alias).toBe('claude');
    expect(result!.model).toContain('anthropic');
  });

  it('resolves by full model name (case-insensitive)', () => {
    const result = resolveOpenRouterModelAlias('Anthropic/Claude-Sonnet-4-6');
    expect(result).not.toBeNull();
    expect(result!.alias).toBe('claude');
  });

  it('returns null for undefined input', () => {
    expect(resolveOpenRouterModelAlias(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveOpenRouterModelAlias('')).toBeNull();
  });

  it('returns null for unknown alias', () => {
    expect(resolveOpenRouterModelAlias('nonexistent-model')).toBeNull();
  });

  it('trims whitespace from input', () => {
    const result = resolveOpenRouterModelAlias('  claude  ');
    expect(result).not.toBeNull();
    expect(result!.alias).toBe('claude');
  });

  it('is case-insensitive for aliases', () => {
    expect(resolveOpenRouterModelAlias('CLAUDE')).not.toBeNull();
    expect(resolveOpenRouterModelAlias('Claude')).not.toBeNull();
    expect(resolveOpenRouterModelAlias('GEMINI-PRO')).not.toBeNull();
  });

  it('resolves glm alias', () => {
    const result = resolveOpenRouterModelAlias('glm');
    expect(result).not.toBeNull();
    expect(result!.model).toContain('glm');
  });

  it('resolves gpt-mini alias', () => {
    const result = resolveOpenRouterModelAlias('gpt-mini');
    expect(result).not.toBeNull();
    expect(result!.label).toContain('GPT');
  });
});
