import { describe, it, expect } from 'vitest';
import { PromiseDetector } from '../../../src/core/PromiseDetector.js';

describe('PromiseDetector', () => {
  it('detects exact promise string', () => {
    expect(PromiseDetector.detect('some output <promise>COMPLETE</promise> more text')).toBe(true);
  });

  it('detects promise at start of string', () => {
    expect(PromiseDetector.detect('<promise>COMPLETE</promise>')).toBe(true);
  });

  it('detects promise at end of string', () => {
    expect(PromiseDetector.detect('code here\n<promise>COMPLETE</promise>')).toBe(true);
  });

  it('returns false for wrong case', () => {
    expect(PromiseDetector.detect('<promise>complete</promise>')).toBe(false);
    expect(PromiseDetector.detect('<PROMISE>COMPLETE</PROMISE>')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(PromiseDetector.detect('<promise>COMPLETE')).toBe(false);
    expect(PromiseDetector.detect('COMPLETE</promise>')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(PromiseDetector.detect('')).toBe(false);
  });

  it('returns false for unrelated text', () => {
    expect(PromiseDetector.detect('function setup() {}')).toBe(false);
  });
});
