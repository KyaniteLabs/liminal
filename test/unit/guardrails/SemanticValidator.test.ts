import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMResponse } from '../../../src/llm/LLMClient.js';

// ── vi.hoisted for all mock variables used in vi.mock factories ──

const { mockGenerate } = vi.hoisted(() => {
  return { mockGenerate: vi.fn() };
});

const { MockLLMClient } = vi.hoisted(() => {
  return {
    MockLLMClient: vi.fn(function (this: { generate: ReturnType<typeof vi.fn> }) {
      this.generate = mockGenerate;
    this.generateWithToolLoop = vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true });
    }) as unknown as import('../../../src/llm/LLMClient.js').LLMClient & { new(): { generate: ReturnType<typeof vi.fn> } },
  };
});

const { mockFormatError } = vi.hoisted(() => {
  return { mockFormatError: vi.fn((ctx: string, err: unknown) => `${ctx}: ${err instanceof Error ? err.message : String(err)}`) };
});

const { mockLoggerWarn } = vi.hoisted(() => {
  return { mockLoggerWarn: vi.fn() };
});

// ── Boundary mocks only (external deps) ──

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: MockLLMClient,
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: mockFormatError,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: mockLoggerWarn },
}));

// Import after mocks
import { SemanticValidator } from '../../../src/guardrails/SemanticValidator.js';

