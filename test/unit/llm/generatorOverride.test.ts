/**
 * Hybrid dispatch — the LLMClient override mechanism. A role:'generator' client
 * built inside runWithGeneratorOverride is redirected to the local endpoint;
 * everything else is untouched. These pin the bounded, opt-in safety properties.
 */
import { describe, it, expect } from 'vitest';
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { runWithGeneratorOverride, getActiveGeneratorOverride } from '../../../src/llm/generatorOverrideContext.js';

const LOCAL = { baseUrl: 'http://100.113.174.74:11434/v1', model: 'gemma3:4b' };

describe('generator endpoint override (hybrid dispatch)', () => {
  it('redirects a role:generator client to the local override inside the context', () => {
    runWithGeneratorOverride(LOCAL, () => {
      const c = new LLMClient({ role: 'generator' });
      expect(c.getConfig().baseUrl).toBe(LOCAL.baseUrl);
      expect(c.getConfig().model).toBe(LOCAL.model);
    });
  });

  it('does NOT affect a role:generator client built outside the context', () => {
    const c = new LLMClient({ role: 'generator' });
    expect(c.getConfig().baseUrl).not.toBe(LOCAL.baseUrl);
  });

  it('does NOT redirect non-generator roles even inside the context', () => {
    runWithGeneratorOverride(LOCAL, () => {
      const c = new LLMClient({ role: 'evaluator' });
      expect(c.getConfig().baseUrl).not.toBe(LOCAL.baseUrl);
    });
  });

  it('lets an explicit baseUrl win over the override', () => {
    runWithGeneratorOverride(LOCAL, () => {
      const c = new LLMClient({ role: 'generator', baseUrl: 'http://explicit:1234/v1', model: 'x' });
      expect(c.getConfig().baseUrl).toBe('http://explicit:1234/v1');
    });
  });

  it('treats a null override as a no-op', () => {
    runWithGeneratorOverride(null, () => {
      expect(getActiveGeneratorOverride()).toBeUndefined();
      const c = new LLMClient({ role: 'generator' });
      expect(c.getConfig().baseUrl).not.toBe(LOCAL.baseUrl);
    });
  });

  it('does not leak the override outside the scoped callback', () => {
    runWithGeneratorOverride(LOCAL, () => undefined);
    expect(getActiveGeneratorOverride()).toBeUndefined();
  });
});
