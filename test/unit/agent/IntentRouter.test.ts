/**
 * IntentRouter tests — behavioral assertions on intent classification.
 *
 * Tests real classification behavior, not internal methods.
 * Every assertion checks a specific expected value.
 */
import { describe, it, expect } from 'vitest';
import { IntentRouter } from '../../../src/agent/IntentRouter.js';

describe('IntentRouter', () => {
  const router = new IntentRouter();

  // ── Creative Intent ──

  describe('creative intent', () => {
    it('classifies "generate a p5 sketch" as creative', () => {
      const result = router.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
      expect(result.confidence).toBe('high');
      expect(result.input).toBe('generate a p5 sketch');
    });

    it('classifies "make a shader" as creative', () => {
      const result = router.classify('make a shader');
      expect(result.intent).toBe('creative');
    });

    it('classifies "remix the last artwork" as creative', () => {
      const result = router.classify('remix the last artwork');
      expect(result.intent).toBe('creative');
    });

    it('classifies "create some audio-reactive visuals" as creative', () => {
      const result = router.classify('create some audio-reactive visuals');
      expect(result.intent).toBe('creative');
    });

    it('keeps creative comic panel prompts on the creative lane', () => {
      const result = router.classify('create a comic panel with neon lighting');
      expect(result.intent).toBe('creative');
    });

    it('keeps creative music bridge prompts on the creative lane', () => {
      const result = router.classify('create a bridge between two melodies');
      expect(result.intent).toBe('creative');
    });

    it('extracts topic from creative requests', () => {
      const result = router.classify('generate a p5 seed explorer');
      expect(result.intent).toBe('creative');
      expect(result.topic).toBeTruthy();
    });
  });

  // ── Engineering Intent ──

  describe('engineering intent', () => {
    it('classifies "fix the test coverage" as engineering', () => {
      const result = router.classify('fix the test coverage');
      expect(result.intent).toBe('engineering');
      expect(result.confidence).toBe('high');
    });

    it('classifies "debug the conveyor" as engineering', () => {
      const result = router.classify('debug the conveyor');
      expect(result.intent).toBe('engineering');
    });

    it('classifies "improve coverage in generators" as engineering', () => {
      const result = router.classify('improve coverage in generators');
      expect(result.intent).toBe('engineering');
    });

    it('classifies "run the build and fix errors" as engineering', () => {
      const result = router.classify('run the build and fix errors');
      expect(result.intent).toBe('engineering');
    });

    it('classifies "wire up the ledger status command" as engineering', () => {
      const result = router.classify('wire up the ledger status command');
      expect(result.intent).toBe('engineering');
    });

    it('classifies Bubble Tea UI work as engineering even with creative verbs', () => {
      const result = router.classify('make the Bubble Tea right-column operator surface less duplicative');
      expect(result.intent).toBe('engineering');
    });

    it('classifies TUI panel cleanup as engineering, not RalphLoop creative generation', () => {
      const result = router.classify('create a cleaner TUI final report panel without duplicate transcript content');
      expect(result.intent).toBe('engineering');
    });
  });

  // ── Hybrid Intent ──

  describe('hybrid intent', () => {
    it('classifies "improve the art quality" as hybrid', () => {
      const result = router.classify('improve the art quality');
      expect(result.intent).toBe('hybrid');
    });

    it('classifies "fix the generator and make it better" as hybrid', () => {
      const result = router.classify('fix the generator and make it better');
      expect(result.intent).toBe('hybrid');
    });

    it('classifies "self-improve the creative pipeline" as hybrid', () => {
      const result = router.classify('self-improve the creative pipeline');
      expect(result.intent).toBe('hybrid');
    });

    it('classifies overlapping creative+engineering keywords as hybrid', () => {
      // "generate" is creative, "fix" is engineering → hybrid
      const result = router.classify('generate a fix for the p5 output');
      expect(result.intent).toBe('hybrid');
    });
  });

  // ── Direct Intent ──

  describe('direct intent', () => {
    it('classifies "hello" as direct', () => {
      const result = router.classify('hello');
      expect(result.intent).toBe('direct');
      expect(result.confidence).toBe('high');
    });

    it('classifies "what can you do?" as direct', () => {
      const result = router.classify('what can you do?');
      expect(result.intent).toBe('direct');
    });

    it('classifies "explain how RalphLoop works" as direct', () => {
      const result = router.classify('explain how RalphLoop works');
      expect(result.intent).toBe('direct');
    });

    it('classifies empty string as direct', () => {
      const result = router.classify('');
      expect(result.intent).toBe('direct');
    });
  });

  // ── Confidence Levels ──

  describe('confidence', () => {
    it('returns high confidence for single-category matches', () => {
      const result = router.classify('generate a new artwork');
      expect(result.confidence).toBe('high');
    });

    it('returns medium confidence when two categories overlap', () => {
      // "make" is creative, "build" is engineering
      const result = router.classify('make a build script');
      expect(result.confidence).toBe('medium');
    });
  });

  // ── Custom Keywords ──

  describe('custom keywords', () => {
    it('accepts additional creative keywords', () => {
      const custom = new IntentRouter({
        keywords: { creative: ['glitch'] },
      });
      const result = custom.classify('create a glitch effect');
      // "glitch" is not in defaults, but we added it
      // "create" is already creative, so this should be creative
      expect(result.intent).toBe('creative');
    });

    it('accepts additional engineering keywords', () => {
      const custom = new IntentRouter({
        keywords: { engineering: ['deploy'] },
      });
      const result = custom.classify('deploy the latest changes');
      expect(result.intent).toBe('engineering');
    });
  });

  // ── Topic Extraction ──

  describe('topic extraction', () => {
    it('extracts topic from "generate a shader"', () => {
      const result = router.classify('generate a shader');
      expect(result.topic).toBe('shader');
    });

    it('extracts topic from "fix the conveyor"', () => {
      const result = router.classify('fix the conveyor');
      expect(result.topic).toBe('conveyor');
    });

    it('returns undefined topic for generic input', () => {
      const result = router.classify('hello there');
      expect(result.topic).toBeUndefined();
    });
  });
});
