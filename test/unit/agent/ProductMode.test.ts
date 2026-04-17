/**
 * ProductMode tests — ModeAwareRouter biasing behavior
 */
import { describe, it, expect } from 'vitest';
import { ModeAwareRouter, PRODUCT_MODES } from '../../../src/agent/ProductMode.js';
import type { ModeConfig } from '../../../src/agent/ProductMode.js';
import { IntentRouter } from '../../../src/agent/IntentRouter.js';

describe('ModeAwareRouter', () => {
  const baseRouter = new IntentRouter();

  describe('no active mode', () => {
    it('passes through base classification unchanged', () => {
      const router = new ModeAwareRouter(baseRouter, () => undefined);
      const result = router.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('returns direct for conversational input', () => {
      const router = new ModeAwareRouter(baseRouter, () => undefined);
      const result = router.classify('hello how are you');
      expect(result.intent).toBe('direct');
    });
  });

  describe('ask mode', () => {
    const getMode = () => ({ mode: 'ask' as const });
    const router = new ModeAwareRouter(baseRouter, getMode);

    it('preserves creative keywords instead of forcing chat-only', () => {
      const result = router.classify('generate a beautiful p5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('preserves engineering keywords instead of forcing chat-only', () => {
      const result = router.classify('fix the build error');
      expect(result.intent).toBe('engineering');
    });

    it('preserves hybrid keywords instead of forcing chat-only', () => {
      const result = router.classify('improve the art quality');
      expect(result.intent).toBe('hybrid');
    });

    it('routes conversational input to engineering inspection', () => {
      const result = router.classify('hello how are you');
      expect(result.intent).toBe('engineering');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('make mode', () => {
    const getMode = () => ({ mode: 'make' as const });
    const router = new ModeAwareRouter(baseRouter, getMode);

    it('upgrades direct input to creative', () => {
      const result = router.classify('hello how are you');
      expect(result.intent).toBe('creative');
      expect(result.confidence).toBe('medium');
    });

    it('preserves creative classification', () => {
      const result = router.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('preserves engineering classification', () => {
      const result = router.classify('fix the build error');
      expect(result.intent).toBe('engineering');
    });
  });

  describe('remix mode', () => {
    const getMode = () => ({ mode: 'remix' as const });
    const router = new ModeAwareRouter(baseRouter, getMode);

    it('forces creative intent for any input', () => {
      const result = router.classify('fix the build error');
      expect(result.intent).toBe('creative');
    });

    it('adds remix topic hint when no topic detected', () => {
      const result = router.classify('something random');
      expect(result.intent).toBe('creative');
      expect(result.topic).toBe('remix');
    });

    it('preserves detected topic', () => {
      const result = router.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
      expect(result.topic).toBeDefined();
    });
  });

  describe('improve mode', () => {
    const getMode = () => ({ mode: 'improve' as const });
    const router = new ModeAwareRouter(baseRouter, getMode);

    it('forces hybrid intent for any input', () => {
      const result = router.classify('hello how are you');
      expect(result.intent).toBe('hybrid');
    });

    it('forces hybrid even for creative keywords', () => {
      const result = router.classify('generate a p5 sketch');
      expect(result.intent).toBe('hybrid');
    });
  });
});

describe('PRODUCT_MODES', () => {
  it('has all four modes', () => {
    expect(Object.keys(PRODUCT_MODES)).toEqual(['ask', 'make', 'remix', 'improve']);
  });

  it('each mode has label and description', () => {
    for (const [key, info] of Object.entries(PRODUCT_MODES)) {
      expect(info.label).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(typeof info.label).toBe('string');
      expect(typeof info.description).toBe('string');
    }
  });
});
