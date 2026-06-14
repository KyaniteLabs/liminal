import { describe, it, expect } from 'vitest';
import { Domain, normalizeDomain, isValidDomain } from '../../../src/types/domains.js';

describe('normalizeDomain', () => {
  it('returns the canonical Domain for a valid label', () => {
    expect(normalizeDomain('p5')).toBe(Domain.P5);
    expect(normalizeDomain('hydra')).toBe(Domain.HYDRA);
  });

  it('resolves the webgl synonym to WEBGL and fragment to GLSL', () => {
    expect(normalizeDomain('webgl')).toBe(Domain.WEBGL);
    expect(normalizeDomain('fragment')).toBe(Domain.GLSL);
  });

  it('recognizes the newly-canonical svg/html/textgen domains', () => {
    expect(normalizeDomain('svg')).toBe(Domain.SVG);
    expect(normalizeDomain('html')).toBe(Domain.HTML);
    expect(normalizeDomain('textgen')).toBe(Domain.TEXTGEN);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeDomain('  P5 ')).toBe(Domain.P5);
    expect(normalizeDomain('HYDRA')).toBe(Domain.HYDRA);
  });

  it('returns UNKNOWN for unrecognized labels instead of lying', () => {
    expect(normalizeDomain('not-a-domain')).toBe(Domain.UNKNOWN);
    expect(normalizeDomain('')).toBe(Domain.UNKNOWN);
    expect(normalizeDomain(undefined)).toBe(Domain.UNKNOWN);
    expect(normalizeDomain(null)).toBe(Domain.UNKNOWN);
  });

  it('keeps tone and strudel distinct (both music, different generators)', () => {
    expect(normalizeDomain('tone')).toBe(Domain.TONE);
    expect(normalizeDomain('strudel')).toBe(Domain.STRUDEL);
    expect(Domain.TONE).not.toBe(Domain.STRUDEL);
  });

  it('svg/html/textgen are now valid canonical domains', () => {
    expect(isValidDomain('svg')).toBe(true);
    expect(isValidDomain('html')).toBe(true);
    expect(isValidDomain('textgen')).toBe(true);
  });
});
