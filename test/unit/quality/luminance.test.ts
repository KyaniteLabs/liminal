import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with scripts/quality/render-gallery.mjs
import { relativeLuminance, DARK_LUMINANCE_THRESHOLD } from '../../../scripts/quality/luminance.mjs';

describe('render-gallery luminance', () => {
  it('returns 0 for black and 1 for white', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
    expect(relativeLuminance(255, 255, 255)).toBe(1);
  });

  it('applies the canonical perceptual weights (0.299R + 0.587G + 0.114B)', () => {
    expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.299, 5);
    expect(relativeLuminance(0, 255, 0)).toBeCloseTo(0.587, 5);
    expect(relativeLuminance(0, 0, 255)).toBeCloseTo(0.114, 5);
  });

  it('flags a near-black render as below the dark threshold, passes a mid-tone', () => {
    // ~0.06 — comparable to the "too dark" shader works in the 2026-06-08 audit.
    expect(relativeLuminance(15, 15, 15)).toBeLessThan(DARK_LUMINANCE_THRESHOLD);
    // ~0.47 — comparable to the acceptable showpiece.
    expect(relativeLuminance(120, 120, 120)).toBeGreaterThan(DARK_LUMINANCE_THRESHOLD);
  });

  it('uses a calibrated threshold of 0.12', () => {
    expect(DARK_LUMINANCE_THRESHOLD).toBe(0.12);
  });
});
