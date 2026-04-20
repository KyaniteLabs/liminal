import { describe, it, expect, beforeEach } from 'vitest';
import { IntentRouter } from '../../../src/agent/IntentRouter.js';

describe('IntentRouter', () => {
  let router: IntentRouter;

  beforeEach(() => {
    router = new IntentRouter();
  });

  describe('classify', () => {
    it('classifies creative keywords as creative intent', () => {
      const result = router.classify('generate a p5 sketch of flowing particles');
      expect(result.intent).toBe('creative');
      expect(result.confidence).toBe('high');
      expect(result.input).toBe('generate a p5 sketch of flowing particles');
    });

    it('classifies engineering keywords as engineering intent', () => {
      const result = router.classify('fix the failing test in BatchProcessor');
      expect(result.intent).toBe('engineering');
      expect(result.confidence).toBe('high');
    });

    it('classifies hybrid keywords as hybrid intent', () => {
      const result = router.classify('improve the art quality and fix the generator');
      expect(result.intent).toBe('hybrid');
      expect(result.confidence).toBe('low');
    });

    it('defaults to direct when no keywords match', () => {
      const result = router.classify('hello, how are you today?');
      expect(result.intent).toBe('direct');
      expect(result.confidence).toBe('high');
      expect(result.topic).toBeUndefined();
    });

    it('detects internal engineering surfaces for creative+TUI inputs', () => {
      const result = router.classify('draw something in the bubble tea tui panel');
      expect(result.intent).toBe('engineering');
    });

    it('returns creative+engineering as hybrid when no internal surface', () => {
      const result = router.classify('generate a test for the shader');
      expect(result.intent).toBe('hybrid');
    });

    it('extracts topic from generate patterns', () => {
      const result = router.classify('generate a waveform visual');
      expect(result.topic).toBe('waveform');
    });

    it('extracts topic from fix patterns', () => {
      const result = router.classify('fix the shader compilation error');
      expect(result.topic).toBe('shader');
    });

    it('preserves original input in result', () => {
      const input = 'Create some beautiful music';
      const result = router.classify(input);
      expect(result.input).toBe(input);
    });
  });

  describe('with custom keywords', () => {
    it('merges custom keywords with defaults', () => {
      const customRouter = new IntentRouter({
        keywords: { creative: ['bespoke', 'custom-art'] },
      });
      const result = customRouter.classify('make a bespoke piece');
      expect(result.intent).toBe('creative');
    });

    it('still classifies default keywords with custom config', () => {
      const customRouter = new IntentRouter({
        keywords: { creative: ['bespoke'] },
      });
      const result = customRouter.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = router.classify('');
      expect(result.intent).toBe('direct');
    });

    it('handles single keyword with no context', () => {
      const result = router.classify('generate');
      expect(result.intent).toBe('creative');
    });

    it('is case-insensitive', () => {
      const result = router.classify('GENERATE a P5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('matches partial words in longer text', () => {
      const result = router.classify('I want to create something amazing with audio');
      expect(result.intent).toBe('creative');
    });
  });
});
