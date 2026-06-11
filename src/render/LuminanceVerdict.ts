export interface LuminanceMeasure {
  /** Mean perceptual luminance of the frame, 0..1 (0.299R+0.587G+0.114B). */
  meanLuminance: number;
  /** Fraction of pixels with luminance > 0.5 ("bright" content). */
  brightFraction: number;
  /** Fraction of pixels with luminance < 0.12. */
  darkFraction: number;
  /** Standard deviation of perceptual brightness; accepts either 0..1 or 0..255 scale. */
  brightnessStd?: number;
}

export type LuminanceVerdict = 'ok' | 'washout' | 'too-dark' | 'low-contrast';

export const WASHOUT_MEAN_LUMINANCE = 0.8;
export const DARK_MEAN_LUMINANCE = 0.1;
export const DARK_MIN_BRIGHT_FRACTION = 0.02;
export const BRIGHT_LUMINANCE_THRESHOLD = 0.5;
export const DARK_LUMINANCE_THRESHOLD = 0.12;
export const LOW_CONTRAST_MIN_MEAN_LUMINANCE = 0.45;
export const LOW_CONTRAST_MAX_STD = 0.08;

export function luminanceFromRgb8(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function verdictFromMeasure(
  measure: LuminanceMeasure,
  options: { lowContrast?: boolean } = {},
): LuminanceVerdict {
  if (measure.meanLuminance >= WASHOUT_MEAN_LUMINANCE) return 'washout';
  if (measure.meanLuminance <= DARK_MEAN_LUMINANCE && measure.brightFraction < DARK_MIN_BRIGHT_FRACTION) {
    return 'too-dark';
  }
  const lowContrastEnabled = options.lowContrast ?? (process.env.SINTER_CONTRAST_VERDICT === '1');
  if (lowContrastEnabled) {
    const std = normalizedStd(measure.brightnessStd);
    if (
      std !== undefined
      && measure.meanLuminance >= LOW_CONTRAST_MIN_MEAN_LUMINANCE
      && std <= LOW_CONTRAST_MAX_STD
    ) {
      return 'low-contrast';
    }
  }
  return 'ok';
}

function normalizedStd(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value > 1 ? value / 255 : value;
}
