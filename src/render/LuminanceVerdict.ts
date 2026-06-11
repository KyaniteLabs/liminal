export interface LuminanceMeasure {
  /** Mean perceptual luminance of the frame, 0..1 (0.299R+0.587G+0.114B). */
  meanLuminance: number;
  /** Fraction of pixels with luminance > 0.5 ("bright" content). */
  brightFraction: number;
  /** Fraction of pixels with luminance < 0.12. */
  darkFraction: number;
  /** Standard deviation of perceptual brightness on the 0..255 luma scale. */
  brightnessStd?: number;
}

export type LuminanceVerdict = 'ok' | 'washout' | 'too-dark' | 'low-contrast';

export const WASHOUT_MEAN_LUMINANCE = 0.8;
export const DARK_MEAN_LUMINANCE = 0.1;
export const DARK_MIN_BRIGHT_FRACTION = 0.02;
export const BRIGHT_LUMINANCE_THRESHOLD = 0.5;
export const DARK_LUMINANCE_THRESHOLD = 0.12;
// brightnessStd is measured on the 0..255 luma scale; the F19 labeled set
// separates true washouts (<= 9.5) from good high-key art (>= 18.5).
export const WASHOUT_MAX_STD = 15;
export const DARK_MAX_STD = 5;
// Fog shape (2026-06-11 addendum): a structureless frame where EVERY pixel is
// "bright" evades the mean-luminance bar (live hydra probe: lum 0.731). On the
// 39-measurement set + probe this catches 5 fogs/blanks (all q0.65) with zero
// false positives; nearest good work measures std 11.19.
export const FOG_MIN_BRIGHT_FRACTION = 0.98;
export const FOG_MAX_STD = 10;

export function luminanceFromRgb8(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function verdictFromMeasure(
  measure: LuminanceMeasure,
  _options: { lowContrast?: boolean } = {},
): LuminanceVerdict {
  const std = validStd(measure.brightnessStd);
  if (
    measure.meanLuminance >= WASHOUT_MEAN_LUMINANCE
    && (std === undefined || std < WASHOUT_MAX_STD)
  ) return 'washout';
  // Fog needs a measured std: with no structure signal we stay conservative.
  if (
    std !== undefined
    && measure.brightFraction >= FOG_MIN_BRIGHT_FRACTION
    && std < FOG_MAX_STD
  ) return 'washout';
  if (
    measure.meanLuminance <= DARK_MEAN_LUMINANCE
    && measure.brightFraction < DARK_MIN_BRIGHT_FRACTION
    && (std === undefined || std < DARK_MAX_STD)
  ) {
    return 'too-dark';
  }
  return 'ok';
}

function validStd(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value;
}
