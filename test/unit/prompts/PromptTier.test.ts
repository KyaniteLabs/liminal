import { describe, expect, it } from 'vitest';
import { resolvePromptTier, tiered } from '../../../src/prompts/PromptTier';

describe('resolvePromptTier', () => {
  it('routes local providers to compact regardless of model name', () => {
    expect(resolvePromptTier('gemma4:12b', 'ollama')).toBe('compact');
    expect(resolvePromptTier('some-huge-model', 'lmstudio')).toBe('compact');
  });

  it('routes known small models to compact on any provider', () => {
    expect(resolvePromptTier('gemma4:12b')).toBe('compact');
    expect(resolvePromptTier('qwen3:14b', 'custom')).toBe('compact');
    expect(resolvePromptTier('llama3.1:8b')).toBe('compact');
    expect(resolvePromptTier('gpt-5-mini')).toBe('compact');
    expect(resolvePromptTier('gemini-2.0-nano')).toBe('compact');
  });

  it('routes frontier cloud models to full', () => {
    expect(resolvePromptTier('glm-5v-turbo', 'glm')).toBe('full');
    expect(resolvePromptTier('MiniMax-M3', 'minimax')).toBe('full');
    expect(resolvePromptTier('claude-opus-4-5', 'anthropic')).toBe('full');
    expect(resolvePromptTier('gemini-2.5-pro', 'google')).toBe('full');
  });

  it('parses parameter-count suffixes: ≤14b compact, larger full', () => {
    expect(resolvePromptTier('qwen2.5:7b')).toBe('compact');
    expect(resolvePromptTier('devstral:24b', 'custom')).toBe('full');
    expect(resolvePromptTier('llama3:70b', 'custom')).toBe('full');
  });

  it('honors explicit config overrides over heuristics', () => {
    expect(resolvePromptTier('glm-5v-turbo', 'glm', { 'glm-5v-*': 'compact' })).toBe('compact');
    expect(resolvePromptTier('gemma4:12b', 'ollama', { 'gemma4:*': 'full' })).toBe('full');
  });

  it('defaults to full for unknown models (frontier assumption)', () => {
    expect(resolvePromptTier('mystery-model-x', 'custom')).toBe('full');
  });
});

describe('tiered', () => {
  it('picks the variant for the tier', () => {
    expect(tiered({ full: 'FULL', compact: 'SHORT' }, 'compact')).toBe('SHORT');
    expect(tiered({ full: 'FULL', compact: 'SHORT' }, 'full')).toBe('FULL');
  });

  it('falls back to full when compact is not authored', () => {
    expect(tiered({ full: 'FULL' }, 'compact')).toBe('FULL');
  });
});
