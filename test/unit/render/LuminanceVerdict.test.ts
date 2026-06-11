import { describe, expect, it } from 'vitest';
import {
  DARK_LUMINANCE_THRESHOLD,
  WASHOUT_MEAN_LUMINANCE,
  luminanceFromRgb8,
  verdictFromMeasure,
} from '../../../src/render/LuminanceVerdict.js';

const measure = (
  meanLuminance: number,
  brightnessStd: number,
  brightFraction = 0.3,
  darkFraction = 0.1,
) => ({
  meanLuminance,
  brightFraction,
  darkFraction,
  brightnessStd,
});

describe('LuminanceVerdict', () => {
  it('uses the F19 labeled fixtures for structure-aware washout and darkness', () => {
    expect(verdictFromMeasure(measure(0.8296, 8.7951))).toBe('washout'); // hydra fog
    expect(verdictFromMeasure(measure(0.9386, 9.4877))).toBe('washout'); // three blank-pink
    expect(verdictFromMeasure(measure(0.831, 20.4243))).toBe('ok'); // pastel flower field A
    expect(verdictFromMeasure(measure(0.8173, 18.4812))).toBe('ok'); // pastel flower field B
    expect(verdictFromMeasure(measure(0.0654, 11.3449, 0.0))).toBe('ok'); // glowing-pond nocturne
    expect(verdictFromMeasure(measure(0.03, 0.5, 0.0))).toBe('too-dark'); // dead black render
  });

  it('keeps threshold names and the luminance formula stable for callers', () => {
    expect(WASHOUT_MEAN_LUMINANCE).toBe(0.8);
    expect(DARK_LUMINANCE_THRESHOLD).toBe(0.12);
    expect(luminanceFromRgb8(255, 255, 255)).toBe(1);
    expect(luminanceFromRgb8(0, 0, 0)).toBe(0);
  });
});