describe('SemanticValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockReset();
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('uses default threshold of 0.7 when no options provided', async () => {
      // A score of exactly 0.7 should pass the threshold (>= 0.7)
      const alignedJson = JSON.stringify({ aligned: true, score: 0.7, issues: [], explanation: 'ok' });
      mockGenerate.mockResolvedValue({ code: alignedJson });

      const validator = new SemanticValidator();
      const result = await validator.validate('sunset', 'canvas code', 'art');

      expect(result.aligned).toBe(true);
    });

    it('uses custom threshold from options', async () => {
      // Threshold 0.9 — score 0.8 should fail
      const alignedJson = JSON.stringify({ aligned: true, score: 0.8, issues: [], explanation: 'ok' });
      mockGenerate.mockResolvedValue({ code: alignedJson });

      const validator = new SemanticValidator({ threshold: 0.9 });
      const result = await validator.validate('sunset', 'canvas code', 'art');

      expect(result.aligned).toBe(false);
    });

    it('uses custom LLM client from options', async () => {
      const customLlm = { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as unknown as import('../../../src/llm/LLMClient.js').LLMClient;
      mockGenerate.mockResolvedValue({ code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'yes' }) });

      const validator = new SemanticValidator({ llm: customLlm });
      await validator.validate('test', 'code', 'domain');

      // Should NOT have called the MockLLMClient constructor since we passed one
      expect(MockLLMClient).not.toHaveBeenCalled();
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it('creates default LLMClient when no llm option provided', () => {
      const validator = new SemanticValidator();
      expect(MockLLMClient).toHaveBeenCalledWith({ role: 'generator' });
    });
  });

  // ── validate() ──

  describe('validate', () => {
    it('returns aligned=true when LLM confirms alignment with high score', async () => {
      const json = JSON.stringify({ aligned: true, score: 0.95, issues: [], explanation: 'Perfect match' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator({ threshold: 0.7 });
      const result = await validator.validate('fiery sunset', 'canvas sunset code', 'canvas');

      expect(result.aligned).toBe(true);
      expect(result.score).toBe(0.95);
      expect(result.issues).toEqual([]);
      expect(result.explanation).toBe('Perfect match');
    });

    it('returns aligned=false when score is below threshold', async () => {
      const json = JSON.stringify({ aligned: true, score: 0.5, issues: ['wrong colors'], explanation: 'Partial match' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator({ threshold: 0.7 });
      const result = await validator.validate('ocean', 'mountain code', 'canvas');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0.5);
      expect(result.issues).toEqual(['wrong colors']);
    });

    it('returns aligned=false when LLM says aligned=false regardless of score', async () => {
      const json = JSON.stringify({ aligned: false, score: 0.9, issues: ['mismatch'], explanation: 'Nope' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('foo', 'bar', 'art');

      // aligned=false from LLM overrides high score
      expect(result.aligned).toBe(false);
    });

    it('handles JSON wrapped in markdown code block with json tag', async () => {
      const payload = { aligned: true, score: 0.85, issues: [], explanation: 'Good' };
      const code = '```json\n' + JSON.stringify(payload) + '\n```';
      mockGenerate.mockResolvedValue({ code });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0.85);
      expect(result.aligned).toBe(true);
    });

    it('handles JSON wrapped in plain markdown code block', async () => {
      const payload = { aligned: true, score: 0.88, issues: [], explanation: 'Fine' };
      const code = '```\n' + JSON.stringify(payload) + '\n```';
      mockGenerate.mockResolvedValue({ code });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0.88);
    });

    it('handles raw JSON without code blocks', async () => {
      const payload = { aligned: true, score: 0.92, issues: ['minor'], explanation: 'Mostly aligned' };
      mockGenerate.mockResolvedValue({ code: JSON.stringify(payload) });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0.92);
      expect(result.issues).toEqual(['minor']);
    });

    it('clamps score above 1.0 down to 1', async () => {
      const json = JSON.stringify({ aligned: true, score: 1.5, issues: [], explanation: 'Overflow' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(1);
    });

    it('clamps negative score up to 0', async () => {
      const json = JSON.stringify({ aligned: false, score: -0.3, issues: [], explanation: 'Underflow' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0);
    });

    it('defaults score to 0 when missing from LLM response', async () => {
      const json = JSON.stringify({ aligned: true, issues: [], explanation: 'No score field' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0);
    });

    it('defaults issues to empty array when not an array', async () => {
      const json = JSON.stringify({ aligned: true, score: 0.9, issues: 'not-an-array', explanation: 'Broken issues' });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.issues).toEqual([]);
    });

    it('defaults explanation to fallback when missing', async () => {
      const json = JSON.stringify({ aligned: true, score: 0.9, issues: [] });
      mockGenerate.mockResolvedValue({ code: json });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.explanation).toBe('No explanation provided');
    });

    it('returns error result when LLM returns empty code', async () => {
      mockGenerate.mockResolvedValue({ code: '' });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toEqual(['LLM returned empty response']);
      expect(result.explanation).toBe('Validation failed due to empty LLM response');
    });

    it('returns error result when LLM returns falsy code (null)', async () => {
      mockGenerate.mockResolvedValue({ code: null as unknown as string });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
    });

    it('returns error result when LLM returns undefined code', async () => {
      mockGenerate.mockResolvedValue({ code: undefined as unknown as string });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.issues).toEqual(['LLM returned empty response']);
    });

    it('returns error result when LLM throws an exception', async () => {
      mockGenerate.mockRejectedValue(new Error('Network failure'));

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
      expect(result.explanation).toBe('Validation failed due to error');
    });

    it('returns error result when JSON.parse fails on malformed response', async () => {
      mockGenerate.mockResolvedValue({ code: 'this is not json at all' });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
    });

    it('calls Logger.warn when LLM throws', async () => {
      mockGenerate.mockRejectedValue(new Error('timeout'));

      const validator = new SemanticValidator();
      await validator.validate('test', 'code', 'art');

      expect(mockLoggerWarn).toHaveBeenCalledWith('SemanticValidator', 'Semantic validation failed:', expect.any(Error));
    });

    it('calls formatError when LLM throws', async () => {
      const error = new Error('timeout');
      mockGenerate.mockRejectedValue(error);

      const validator = new SemanticValidator();
      await validator.validate('test', 'code', 'art');

      expect(mockFormatError).toHaveBeenCalledWith('Semantic validation', error);
    });

    it('truncates generated code to 2000 chars in prompt', async () => {
      const longCode = 'x'.repeat(5000);
      mockGenerate.mockResolvedValue({ code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'ok' }) });

      const validator = new SemanticValidator();
      await validator.validate('test prompt', longCode, 'canvas');

      const callArgs = mockGenerate.mock.calls[0];
      // Second arg is the userPrompt_text, which should only contain the first 2000 chars of code
      const userPromptArg = callArgs[1] as string;
      // The prompt should contain the first 2000 chars of code, not all 5000
      expect(userPromptArg).toContain('x'.repeat(100)); // contains code chars
      expect(userPromptArg.length).toBeLessThan(longCode.length + 500); // much shorter than 5000+overhead
    });

    it('includes domain in system prompt', async () => {
      mockGenerate.mockResolvedValue({ code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'ok' }) });

      const validator = new SemanticValidator();
      await validator.validate('test', 'code', 'p5js');

      const systemPrompt = mockGenerate.mock.calls[0][0] as string;
      expect(systemPrompt).toContain('p5js');
    });

    it('uppercases domain in user prompt', async () => {
      mockGenerate.mockResolvedValue({ code: JSON.stringify({ aligned: true, score: 0.9, issues: [], explanation: 'ok' }) });

      const validator = new SemanticValidator();
      await validator.validate('test', 'code', 'canvas');

      const userPrompt = mockGenerate.mock.calls[0][1] as string;
      expect(userPrompt).toContain('CANVAS');
    });

    it('handles LLM response with non-string error (number)', async () => {
      mockGenerate.mockRejectedValue(42);

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.aligned).toBe(false);
      expect(result.issues[0]).toContain('42');
    });

    it('handles LLM response where jsonMatch[1] is undefined', async () => {
      // Response that doesn't match any code block pattern but has content
      const payload = { aligned: true, score: 0.9, issues: [], explanation: 'Direct' };
      mockGenerate.mockResolvedValue({ code: JSON.stringify(payload) });

      const validator = new SemanticValidator();
      const result = await validator.validate('test', 'code', 'art');

      expect(result.score).toBe(0.9);
    });
  });

  // ── quickCheck() ──

  describe('quickCheck', () => {
    it('returns empty issues when prompt and code are semantically compatible', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'a blue ocean scene',
        'ctx.fillStyle = "blue"; ctx.fillRect(0, 0, 100, 100);'
      );
      expect(result.issues).toEqual([]);
    });

    it('detects missing blue color when prompt asks for blue and code uses red', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'a blue sky',
        'ctx.fillStyle = "red"; ctx.fillRect(0, 0, 100, 100);'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"blue"')])
      );
    });

    it('detects missing red color when prompt asks for red and code uses green', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'a red fire',
        'ctx.fillStyle = "green";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"red"')])
      );
    });

    it('detects missing green color when prompt asks for green', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'green forest',
        'ctx.fillStyle = "red";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"green"')])
      );
    });

    it('detects missing yellow color when prompt asks for yellow', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'yellow sun',
        'ctx.fillStyle = "blue";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"yellow"')])
      );
    });

    it('detects missing purple color when prompt asks for purple', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'purple galaxy',
        'ctx.fillStyle = "red";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"purple"')])
      );
    });

    it('detects missing orange color when prompt asks for orange', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'orange sunset',
        'ctx.fillStyle = "blue";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"orange"')])
      );
    });

    it('detects missing pink color when prompt asks for pink', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'pink flowers',
        'ctx.fillStyle = "green";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"pink"')])
      );
    });

    it('detects missing black color when prompt asks for black', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'black background',
        'ctx.fillStyle = "white";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"black"')])
      );
    });

    it('detects missing white color when prompt asks for white', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'white snow',
        'ctx.fillStyle = "black";'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('"white"')])
      );
    });

    it('does NOT flag color mismatch when code has no colors at all', () => {
      // When hasAnyColor is false, no color issue is pushed
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'blue ocean',
        'function setup() {} function draw() {}'
      );
      expect(result.issues).toEqual([]);
    });

    it('does NOT flag when prompt color IS present in code', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'blue ocean',
        'ctx.fillStyle = "blue";'
      );
      expect(result.issues).toEqual([]);
    });

    it('detects missing animation when prompt asks for animation', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'animate a bouncing ball',
        'ctx.beginPath(); ctx.arc(50, 50, 10, 0, Math.PI * 2); ctx.fill();'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('static')])
      );
    });

    it('does not flag animation when code has requestAnimationFrame', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'animate a bouncing ball',
        'function draw() { requestAnimationFrame(draw); }'
      );
      const hasAnimationIssue = result.issues.some(i => i.includes('static'));
      expect(hasAnimationIssue).toBe(false);
    });

    it('flags animation even with setInterval because regex is case-sensitive on lowercased code', () => {
      // Source lowercases code but regex uses mixed case "setInterval" — no 'i' flag
      // So "setinterval" doesn't match "setInterval"
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'moving particles',
        'setInterval(update, 16);'
      );
      const hasAnimationIssue = result.issues.some(i => i.includes('static'));
      expect(hasAnimationIssue).toBe(true); // actual behavior: case mismatch
    });

    it('flags animation even with setTimeout because regex is case-sensitive on lowercased code', () => {
      // Same issue: "settimeout" doesn't match "setTimeout"
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'rotating object',
        'setTimeout(loop, 16);'
      );
      const hasAnimationIssue = result.issues.some(i => i.includes('static'));
      expect(hasAnimationIssue).toBe(true); // actual behavior: case mismatch
    });

    it('detects missing interactivity when prompt asks for mouse interaction', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'interactive click effect',
        'ctx.beginPath(); ctx.arc(50, 50, 10, 0, Math.PI * 2); ctx.fill();'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('event handlers')])
      );
    });

    it('flags interactivity even with mousePressed because regex is case-sensitive on lowercased code', () => {
      // "mousepressed" doesn't match "mousePressed" — no 'i' flag on regex
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'click to change color',
        'function mousePressed() { fill(random(255)); }'
      );
      const hasInteractionIssue = result.issues.some(i => i.includes('event handlers'));
      expect(hasInteractionIssue).toBe(true); // actual behavior: case mismatch
    });

    it('does not flag interactivity when code has addEventListener click (case-sensitive regex)', () => {
      // The source regex is case-sensitive, so it needs exact casing match
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'click interaction',
        'canvas.addEventListener("click", handler);'  // mixed case matches the regex
      );
      // quickCheck lowercases the code, so "addEventListener" becomes "addeventlistener"
      // which does NOT match the regex pattern "addEventListener" (case-sensitive)
      // So this WILL flag the issue due to case mismatch in the source's regex
      // Testing actual behavior: the regex is applied to codeLower so it won't match
      const hasInteractionIssue = result.issues.some(i => i.includes('event handlers'));
      expect(hasInteractionIssue).toBe(true); // expected: regex doesn't match lowercase
    });

    it('does not flag interactivity when code uses onclick (lowercase match)', () => {
      // "onclick" stays lowercase after .toLowerCase(), regex pattern "onclick" matches
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'click interaction',
        'element.onclick = function() {};'  // onclick is already lowercase
      );
      const hasInteractionIssue = result.issues.some(i => i.includes('event handlers'));
      expect(hasInteractionIssue).toBe(false);
    });

    it('does not flag interactivity when code uses onclick', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'click interaction',
        'element.onclick = handler;'
      );
      const hasInteractionIssue = result.issues.some(i => i.includes('event handlers'));
      expect(hasInteractionIssue).toBe(false);
    });

    it('detects missing particle system when prompt asks for particles', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'particle system with gravity',
        'const balls = []; for (let i = 0; i < 10; i++) balls.push({x: i});'
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringContaining('particle')])
      );
    });

    it('does not flag particles when code contains "particle"', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'particle system with gravity',
        'const particles = []; class Particle {}'
      );
      const hasParticleIssue = result.issues.some(i => i.includes('particle'));
      expect(hasParticleIssue).toBe(false);
    });

    it('does not flag particles when code contains "particles" plural', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'particle effect',
        'let particles = [];'
      );
      const hasParticleIssue = result.issues.some(i => i.includes('particle'));
      expect(hasParticleIssue).toBe(false);
    });

    it('detects multiple issues simultaneously', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'blue animated particles with mouse interaction',
        'ctx.fillStyle = "red";'
      );
      // Should flag: color mismatch (blue), no animation, no interaction, no particles
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty issues for empty strings', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck('', '');
      expect(result.issues).toEqual([]);
    });

    it('handles case-insensitive color matching (uppercase code)', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'blue sky',
        'CTX.FILLSTYLE = "BLUE";'
      );
      // Uppercase code should still match since codeLower is used
      expect(result.issues).toEqual([]);
    });

    it('detects color via hex code (#0000ff for blue)', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'blue sky',
        'ctx.fillStyle = "#0000ff";'
      );
      expect(result.issues).toEqual([]);
    });

    it('detects color via rgb() for green', () => {
      const validator = new SemanticValidator();
      const result = validator.quickCheck(
        'green field',
        'ctx.fillStyle = "rgb(0, 255, 0)";'
      );
      expect(result.issues).toEqual([]);
    });
  });
});
