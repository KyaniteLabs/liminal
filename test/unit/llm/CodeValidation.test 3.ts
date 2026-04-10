import { describe, it, expect } from 'vitest';
import { sanitizeOutput, isCodeComplete } from '../../../src/llm/LLMClient.js';

describe('LLMClient Code Validation', () => {
  describe('sanitizeOutput - code completeness', () => {
    it('parses complete code successfully', () => {
      const content = '```javascript\nfunction test() { return 42; }\n```';
      const result = sanitizeOutput(content);
      expect(result.success).toBe(true);
      expect(result.code).toContain('function test()');
    });

    it('warns for code with unclosed brace', () => {
      const content = '```javascript\nfunction test() { return 42;\n```';
      const result = sanitizeOutput(content);
      expect(result.isComplete).toBe(false);
    });

    it('warns for code with unclosed parentheses', () => {
      const content = '```javascript\nfunction test((\n```';
      const result = sanitizeOutput(content);
      expect(result.isComplete).toBe(false);
    });

    it('handles balanced brackets correctly', () => {
      const content = '```javascript\nconst arr = [1, 2, [3, 4]];\n```';
      const result = sanitizeOutput(content);
      expect(result.success).toBe(true);
      expect(result.isComplete).toBe(true);
    });
  });

  describe('sanitizeOutput - edge cases', () => {
    it('handles empty content', () => {
      const result = sanitizeOutput('');
      expect(result.code).toBe('');
      expect(result.success).toBe(false);
    });

    it('handles content without code block', () => {
      const content = 'function setup() { createCanvas(400, 400); }';
      const result = sanitizeOutput(content);
      expect(result.code).toContain('function setup()');
    });

    it('strips <think/> tags from content', () => {
      const content = '<think<Let me think about this...</think<\n```javascript\nfunction test() { return 42; }\n```';
      const result = sanitizeOutput(content);
      expect(result.success).toBe(true);
      expect(result.code).not.toContain('<think');
      expect(result.code).toContain('function test()');
    });
  });

  describe('isCodeComplete', () => {
    it('returns true for balanced code', () => {
      expect(isCodeComplete('function test() { return 42; }')).toBe(true);
    });

    it('returns false for unbalanced braces', () => {
      expect(isCodeComplete('function test() { return 42;')).toBe(false);
    });

    it('returns false for unbalanced parens', () => {
      expect(isCodeComplete('function test((')).toBe(false);
    });
  });
});
