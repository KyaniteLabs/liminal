import { describe, it, expect, vi } from 'vitest';
import { ModeAwareRouter, PRODUCT_MODES } from '../../../src/agent/ProductMode.js';
import type { IntentRouter } from '../../../src/agent/IntentRouter.js';
import type { IntentClassification } from '../../../src/agent/types.js';

function mockRouter(classification: IntentClassification): IntentRouter {
  return { classify: vi.fn().mockReturnValue(classification) } as unknown as IntentRouter;
}

describe('ModeAwareRouter', () => {
  const directClass = { intent: 'direct' as const, confidence: 'low' as const, input: 'hello' };
  const creativeClass = { intent: 'creative' as const, confidence: 'high' as const, topic: 'art', input: 'make art' };
  const engineeringClass = { intent: 'engineering' as const, confidence: 'medium' as const, topic: 'fix', input: 'fix the bug' };

  it('returns base classification when no mode is active', () => {
    const router = new ModeAwareRouter(
      mockRouter(directClass),
      () => undefined,
    );
    expect(router.classify('hello')).toEqual(directClass);
  });

  describe('ask mode', () => {
    const getMode = () => ({ mode: 'ask' as const });

    it('upgrades direct intent to engineering for inspection', () => {
      const router = new ModeAwareRouter(mockRouter(directClass), getMode);
      const result = router.classify('hello');
      expect(result.intent).toBe('engineering');
      expect(result.topic).toBe('inspect');
    });

    it('preserves non-direct intents', () => {
      const router = new ModeAwareRouter(mockRouter(creativeClass), getMode);
      const result = router.classify('make art');
      expect(result.intent).toBe('creative');
    });
  });

  describe('make mode', () => {
    const getMode = () => ({ mode: 'make' as const });

    it('upgrades direct intent to creative', () => {
      const router = new ModeAwareRouter(mockRouter(directClass), getMode);
      const result = router.classify('hello');
      expect(result.intent).toBe('creative');
      expect(result.topic).toBe('generate');
    });

    it('preserves non-direct intents', () => {
      const router = new ModeAwareRouter(mockRouter(engineeringClass), getMode);
      const result = router.classify('fix the bug');
      expect(result.intent).toBe('engineering');
    });
  });

  describe('remix mode', () => {
    const getMode = () => ({ mode: 'remix' as const });

    it('forces creative intent with remix topic', () => {
      const router = new ModeAwareRouter(mockRouter(directClass), getMode);
      const result = router.classify('hello');
      expect(result.intent).toBe('creative');
      expect(result.confidence).toBe('high');
      expect(result.topic).toBe('remix');
    });

    it('preserves existing topic when base router already classified one', () => {
      const router = new ModeAwareRouter(mockRouter(creativeClass), getMode);
      const result = router.classify('make art');
      expect(result.intent).toBe('creative');
      expect(result.topic).toBe('art');
    });
  });

  describe('improve mode', () => {
    const getMode = () => ({ mode: 'improve' as const });

    it('forces hybrid intent for quality improvement', () => {
      const router = new ModeAwareRouter(mockRouter(directClass), getMode);
      const result = router.classify('hello');
      expect(result.intent).toBe('hybrid');
      expect(result.confidence).toBe('high');
      expect(result.topic).toBe('improve');
    });

    it('overrides any base classification to hybrid', () => {
      const router = new ModeAwareRouter(mockRouter(creativeClass), getMode);
      const result = router.classify('make art');
      expect(result.intent).toBe('hybrid');
    });
  });
});

describe('PRODUCT_MODES constant', () => {
  it('has all four modes with labels and descriptions', () => {
    const modes = Object.keys(PRODUCT_MODES);
    expect(modes).toEqual(['ask', 'make', 'remix', 'improve']);
    for (const mode of modes) {
      expect(PRODUCT_MODES[mode as keyof typeof PRODUCT_MODES].label.length).toBeGreaterThan(0);
      expect(PRODUCT_MODES[mode as keyof typeof PRODUCT_MODES].description.length).toBeGreaterThan(0);
    }
  });
});
