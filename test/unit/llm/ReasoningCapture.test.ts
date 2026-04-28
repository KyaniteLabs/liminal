/**
 * Tests for ReasoningCapture — structured extraction and storage of LLM reasoning.
 *
 * Covers extractReasoning, detectPatterns, calculateQuality, capture,
 * getSessionTraces, getSessionStats, and getTracesWithPattern.
 * Mocks fs operations at the boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockWriteFileSync,
  mockExistsSync,
  mockMkdirSync,
  mockReadFileSync,
  mockReaddirSync,
} = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn().mockReturnValue(true),
  mockMkdirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockReaddirSync: vi.fn().mockReturnValue([]),
}));

vi.mock('fs', () => ({
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { ReasoningCapture } from '../../../src/llm/ReasoningCapture.js';
import type { ReasoningTrace } from '../../../src/llm/ReasoningCapture.js';

describe('ReasoningCapture', () => {
  let capture: ReasoningCapture;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    mockWriteFileSync.mockReturnValue(undefined);
    capture = new ReasoningCapture('test-session-123');
  });

  describe('extractReasoning', () => {
    it('extracts <thinking> tags', () => {
      const input = '<thinking>Let me analyze this</thinking>\nconst x = 1;';
      const { reasoning, code } = capture.extractReasoning(input);

      // Multiple regex patterns may match the same tag (thinking + think variant)
      expect(reasoning).toContain('Let me analyze this');
      expect(code).toBe('const x = 1;');
    });

    it('extracts <reasoning> tags', () => {
      const input = '<reasoning>Step by step</reasoning>\nfunction foo() {}';
      const { reasoning, code } = capture.extractReasoning(input);

      expect(reasoning).toBe('Step by step');
      expect(code).toBe('function foo() {}');
    });

    it('extracts <analysis> tags', () => {
      const input = '<analysis>Deep dive</analysis>print("hi")';
      const { reasoning, code } = capture.extractReasoning(input);

      expect(reasoning).toBe('Deep dive');
      expect(code).toBe('print("hi")');
    });

    it('extracts multiple reasoning blocks', () => {
      const input = '<thinking>Part 1</thinking>code here<thinking>Part 2</thinking>';
      const { reasoning } = capture.extractReasoning(input);

      expect(reasoning).toContain('Part 1');
      expect(reasoning).toContain('Part 2');
    });

    it('returns empty reasoning when no tags present', () => {
      const input = 'Just plain code with no tags';
      const { reasoning, code } = capture.extractReasoning(input);

      expect(reasoning).toBe('');
      expect(code).toBe('Just plain code with no tags');
    });

    it('handles empty string input', () => {
      const { reasoning, code } = capture.extractReasoning('');

      expect(reasoning).toBe('');
      expect(code).toBe('');
    });
  });

  describe('detectPatterns', () => {
    it('detects infinite reconsideration pattern', () => {
      const reasoning = 'Actually, let me reconsider. Actually, maybe not.';
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.some(p => p.type === 'infinite_reconsideration')).toBe(true);
    });

    it('detects confusion pattern', () => {
      const reasoning = "I'm not sure about this approach. It's unclear.";
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns.some(p => p.type === 'confusion')).toBe(true);
    });

    it('detects over-engineering pattern', () => {
      const reasoning = 'We should use a factory pattern with dependency injection for scalability.';
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns.some(p => p.type === 'over_engineering')).toBe(true);
    });

    it('detects premature optimization pattern', () => {
      const reasoning = 'We need to optimize performance with cache and lazy loading.';
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns.some(p => p.type === 'premature_optimization')).toBe(true);
    });

    it('detects circular reasoning pattern', () => {
      const reasoning = 'As I said, returning to the main point. As mentioned before...';
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns.some(p => p.type === 'circular_reasoning')).toBe(true);
    });

    it('returns empty array for clean reasoning', () => {
      const reasoning = 'The function creates a circle at the mouse position.';
      const patterns = capture.detectPatterns(reasoning);

      expect(patterns).toEqual([]);
    });

    it('includes confidence and position in detected patterns', () => {
      const reasoning = "I'm confused about the unclear requirements.";
      const patterns = capture.detectPatterns(reasoning);

      for (const p of patterns) {
        expect(p.confidence).toBeGreaterThan(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
        expect(typeof p.position).toBe('number');
        expect(typeof p.evidence).toBe('string');
      }
    });
  });

  describe('calculateQuality', () => {
    it('returns high score when code is present and reasoning is focused', () => {
      const quality = capture.calculateQuality(
        'Create a circle function',
        'function circle(x, y, r) { return Math.PI * r * r; }'.repeat(3) // >50 chars
      );

      expect(quality.score).toBeGreaterThan(0.5);
      expect(quality.actionability).toBe(1);
      expect(quality.efficiency).toBeGreaterThan(0);
    });

    it('returns low actionability when no code', () => {
      const quality = capture.calculateQuality('Just thinking...', 'short');

      expect(quality.actionability).toBe(0);
      expect(quality.score).toBeLessThan(0.5);
    });

    it('reduces focus for off-topic reasoning', () => {
      const quality = capture.calculateQuality(
        'By the way, incidentally, speaking of unrelated things...',
        'function foo() { return 1; }'.repeat(5)
      );

      expect(quality.focus).toBeLessThan(1);
    });

    it('returns perfect focus when no off-topic indicators', () => {
      const quality = capture.calculateQuality(
        'Creating a function to draw circles',
        'function drawCircle() { ellipse(0, 0, 50, 50); }'.repeat(3)
      );

      expect(quality.focus).toBe(1);
    });
  });

  describe('capture', () => {
    it('creates and saves a reasoning trace', () => {
      const trace = capture.capture({
        model: 'test-model',
        prompt: 'draw a circle',
        rawOutput: '<thinking>analyze</thinking>function setup() {}',
        outcome: 'success',
        duration: 1500,
        iteration: 1,
      });

      expect(trace.model).toBe('test-model');
      expect(trace.prompt).toBe('draw a circle');
      expect(trace.outcome).toBe('success');
      expect(trace.rawReasoning).toContain('analyze');
      expect(trace.code).toBe('function setup() {}');
      expect(trace.patterns).toBeDefined();
      expect(trace.quality).toBeDefined();
      expect(trace.sessionId).toBe('test-session-123');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('captures failure outcome with error', () => {
      const trace = capture.capture({
        model: 'test-model',
        prompt: 'draw a circle',
        rawOutput: '<thinking>confused</thinking>',
        outcome: 'failure',
        error: 'syntax error',
        duration: 2000,
        iteration: 2,
      });

      expect(trace.outcome).toBe('failure');
      expect(trace.error).toBe('syntax error');
    });

    it('captures timeout outcome', () => {
      const trace = capture.capture({
        model: 'test-model',
        prompt: 'complex task',
        rawOutput: 'thinking...',
        outcome: 'timeout',
        duration: 30000,
        iteration: 3,
      });

      expect(trace.outcome).toBe('timeout');
      expect(trace.duration).toBe(30000);
    });
  });

  describe('getSessionTraces', () => {
    it('returns empty array when directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const traces = capture.getSessionTraces();
      expect(traces).toEqual([]);
    });

    it('returns traces matching session ID', () => {
      mockExistsSync.mockReturnValue(true);
      const mockTrace: ReasoningTrace = {
        id: 'trace-1',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        model: 'test',
        prompt: 'test',
        rawReasoning: 'thinking',
        cleanedReasoning: 'thinking',
        code: 'code',
        outcome: 'success',
        duration: 100,
        iteration: 1,
      };
      mockReaddirSync.mockReturnValue(['trace-1.json'] as any);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockTrace));

      const traces = capture.getSessionTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].sessionId).toBe('test-session-123');
    });

    it('filters out traces from other sessions', () => {
      mockExistsSync.mockReturnValue(true);
      const otherTrace: ReasoningTrace = {
        id: 'trace-2',
        timestamp: new Date().toISOString(),
        sessionId: 'other-session',
        model: 'test',
        prompt: 'test',
        rawReasoning: '',
        cleanedReasoning: '',
        code: '',
        outcome: 'success',
        duration: 100,
        iteration: 1,
      };
      mockReaddirSync.mockReturnValue(['trace-2.json'] as any);
      mockReadFileSync.mockReturnValue(JSON.stringify(otherTrace));

      const traces = capture.getSessionTraces();
      expect(traces).toHaveLength(0);
    });

    it('handles corrupted JSON files gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['bad.json'] as any);
      mockReadFileSync.mockReturnValue('not-json');

      const traces = capture.getSessionTraces();
      expect(traces).toEqual([]);
    });
  });

  describe('getSessionStats', () => {
    it('returns zero stats for empty session', () => {
      mockExistsSync.mockReturnValue(false);

      const stats = capture.getSessionStats();
      expect(stats.totalTraces).toBe(0);
      expect(stats.avgQuality).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('computes stats from multiple traces', () => {
      mockExistsSync.mockReturnValue(true);
      const traces: ReasoningTrace[] = [
        {
          id: 't1', timestamp: new Date().toISOString(), sessionId: 'test-session-123',
          model: 'm', prompt: 'p', rawReasoning: '', cleanedReasoning: '', code: '',
          outcome: 'success', duration: 1000, iteration: 1,
          patterns: [], quality: { score: 0.8, efficiency: 0.7, focus: 0.9, actionability: 1 },
        },
        {
          id: 't2', timestamp: new Date().toISOString(), sessionId: 'test-session-123',
          model: 'm', prompt: 'p', rawReasoning: '', cleanedReasoning: '', code: '',
          outcome: 'failure', duration: 2000, iteration: 2,
          patterns: [], quality: { score: 0.4, efficiency: 0.3, focus: 0.5, actionability: 0 },
        },
      ];
      mockReaddirSync.mockReturnValue(['t1.json', 't2.json'] as any);
      mockReadFileSync.mockImplementationOnce(() => JSON.stringify(traces[0]))
        .mockImplementationOnce(() => JSON.stringify(traces[1]));

      const stats = capture.getSessionStats();
      expect(stats.totalTraces).toBe(2);
      expect(stats.successRate).toBe(0.5);
      expect(stats.avgDuration).toBe(1500);
      expect(stats.avgQuality).toBeCloseTo(0.6, 5);
    });
  });

  describe('getTracesWithPattern', () => {
    it('filters traces by pattern type', () => {
      mockExistsSync.mockReturnValue(true);
      const trace: ReasoningTrace = {
        id: 't1', timestamp: new Date().toISOString(), sessionId: 'test-session-123',
        model: 'm', prompt: 'p', rawReasoning: '', cleanedReasoning: '', code: '',
        outcome: 'success', duration: 100, iteration: 1,
        patterns: [{ type: 'confusion', confidence: 0.7, evidence: "I'm confused", position: 0 }],
      };
      mockReaddirSync.mockReturnValue(['t1.json'] as any);
      mockReadFileSync.mockReturnValue(JSON.stringify(trace));

      const results = capture.getTracesWithPattern('confusion');
      expect(results).toHaveLength(1);
    });

    it('returns empty when no traces match pattern', () => {
      mockExistsSync.mockReturnValue(true);
      const trace: ReasoningTrace = {
        id: 't1', timestamp: new Date().toISOString(), sessionId: 'test-session-123',
        model: 'm', prompt: 'p', rawReasoning: '', cleanedReasoning: '', code: '',
        outcome: 'success', duration: 100, iteration: 1,
        patterns: [],
      };
      mockReaddirSync.mockReturnValue(['t1.json'] as any);
      mockReadFileSync.mockReturnValue(JSON.stringify(trace));

      const results = capture.getTracesWithPattern('hallucination');
      expect(results).toHaveLength(0);
    });
  });

  describe('getSessionId', () => {
    it('returns the session ID', () => {
      expect(capture.getSessionId()).toBe('test-session-123');
    });
  });
});
