import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with scripts/quality/render-gallery.mjs
import { relativeLuminance, DARK_LUMINANCE_THRESHOLD, classifyRenderQuality } from '../../../scripts/quality/luminance.mjs';

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

describe('classifyRenderQuality (gauntlet render-quality gate)', () => {
  it('FAILS a washed-out near-white render (hydra washout class)', () => {
    // Measured 2026-06-09: the washed hydra render had whiteFraction 1.0.
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.999, brightFraction: 1.0, whiteFraction: 1.0 }))
      .toMatch(/washed out/);
  });

  it('PASSES a dark design WITH bright focal content (kinetic typography — not a false-dark)', () => {
    // Measured 2026-06-09: the good "KINETIC FLOW" dark render — mean 0.057 but
    // brightFraction 0.008 from the bright text. Must NOT be flagged.
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.057, brightFraction: 0.008, whiteFraction: 0.004 }))
      .toBeNull();
  });

  it('FAILS a genuinely blank/dark render (dim everywhere, no focal content)', () => {
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.02, brightFraction: 0.0, whiteFraction: 0.0 }))
      .toMatch(/too dark/);
  });

  it('FAILS a solid-color (blank) render', () => {
    expect(classifyRenderQuality({ isSolid: true, meanLuminance: 0.5, brightFraction: 0.5, whiteFraction: 0.0 }))
      .toMatch(/blank/);
  });

  it('PASSES good renders (three, p5, glsl — mid/bright with content, not washed)', () => {
    // three: mean 0.581, brightFraction 0.666, whiteFraction 0.001
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.581, brightFraction: 0.666, whiteFraction: 0.001 })).toBeNull();
    // p5: mean 0.213, brightFraction 0.101, whiteFraction 0.0
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.213, brightFraction: 0.101, whiteFraction: 0.0 })).toBeNull();
    // glsl: mid-tone cloud, mean 0.198, NO bright pixels — still fine (not dark, not washed)
    expect(classifyRenderQuality({ isSolid: false, meanLuminance: 0.198, brightFraction: 0.0, whiteFraction: 0.0 })).toBeNull();
  });
});
