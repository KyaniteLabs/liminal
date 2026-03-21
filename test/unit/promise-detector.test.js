import { describe, it, expect } from 'vitest';
import { PromiseDetector } from '../../src/core/PromiseDetector.js';

describe('PromiseDetector', () => {
  describe('detect()', () => {
    it('should return true for exact promise match', () => {
      const output = 'Some text <promise>COMPLETE</promise> more text';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should return true for promise at start of string', () => {
      const output = '<promise>COMPLETE</promise> more text';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should return true for promise at end of string', () => {
      const output = 'Some text <promise>COMPLETE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should return true for standalone promise', () => {
      const output = '<promise>COMPLETE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should return false for partial match - missing start tag', () => {
      const output = 'COMPLETE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for partial match - missing end tag', () => {
      const output = '<promise>COMPLETE';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for partial match - incomplete word', () => {
      const output = '<promise>COMPLET</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for case-sensitive mismatch - lowercase', () => {
      const output = '<promise>complete</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for case-sensitive mismatch - mixed case', () => {
      const output = '<promise>Complete</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for case-sensitive mismatch - uppercase tags', () => {
      const output = '<PROMISE>COMPLETE</PROMISE>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for different content', () => {
      const output = '<promise>SOMETHING_ELSE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const output = '';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for whitespace only', () => {
      const output = '   ';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for similar but not exact pattern', () => {
      const output = '<promise>COMPLETE </promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for promise with whitespace in tag', () => {
      const output = '<promise> COMPLETE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for multiple occurrences when none are exact', () => {
      const output = '<promise>FAIL</promise> <promise>COMPLETE</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should handle multiline strings correctly', () => {
      const output = `Line 1
Line 2
<promise>COMPLETE</promise>
Line 4`;
      const result = PromiseDetector.detect(output);
      expect(result).toBe(true);
    });

    it('should be case-sensitive for COMPLETE word', () => {
      const output = '<promise>CoMpLeTe</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should require exact spelling of COMPLETE', () => {
      const output = '<promise>COMPLEET</promise>';
      const result = PromiseDetector.detect(output);
      expect(result).toBe(false);
    });

    it('should return false for null input', () => {
      const result = PromiseDetector.detect(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined input', () => {
      const result = PromiseDetector.detect(undefined);
      expect(result).toBe(false);
    });

    it('should return false for number input', () => {
      const result = PromiseDetector.detect(123);
      expect(result).toBe(false);
    });

    it('should return false for object input', () => {
      const result = PromiseDetector.detect({});
      expect(result).toBe(false);
    });
  });
});