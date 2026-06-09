import { describe, it, expect } from 'vitest';
import { TextGenValidator } from '../../../src/core/validators/TextGenValidator.js';

describe('TextGenValidator', () => {
  describe('getMinSize', () => {
    it('returns 100', () => {
      expect(TextGenValidator.getMinSize()).toBe(100);
    });
  });

  describe('validate', () => {
    it('rejects code shorter than MIN_SIZE characters', () => {
      const result = TextGenValidator.validate('short');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('under 100 characters'))).toBe(true);
    });

    it('rejects code with fewer than 3 non-empty lines', () => {
      const short = 'line1\nline2'; // only 2 non-empty lines
      const padded = short.padEnd(150, ' padding');
      const result = TextGenValidator.validate(padded);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('fewer than 3 non-empty lines'))).toBe(true);
    });

    it('rejects flat-list output with uniform line lengths', () => {
      // 5 lines, all same length = only 1 distinct length
      const line = 'x'.repeat(30);
      const flat = [line, line, line, line, line].join('\n');
      const result = TextGenValidator.validate(flat);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too-uniform line lengths'))).toBe(true);
    });

    it('rejects output with only 2 distinct line lengths', () => {
      const short = 'x'.repeat(20);
      const long = 'x'.repeat(40);
      const twoLengths = [short, long, short, long, long].join('\n');
      const result = TextGenValidator.validate(twoLengths);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too-uniform line lengths'))).toBe(true);
    });

    it('accepts text with 3+ distinct line lengths and enough content', () => {
      const lines = [
        'x'.repeat(10),
        'x'.repeat(25),
        'x'.repeat(40),
        'x'.repeat(15),
        'x'.repeat(30),
      ];
      const good = lines.join('\n');
      const result = TextGenValidator.validate(good);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects HTML documents starting with <!DOCTYPE', () => {
      const html = '<!DOCTYPE html><html><body>' + 'x'.repeat(200) + '</body></html>';
      const result = TextGenValidator.validate(html);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('HTML document'))).toBe(true);
    });

    it('rejects HTML documents starting with <html', () => {
      const html = '<html><body>' + 'x'.repeat(200) + '</body></html>';
      const result = TextGenValidator.validate(html);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('HTML document'))).toBe(true);
    });

    it('trims whitespace before validation', () => {
      const lines = [
        'x'.repeat(10),
        'x'.repeat(25),
        'x'.repeat(40),
        'x'.repeat(15),
        'x'.repeat(30),
      ];
      const good = '  \n  ' + lines.join('\n') + '\n  ';
      const result = TextGenValidator.validate(good);
      expect(result.valid).toBe(true);
    });

    it('accumulates multiple errors', () => {
      // Too short AND too few lines
      const result = TextGenValidator.validate('hi');
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
