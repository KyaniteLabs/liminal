import { describe, expect, it } from 'vitest';
import {
  DARK_LUMINANCE_THRESHOLD,
  LOW_CONTRAST_MAX_STD,
  WASHOUT_MEAN_LUMINANCE,
  luminanceFromRgb8,
  verdictFromMeasure,
} from '../../../src/render/LuminanceVerdict.js';

const measure = (meanLuminance: number, brightFraction = 0.3, darkFraction = 0.1, brightnessStd = 0.2) => ({
  meanLuminance,
  brightFraction,
  darkFraction,
  brightnessStd,
});

describe('LuminanceVerdict', () => {
  it('classifies washout at the shared inclusive threshold', () => {
    expect(verdictFromMeasure(measure(WASHOUT_MEAN_LUMINANCE))).toBe('washout');
    expect(verdictFromMeasure(measure(WASHOUT_MEAN_LUMINANCE - 0.01))).toBe('ok');
  });

  it('classifies too-dark only when bright focal content is absent', () => {
    expect(verdictFromMeasure(measure(0.05, 0.0))).toBe('too-dark');
    expect(verdictFromMeasure(measure(0.1, 0.019))).toBe('too-dark');
    expect(verdictFromMeasure(measure(0.05, 0.1))).toBe('ok');
  });

  it('keeps low-contrast behind the explicit contrast gate', () => {
    const pale = measure(0.55, 0.9, 0, LOW_CONTRAST_MAX_STD);

    expect(verdictFromMeasure(pale, { lowContrast: false })).toBe('ok');
    expect(verdictFromMeasure(pale, { lowContrast: true })).toBe('low-contrast');
  });

  it('uses the composite luminance formula and dark threshold scale', () => {
    expect(luminanceFromRgb8(255, 255, 255)).toBe(1);
    expect(luminanceFromRgb8(0, 0, 0)).toBe(0);
    expect(DARK_LUMINANCE_THRESHOLD).toBe(0.12);
  });
});
