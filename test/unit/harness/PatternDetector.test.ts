import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() is mandatory for mock variables referenced in vi.mock() factories
const { mockGetRecentFailures } = vi.hoisted(() => ({
  mockGetRecentFailures: vi.fn(),
}));

vi.mock('../../../src/harness/FailureLogger.js', () => ({
  failureLogger: {
    getRecentFailures: mockGetRecentFailures,
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PatternDetector, KNOWN_PATTERNS } from '../../../src/harness/PatternDetector.js';
import { Domain } from '../../../src/types/domains.js';
import type { FailureRecord } from '../../../src/harness/FailureLogger.js';

/** Helper to build a FailureRecord with sensible defaults */
function makeFailure(overrides: Partial<FailureRecord> & { model: string; domain: string; error: string; errorType: FailureRecord['errorType'] }): FailureRecord {
  return {
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    prompt: 'test prompt',
    duration: 1000,
    ...overrides,
  };
}

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes all 6 known patterns with zero occurrences', () => {
      const allPatterns = detector.getAllPatterns();

      expect(allPatterns).toHaveLength(6);
      for (const p of allPatterns) {
        expect(p.occurrences).toBe(0);
        expect(p.affectedModels).toEqual([]);
        expect(p.affectedDomains).toEqual([]);
      }
    });

    it('maps known pattern ids correctly', () => {
      const ids = detector.getAllPatterns().map(p => p.id).sort();
      expect(ids).toEqual([
        'ascii-timeout',
        'glsl-undefined-function',
        'html-404-error',
        'qwen-thinking-trap',
        'strudel-tidal-confusion',
        'tone-hallucinated-api',
      ]);
    });
  });

  describe('analyze', () => {
    it('detects qwen-thinking-trap pattern', () => {
      const failure = makeFailure({
        model: 'qwen-2.5-coder',
        domain: Domain.CODE,
        error: 'timed out',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500), // > 1000 chars
        code: '', // empty code
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('qwen-thinking-trap');
      expect(detected[0].occurrences).toBe(1);
      expect(detected[0].affectedModels).toContain('qwen-2.5-coder');
      expect(detected[0].affectedDomains).toContain(Domain.CODE);
    });

    it('does NOT trigger qwen-thinking-trap when code is present', () => {
      const failure = makeFailure({
        model: 'qwen-2.5-coder',
        domain: Domain.CODE,
        error: 'timed out',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500),
        code: 'console.log("hello")', // code present — should NOT match
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(0);
    });

    it('detects glsl-undefined-function pattern', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.GLSL,
        error: 'validation failed',
        errorType: 'validation',
        validationErrors: ['noise is not defined', 'unexpected token'],
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('glsl-undefined-function');
      expect(detected[0].occurrences).toBe(1);
    });

    it('does NOT detect glsl pattern without "not defined" in errors', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.GLSL,
        error: 'validation failed',
        errorType: 'validation',
        validationErrors: ['unexpected token'], // no "not defined"
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(0);
    });

    it('detects tone-hallucinated-api pattern', () => {
      const failure = makeFailure({
        model: 'claude-3',
        domain: Domain.TONE,
        error: 'validation failed',
        errorType: 'validation',
        validationErrors: ['Reverberator is not a valid class'],
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('tone-hallucinated-api');
    });

    it('detects tone-hallucinated-api via "does not exist" error', () => {
      const failure = makeFailure({
        model: 'claude-3',
        domain: Domain.TONE,
        error: 'validation failed',
        errorType: 'validation',
        validationErrors: ['Tone.SuperReverb does not exist'],
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('tone-hallucinated-api');
    });

    it('detects strudel-tidal-confusion pattern', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.STRUDEL,
        error: 'runtime error',
        errorType: 'runtime',
        code: 'd1 $ sound "bd sd"', // TidalCycles syntax, no $:
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('strudel-tidal-confusion');
    });

    it('does NOT trigger strudel-tidal-confusion when $: is present (valid Strudel)', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.STRUDEL,
        error: 'runtime error',
        errorType: 'runtime',
        code: 'd1 $: sound("bd sd")', // valid Strudel syntax
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(0);
    });

    it('detects ascii-timeout pattern', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.ASCII,
        error: 'request timeout',
        errorType: 'timeout',
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('ascii-timeout');
    });

    it('detects ascii-timeout via error message containing "timeout"', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.ASCII,
        error: 'the operation timeout after 30s',
        errorType: 'generation', // not timeout type, but message contains "timeout"
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('ascii-timeout');
    });

    it('detects html-404-error pattern', () => {
      const failure = makeFailure({
        model: 'llama-3',
        domain: 'html',
        error: 'Request failed with status 404',
        errorType: 'runtime',
      });

      const detected = detector.analyze(failure);

      expect(detected).toHaveLength(1);
      expect(detected[0].id).toBe('html-404-error');
    });

    it('returns empty array when no patterns match', () => {
      const failure = makeFailure({
        model: 'gpt-4',
        domain: Domain.P5,
        error: 'some generic error',
        errorType: 'generation',
      });

      const detected = detector.analyze(failure);
      expect(detected).toHaveLength(0);
    });

    it('tracks multiple occurrences of same pattern', () => {
      const failure = makeFailure({
        model: 'qwen-2.5-coder',
        domain: Domain.CODE,
        error: 'timed out',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500),
        code: '',
      });

      detector.analyze(failure);
      detector.analyze({ ...failure, model: 'qwen-3' });
      const detected = detector.analyze({ ...failure, model: 'qwen-coder-plus' });

      expect(detected[0].occurrences).toBe(3);
      expect(detected[0].affectedModels).toEqual(['qwen-2.5-coder', 'qwen-3', 'qwen-coder-plus']);
    });

    it('does not duplicate models in affectedModels', () => {
      const failure = makeFailure({
        model: 'qwen-2.5',
        domain: Domain.CODE,
        error: 'timed out',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500),
        code: '',
      });

      detector.analyze(failure);
      detector.analyze(failure); // same model again

      const pattern = detector.getPattern('qwen-thinking-trap');
      expect(pattern!.affectedModels).toEqual(['qwen-2.5']);
    });
  });

  describe('analyzeRecentFailures', () => {
    it('analyzes recent failures from failureLogger', () => {
      const failures: FailureRecord[] = [
        makeFailure({
          model: 'qwen-2.5',
          domain: Domain.CODE,
          error: 'timeout',
          errorType: 'timeout',
          thinking: 'x'.repeat(1500),
          code: '',
        }),
        makeFailure({
          model: 'gpt-4',
          domain: Domain.GLSL,
          error: 'validation error',
          errorType: 'validation',
          validationErrors: ['noise is not defined'],
        }),
      ];

      mockGetRecentFailures.mockReturnValue(failures);

      const patterns = detector.analyzeRecentFailures(50);

      expect(mockGetRecentFailures).toHaveBeenCalledWith(50);

      const qwenPattern = patterns.get('qwen-thinking-trap');
      expect(qwenPattern!.occurrences).toBe(1);

      const glslPattern = patterns.get('glsl-undefined-function');
      expect(glslPattern!.occurrences).toBe(1);
    });

    it('uses default count of 100', () => {
      mockGetRecentFailures.mockReturnValue([]);

      detector.analyzeRecentFailures();

      expect(mockGetRecentFailures).toHaveBeenCalledWith(100);
    });

    it('handles empty failure list', () => {
      mockGetRecentFailures.mockReturnValue([]);

      const patterns = detector.analyzeRecentFailures(10);

      // All patterns should have zero occurrences
      for (const [, pattern] of patterns) {
        expect(pattern.occurrences).toBe(0);
      }
    });
  });

  describe('getPattern', () => {
    it('returns pattern by id', () => {
      const pattern = detector.getPattern('qwen-thinking-trap');

      expect(pattern!.name).toBe('Qwen Thinking Mode Trap');
    });

    it('returns undefined for unknown pattern id', () => {
      const pattern = detector.getPattern('nonexistent-pattern');
      expect(pattern).toBeUndefined();
    });
  });

  describe('getHighImpactPatterns', () => {
    it('returns empty array when no patterns meet threshold', () => {
      const high = detector.getHighImpactPatterns(3);
      expect(high).toEqual([]);
    });

    it('filters by threshold and sorts by occurrences descending', () => {
      // Manually inflate occurrences via repeated analyze calls
      const qwenFailure = makeFailure({
        model: 'qwen-2.5',
        domain: Domain.CODE,
        error: 'timeout',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500),
        code: '',
      });

      const glslFailure = makeFailure({
        model: 'gpt-4',
        domain: Domain.GLSL,
        error: 'validation',
        errorType: 'validation',
        validationErrors: ['noise is not defined'],
      });

      const asciiFailure = makeFailure({
        model: 'gpt-4',
        domain: Domain.ASCII,
        error: 'timeout',
        errorType: 'timeout',
      });

      // qwen: 5 occurrences, glsl: 3 occurrences, ascii: 2 occurrences
      for (let i = 0; i < 5; i++) detector.analyze(qwenFailure);
      for (let i = 0; i < 3; i++) detector.analyze(glslFailure);
      for (let i = 0; i < 2; i++) detector.analyze(asciiFailure);

      const high = detector.getHighImpactPatterns(3);

      // Only qwen (5) and glsl (3) meet threshold >= 3
      expect(high).toHaveLength(2);
      expect(high[0].id).toBe('qwen-thinking-trap'); // 5 occurrences
      expect(high[0].occurrences).toBe(5);
      expect(high[1].id).toBe('glsl-undefined-function'); // 3 occurrences
      expect(high[1].occurrences).toBe(3);
    });

    it('uses default threshold of 3', () => {
      const failure = makeFailure({
        model: 'qwen-2.5',
        domain: Domain.CODE,
        error: 'timeout',
        errorType: 'timeout',
        thinking: 'x'.repeat(1500),
        code: '',
      });

      // Only 2 occurrences — below default threshold of 3
      detector.analyze(failure);
      detector.analyze(failure);

      const high = detector.getHighImpactPatterns();
      expect(high).toEqual([]);
    });
  });
});
