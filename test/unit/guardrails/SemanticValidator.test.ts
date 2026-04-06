import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — required for vi.mock() factory references
// ---------------------------------------------------------------------------

const { mockLlmGenerate } = vi.hoisted(() => ({ mockLlmGenerate: vi.fn() }));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class MockLLMClient {
    generate = mockLlmGenerate;
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { SemanticValidator } from '../../../src/guardrails/SemanticValidator.js';

// ===========================================================================
// SemanticValidator
// ===========================================================================

describe('SemanticValidator', () => {
  let validator: SemanticValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new SemanticValidator();
  });

  // ─── constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses default threshold of 0.7 when no options provided', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({
          aligned: true,
          score: 0.69,
          issues: [],
          explanation: 'Close but not quite',
        }),
      });

      const result = await validator.validate('blue circle', 'ellipse(50,50,20,20)', 'p5');
      expect(result.aligned).toBe(false);
    });

    it('accepts custom threshold via options', async () => {
      const lenient = new SemanticValidator({ threshold: 0.5 });
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({
          aligned: true,
          score: 0.6,
          issues: [],
          explanation: 'Close enough',
        }),
      });

      const result = await lenient.validate('blue circle', 'ellipse(50,50,20,20)', 'p5');
      expect(result.aligned).toBe(true);
    });
  });

  // ─── validate (LLM path) ─────────────────────────────────────────────

  describe('validate()', () => {
    it('returns aligned=true when LLM confirms alignment above threshold', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({
          aligned: true,
          score: 0.95,
          issues: [],
          explanation: 'Code creates exactly what was requested',
        }),
      });

      const result = await validator.validate(
        'red bouncing ball',
        'function draw() { fill(255,0,0); ellipse(x, y, 30); x += vx; }',
        'p5',
      );

      expect(result.aligned).toBe(true);
      expect(result.score).toBe(0.95);
      expect(result.issues).toEqual([]);
      expect(result.explanation).toBe('Code creates exactly what was requested');
    });

    it('returns aligned=false when LLM returns aligned:false', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({
          aligned: false,
          score: 0.3,
          issues: ['Prompt asks for circles but code draws lines'],
          explanation: 'Mismatch: shapes differ',
        }),
      });

      const result = await validator.validate('draw circles', 'line(0,0,100,100)', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0.3);
      expect(result.issues).toEqual(['Prompt asks for circles but code draws lines']);
    });

    it('returns aligned=false when score is below threshold even if LLM says aligned', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({
          aligned: true,
          score: 0.5,
          issues: ['Partial match'],
          explanation: 'Some elements missing',
        }),
      });

      const result = await validator.validate('complex scene', 'simple code', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0.5);
    });

    it('parses JSON wrapped in markdown code fences', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: '```json\n{"aligned": true, "score": 0.9, "issues": [], "explanation": "Match"}\n```',
      });

      const result = await validator.validate('test prompt', 'test code', 'shader');

      expect(result.aligned).toBe(true);
      expect(result.score).toBe(0.9);
    });

    it('parses JSON wrapped in plain code fences', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: '```\n{"aligned": false, "score": 0.2, "issues": ["bad"], "explanation": "No match"}\n```',
      });

      const result = await validator.validate('test prompt', 'test code', 'shader');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0.2);
      expect(result.issues).toEqual(['bad']);
    });

    it('clamps score to 0-1 range', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, score: 1.5, issues: [], explanation: 'Over' }),
      });

      const result = await validator.validate('test', 'code', 'p5');
      expect(result.score).toBe(1);
    });

    it('clamps negative score to 0', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: false, score: -0.5, issues: [], explanation: 'Under' }),
      });

      const result = await validator.validate('test', 'code', 'p5');
      expect(result.score).toBe(0);
    });

    it('handles missing score field defaulting to 0', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, issues: [], explanation: 'No score' }),
      });

      const result = await validator.validate('test', 'code', 'p5');
      expect(result.score).toBe(0);
      expect(result.aligned).toBe(false);
    });

    it('handles missing issues field defaulting to empty array', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, score: 0.8, explanation: 'No issues field' }),
      });

      const result = await validator.validate('test', 'code', 'p5');
      expect(result.issues).toEqual([]);
    });

    it('handles missing explanation field', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, score: 0.9, issues: [] }),
      });

      const result = await validator.validate('test', 'code', 'p5');
      expect(result.explanation).toBe('No explanation provided');
    });

    it('returns error result when LLM returns empty response', async () => {
      mockLlmGenerate.mockResolvedValue({ code: '' });

      const result = await validator.validate('test', 'code', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toEqual(['LLM returned empty response']);
      expect(result.explanation).toBe('Validation failed due to empty LLM response');
    });

    it('returns error result when LLM returns null code', async () => {
      mockLlmGenerate.mockResolvedValue({ code: null });

      const result = await validator.validate('test', 'code', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.issues).toEqual(['LLM returned empty response']);
    });

    it('returns error result when LLM throws', async () => {
      mockLlmGenerate.mockRejectedValue(new Error('API timeout'));

      const result = await validator.validate('test', 'code', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Semantic validation');
      expect(result.explanation).toBe('Validation failed due to error');
    });

    it('returns error result when JSON parse fails', async () => {
      mockLlmGenerate.mockResolvedValue({ code: 'not valid json at all {{{' });

      const result = await validator.validate('test', 'code', 'p5');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toHaveLength(1);
      expect(result.explanation).toBe('Validation failed due to error');
    });

    it('passes correct system prompt with domain', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'ok' }),
      });

      await validator.validate('test', 'code', 'glsl');

      const systemCall = mockLlmGenerate.mock.calls[0][0];
      expect(systemCall).toContain('glsl');
      expect(systemCall).toContain('SUBJECT MATCH');
    });

    it('passes user prompt and truncated code to LLM', async () => {
      mockLlmGenerate.mockResolvedValue({
        code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'ok' }),
      });

      const longCode = 'x'.repeat(3000);
      await validator.validate('my special prompt', longCode, 'p5');

      const userCall = mockLlmGenerate.mock.calls[0][1];
      expect(userCall).toContain('my special prompt');
      // Code should be truncated to 2000 chars
      expect(userCall).toContain('x'.repeat(2000));
      expect(userCall).not.toContain('x'.repeat(2001));
    });
  });

  // ─── quickCheck (static, no LLM) ────────────────────────────────────

  describe('quickCheck()', () => {
    it('returns empty issues for generic prompt with matching code', () => {
      const result = validator.quickCheck(
        'draw a shape',
        'function draw() { rect(10, 10, 50, 50); }',
      );
      expect(result.issues).toEqual([]);
    });

    it('detects color mismatch: prompt asks for blue but code uses red', () => {
      const result = validator.quickCheck(
        'blue background',
        'background("red"); fill("green");',
      );
      // Prompt says blue, code has color names "red" and "green" but not "blue"
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"blue"')]),
      );
    });

    it('detects color mismatch: prompt asks for red but code uses green', () => {
      const result = validator.quickCheck(
        'red circle',
        'fill("green"); ellipse(50,50,20);',
      );
      // Prompt says red, code has color name "green" but not "red"
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"red"')]),
      );
    });

    it('does not flag color when code uses the correct color', () => {
      const result = validator.quickCheck(
        'blue background',
        'background(0, 0, 255);',
      );
      const colorIssues = result.issues.filter(i => i.includes('blue'));
      expect(colorIssues).toEqual([]);
    });

    it('does not flag color when no colors are in the code at all', () => {
      const result = validator.quickCheck(
        'blue background',
        'rect(10, 10, 50, 50);',
      );
      expect(result.issues).toEqual([]);
    });

    it('detects missing animation when prompt requests it', () => {
      const result = validator.quickCheck(
        'animate a bouncing ball',
        'function setup() { createCanvas(400,400); }',
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('animation')]),
      );
    });

    it('does not flag animation when code has draw loop', () => {
      const result = validator.quickCheck(
        'animate a bouncing ball',
        'function draw() { ellipse(x, y, 20); x += 1; }',
      );
      const animIssues = result.issues.filter(i => i.includes('animation'));
      expect(animIssues).toEqual([]);
    });

    it('detects missing interaction when prompt requests click', () => {
      const result = validator.quickCheck(
        'click to change color',
        'function draw() { background(200); }',
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('interactivity')]),
      );
    });

    it('does not flag interaction when code has onclick handler', () => {
      const result = validator.quickCheck(
        'click to change color',
        'canvas.onclick = () => { fill(random(255)); }; function draw() { ellipse(50,50,20); }',
      );
      const interactIssues = result.issues.filter(i => i.includes('interactivity'));
      expect(interactIssues).toEqual([]);
    });

    it('detects missing particle system when prompt requests it', () => {
      const result = validator.quickCheck(
        'particle system with gravity',
        'function draw() { ellipse(50, 50, 20); }',
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('particle')]),
      );
    });

    it('does not flag particles when code includes particle references', () => {
      const result = validator.quickCheck(
        'particle system with gravity',
        'class Particle { constructor() {} } let particles = [];',
      );
      const particleIssues = result.issues.filter(i => i.includes('particle'));
      expect(particleIssues).toEqual([]);
    });

    it('detects multiple issues simultaneously', () => {
      const result = validator.quickCheck(
        'blue animated particle system with mouse interaction',
        'function setup() { createCanvas(400, 400); fill("red"); }',
      );

      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('particle'),
          expect.stringContaining('animation'),
        ]),
      );
    });

    it('returns empty issues for empty prompt', () => {
      const result = validator.quickCheck('', 'some code');
      expect(result.issues).toEqual([]);
    });

    it('returns empty issues for empty code', () => {
      const result = validator.quickCheck('blue circle', '');
      expect(result.issues).toEqual([]);
    });
  });
});
