import { describe, it, expect, beforeEach } from 'vitest';

import { CapabilityRegistry } from '../../../src/llm/CapabilityRegistry.js';

describe('CapabilityRegistry', () => {
  beforeEach(() => {
    CapabilityRegistry.clearOverrides();
  });

  describe('known models return correct capabilities', () => {
    it('claude-sonnet-4-20250514 has thinking, budget_tokens, 200K context', () => {
      const caps = CapabilityRegistry.getCapabilities('claude-sonnet-4-20250514');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('budget_tokens');
      expect(caps.maxContextTokens).toBe(200_000);
      expect(caps.streaming).toBe(true);
      expect(caps.jsonMode).toBe(true);
      expect(caps.toolUse).toBe(true);
      expect(caps.streamingStyle).toBe('sse');
    });

    it('gpt-5 has thinking, effort_level, 400K context', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-5');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('effort_level');
      expect(caps.maxContextTokens).toBe(400_000);
      expect(caps.streaming).toBe(true);
      expect(caps.toolUse).toBe(true);
    });

    it('gpt-4o has no thinking', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-4o');

      expect(caps.thinking).toBe(false);
      expect(caps.thinkingStyle).toBe('none');
    });

    it('gemini-2.5-pro has thinking, budget_tokens, 2M context', () => {
      const caps = CapabilityRegistry.getCapabilities('gemini-2.5-pro');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('budget_tokens');
      expect(caps.maxContextTokens).toBe(2_000_000);
    });

    it('deepseek-r1 has thinking with think_tags', () => {
      const caps = CapabilityRegistry.getCapabilities('deepseek-r1');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('think_tags');
    });

    it('qwen3.5-coder-14b has thinking', () => {
      const caps = CapabilityRegistry.getCapabilities('qwen3.5-coder-14b');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('budget_tokens');
      expect(caps.maxContextTokens).toBe(128_000);
    });

    it('gemma-4-31b-it has thinking, 256K context, think_tags', () => {
      const caps = CapabilityRegistry.getCapabilities('gemma-4-31b-it');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('think_tags');
      expect(caps.maxContextTokens).toBe(256_000);
      expect(caps.streamingStyle).toBe('sse');
    });

    it('gemma4:E4B (Ollama naming) has thinking, 128K context', () => {
      const caps = CapabilityRegistry.getCapabilities('gemma4:E4B');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('think_tags');
      expect(caps.maxContextTokens).toBe(128_000);
      expect(caps.streamingStyle).toBe('json_lines');
    });
  });

  describe('glob pattern matching', () => {
    it('claude-sonnet-4-* matches claude-sonnet-4-20250514', () => {
      const caps = CapabilityRegistry.getCapabilities('claude-sonnet-4-20250514');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('budget_tokens');
    });

    it('gpt-5* matches gpt-5-turbo', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-5-turbo');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('effort_level');
    });

    it('gpt-5* matches gpt-5.1', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-5.1');

      expect(caps.thinking).toBe(true);
      expect(caps.maxContextTokens).toBe(400_000);
    });

    it('gpt-5* matches gpt-5 (exact prefix)', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-5');

      expect(caps.thinking).toBe(true);
    });

    it('exact match works for non-wildcard patterns', () => {
      // qwen3.5-coder-14b is an exact (non-wildcard) pattern
      const caps = CapabilityRegistry.getCapabilities('qwen3.5-coder-14b');

      expect(caps.thinking).toBe(true);
      expect(caps.maxContextTokens).toBe(128_000);
    });

    it('more-specific pattern takes priority over less-specific wildcard', () => {
      // qwen3.5-coder-7b is exact match (no thinking), qwen3.5* is wildcard (thinking)
      // The longer pattern should win
      const caps7b = CapabilityRegistry.getCapabilities('qwen3.5-coder-7b');
      expect(caps7b.thinking).toBe(false);

      const capsWildcard = CapabilityRegistry.getCapabilities('qwen3.5-something-else');
      expect(capsWildcard.thinking).toBe(true);
    });
  });

  describe('user overrides take priority', () => {
    it('override sets capabilities for a model', () => {
      CapabilityRegistry.override('my-model', { thinking: true });

      const caps = CapabilityRegistry.getCapabilities('my-model');

      expect(caps.thinking).toBe(true);
    });

    it('override merges with defaults for unspecified fields', () => {
      CapabilityRegistry.override('my-model', { thinking: true });

      const caps = CapabilityRegistry.getCapabilities('my-model');

      expect(caps.thinking).toBe(true);
      expect(caps.streaming).toBe(true); // from DEFAULT_CAPABILITIES
      expect(caps.jsonMode).toBe(true); // from DEFAULT_CAPABILITIES
    });

    it('override takes priority over static registry', () => {
      // gpt-4o normally has thinking: false
      CapabilityRegistry.override('gpt-4o', { thinking: true, thinkingStyle: 'budget_tokens' });

      const caps = CapabilityRegistry.getCapabilities('gpt-4o');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('budget_tokens');
    });

    it('clearOverrides removes all overrides', () => {
      CapabilityRegistry.override('my-model', { thinking: true });
      CapabilityRegistry.clearOverrides();

      const caps = CapabilityRegistry.getCapabilities('my-model');

      // Should fall back to defaults (no match in static registry)
      expect(caps.thinking).toBe(false);
    });

    it('override can set maxContextTokens', () => {
      CapabilityRegistry.override('my-model', { maxContextTokens: 999_999 });

      const caps = CapabilityRegistry.getCapabilities('my-model');

      expect(caps.maxContextTokens).toBe(999_999);
    });
  });

  describe('unknown models return conservative defaults', () => {
    it('returns default capabilities for completely unknown model', () => {
      const caps = CapabilityRegistry.getCapabilities('unknown-model-xyz');

      expect(caps.thinking).toBe(false);
      expect(caps.streaming).toBe(true);
      expect(caps.jsonMode).toBe(true);
      expect(caps.toolUse).toBe(false);
      expect(caps.maxContextTokens).toBe(4096);
      expect(caps.thinkingStyle).toBe('none');
      expect(caps.streamingStyle).toBe('sse');
    });

    it('returns a new object each call (no shared references)', () => {
      const caps1 = CapabilityRegistry.getCapabilities('unknown-model-xyz');
      const caps2 = CapabilityRegistry.getCapabilities('unknown-model-xyz');

      expect(caps1).toEqual(caps2);
      expect(caps1).not.toBe(caps2);
    });
  });

  describe('priority order: overrides > static registry > defaults', () => {
    it('override wins over static registry for a known model', () => {
      // claude-sonnet-4-20250514 normally has maxContextTokens: 200000
      CapabilityRegistry.override('claude-sonnet-4-20250514', { maxContextTokens: 500_000 });

      const caps = CapabilityRegistry.getCapabilities('claude-sonnet-4-20250514');

      // Override merges with DEFAULT_CAPABILITIES, not the static registry entry.
      // So thinking falls back to the default (false), not the static registry (true).
      expect(caps.maxContextTokens).toBe(500_000);
      expect(caps.thinking).toBe(false); // from DEFAULT_CAPABILITIES, override didn't specify
    });

    it('static registry wins over defaults for a matched model', () => {
      const caps = CapabilityRegistry.getCapabilities('gpt-4o');

      // Static registry says 128000, defaults say 4096
      expect(caps.maxContextTokens).toBe(128_000);
    });

    it('after clearing override, static registry applies again', () => {
      CapabilityRegistry.override('gpt-4o', { maxContextTokens: 999_999 });
      expect(CapabilityRegistry.getCapabilities('gpt-4o').maxContextTokens).toBe(999_999);

      CapabilityRegistry.clearOverrides();
      expect(CapabilityRegistry.getCapabilities('gpt-4o').maxContextTokens).toBe(128_000);
    });

    it('unknown model with override still gets defaults for unspecified fields', () => {
      CapabilityRegistry.override('brand-new-model', { thinking: true, thinkingStyle: 'think_tags' });

      const caps = CapabilityRegistry.getCapabilities('brand-new-model');

      expect(caps.thinking).toBe(true);
      expect(caps.thinkingStyle).toBe('think_tags');
      expect(caps.streaming).toBe(true); // from defaults
      expect(caps.jsonMode).toBe(true); // from defaults
      expect(caps.maxContextTokens).toBe(4096); // from defaults
    });
  });
});
