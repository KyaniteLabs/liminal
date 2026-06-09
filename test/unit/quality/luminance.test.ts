import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with scripts/quality/render-gallery.mjs
import {
  relativeLuminance,
  DARK_LUMINANCE_THRESHOLD,
  HARD_BLANK_COLOR_STDEV_THRESHOLD,
  HARD_BLANK_EDGE_DENSITY_THRESHOLD,
  SUSPECT_BLANK_COLOR_STDEV_THRESHOLD,
  SUSPECT_BLANK_EDGE_DENSITY_THRESHOLD,
  WASHOUT_MEAN_GRAY_THRESHOLD,
  WASHOUT_COLOR_STDEV_THRESHOLD,
  classifyRenderQuality,
} from '../../../scripts/quality/luminance.mjs';

function renderStats(overrides = {}) {
  return {
    meanGray: 120,
    colorStdev: 30,
    edgeDensity: 0.5,
    meanLuminance: 0.47,
    brightFraction: 0.1,
    whiteFraction: 0,
    ...overrides,
  };
}

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

  it('uses Kimi-calibrated blank/flat and washout thresholds', () => {
    expect(HARD_BLANK_COLOR_STDEV_THRESHOLD).toBe(5);
    expect(HARD_BLANK_EDGE_DENSITY_THRESHOLD).toBe(0.2);
    expect(SUSPECT_BLANK_COLOR_STDEV_THRESHOLD).toBe(15);
    expect(SUSPECT_BLANK_EDGE_DENSITY_THRESHOLD).toBe(0.3);
    expect(WASHOUT_MEAN_GRAY_THRESHOLD).toBe(240);
    expect(WASHOUT_COLOR_STDEV_THRESHOLD).toBe(10);
  });
});

describe('classifyRenderQuality (gauntlet render-quality gate)', () => {
  it('FAILS a washed-out near-white low-variance render as washed out', () => {
    // Measured 2026-06-09: the washed hydra render had whiteFraction 1.0.
    expect(classifyRenderQuality(renderStats({
      meanGray: 254.8,
      colorStdev: 1.7,
      edgeDensity: 0.02,
      meanLuminance: 0.999,
      brightFraction: 1.0,
      whiteFraction: 1.0,
    })))
      .toMatch(/washed out/);
  });

  it('PASSES a dark design WITH bright focal content (kinetic typography — not a false-dark)', () => {
    // Measured 2026-06-09: the good "KINETIC FLOW" dark render — mean 0.057 but
    // brightFraction 0.008 from the bright text. Must NOT be flagged.
    expect(classifyRenderQuality(renderStats({
      meanGray: 15.3,
      colorStdev: 19.6,
      edgeDensity: 0.61,
      meanLuminance: 0.057,
      brightFraction: 0.008,
      whiteFraction: 0.004,
    })))
      .toBeNull();
  });

  it('FAILS a genuinely blank/dark render (dim everywhere, no focal content)', () => {
    expect(classifyRenderQuality(renderStats({
      meanGray: 5,
      colorStdev: 18,
      edgeDensity: 0.4,
      meanLuminance: 0.02,
      brightFraction: 0.0,
    })))
      .toMatch(/too dark/);
  });

  it('FAILS flat black, navy, and light-gray renders as blank/flat', () => {
    expect(classifyRenderQuality(renderStats({
      meanGray: 0,
      colorStdev: 0,
      edgeDensity: 0,
      meanLuminance: 0.0,
      brightFraction: 0.0,
    })))
      .toMatch(/blank\/flat/);
    expect(classifyRenderQuality(renderStats({
      meanGray: 8,
      colorStdev: 4.9,
      edgeDensity: 0.19,
      meanLuminance: 0.03,
      brightFraction: 0.0,
    })))
      .toMatch(/blank\/flat/);
    expect(classifyRenderQuality(renderStats({
      meanGray: 184,
      colorStdev: 3.5,
      edgeDensity: 0.01,
      meanLuminance: 0.72,
      brightFraction: 1.0,
    })))
      .toMatch(/blank\/flat/);
  });

  it('FAILS low-detail shader error screens as likely failed, not blank', () => {
    expect(classifyRenderQuality(renderStats({
      meanGray: 0.2,
      colorStdev: 5.1,
      edgeDensity: 0.15,
      meanLuminance: 0.001,
      brightFraction: 0.0,
    })))
      .toMatch(/low-detail/);
  });

  it('PASSES good renders outside the calibrated blank/suspect bands', () => {
    // three: mean 0.581, brightFraction 0.666, whiteFraction 0.001
    expect(classifyRenderQuality(renderStats({ meanGray: 209.9, colorStdev: 57.4, edgeDensity: 1.96, meanLuminance: 0.581, brightFraction: 0.666, whiteFraction: 0.001 }))).toBeNull();
    // p5: mean 0.213, brightFraction 0.101, whiteFraction 0.0
    expect(classifyRenderQuality(renderStats({ meanGray: 43.1, colorStdev: 72.2, edgeDensity: 2.30, meanLuminance: 0.213, brightFraction: 0.101, whiteFraction: 0.0 }))).toBeNull();
    // glsl: mid-tone cloud, mean 0.198, NO bright pixels — still fine (not dark, not washed)
    expect(classifyRenderQuality(renderStats({ meanGray: 60.8, colorStdev: 36.8, edgeDensity: 0.21, meanLuminance: 0.198, brightFraction: 0.0, whiteFraction: 0.0 }))).toBeNull();
    // three@21-30 is real dark content near the suspect band; edge density keeps it passing.
    expect(classifyRenderQuality(renderStats({ meanGray: 17.1, colorStdev: 14.1, edgeDensity: 0.36, meanLuminance: 0.08, brightFraction: 0.006 }))).toBeNull();
  });
});
