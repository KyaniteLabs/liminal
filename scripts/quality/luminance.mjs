// Mean-luminance helper for the gallery vision-audit renderer. Lets the audit
// FLAG too-dark / low-contrast renders objectively (the recurring quality
// weakness called out in docs/validation/vision-audit-2026-06-08.md) instead of
// relying on the grader's eyes alone. Unit-tested in
// test/unit/quality/luminance.test.ts.
//
// Uses the repo's canonical perceptual weights (see
// src/guardrails/AccessibilityGuardrails.ts): 0.299R + 0.587G + 0.114B.

// Relative luminance of an 8-bit RGB triple, normalised to 0..1.
export function relativeLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Mean luminance (0..1) below this is flagged DARK. Calibrated against the
// 2026-06-08 vision audit: the works graded "too dark / barely legible"
// measured 0.02–0.06; the acceptable showpiece measured ~0.47.
export const DARK_LUMINANCE_THRESHOLD = 0.12;

// A pixel with luminance above this counts as "bright" focal content.
export const BRIGHT_PIXEL_LUMINANCE = 0.5;
// A low-mean render is only flagged "too dark" when it ALSO lacks bright focal
// content (bright-pixel fraction below this). This stops legitimate dark designs
// — a dark background with bright text/elements (e.g. kinetic typography) — from
// being false-failed and forced to brighten into mud. Calibrated 2026-06-09:
// the good "KINETIC FLOW" dark render measured brightFrac 0.008; a truly blank
// dark render measures ~0.
export const MIN_BRIGHT_FRACTION = 0.005;
// A near-white, low-saturation pixel (max(rgb)-min(rgb) < WHITE_SATURATION_MAX).
export const WHITE_LUMINANCE = 0.9;
export const WHITE_SATURATION_MAX = 40;
// A render is washed-out (overbright) when most of the frame is near-white.
// The mean-luminance check only caught too-DARK; this catches too-BRIGHT.
// Calibrated 2026-06-09: the washed-out hydra render measured whiteFrac 1.0;
// every good render measured ≤ 0.004.
export const WASHOUT_WHITE_FRACTION = 0.7;

// Blank/flat detection is calibrated from .quality/gauntlet PNGs, not vibes.
// The safe discriminator is flattened RGB variance AND grayscale edge signal:
// - hydra@23-55 blank: color stdev 1.7, edge density 0.02
// - shader-error screens: color stdev 5.1, edge density 0.15
// - nearest real dark Three scene: color stdev 15.1, edge density 0.21
export const HARD_BLANK_COLOR_STDEV_THRESHOLD = 5;
export const HARD_BLANK_EDGE_DENSITY_THRESHOLD = 0.2;
export const SUSPECT_BLANK_COLOR_STDEV_THRESHOLD = 15;
export const SUSPECT_BLANK_EDGE_DENSITY_THRESHOLD = 0.3;

// Washout calibration uses RGB stdev because whiteFraction catches only
// near-white low-saturation pixels. This catches bright low-variance blanks even
// when a tiny amount of color residue stops the frame from looking pure white.
export const WASHOUT_MEAN_GRAY_THRESHOLD = 240;
export const WASHOUT_COLOR_STDEV_THRESHOLD = 10;

/**
 * Classify a rendered frame from its aggregate pixel stats. Returns an error
 * string when the render fails the objective quality floor, else null.
 *
 * Honest about three failure modes — and only those:
 *  - washed-out: most of the frame is near-white (overbright).
 *  - blank: solid or near-uniform fill (low color variance + low edge density).
 *  - low-detail/suspect: borderline near-flat render failures such as shader error screens.
 *  - too-dark/blank: dim everywhere AND no bright focal content.
 *
 * A dark background WITH bright focal content (text, a lit subject) passes — it
 * is an intentional design, not a failure.
 *
 * @param {{
 *   meanGray:number,
 *   colorStdev:number,
 *   edgeDensity:number,
 *   meanLuminance:number,
 *   brightFraction:number,
 *   whiteFraction:number,
 * }} stats
 *   meanGray, colorStdev, edgeDensity use 0..255 pixel units.
 * @returns {string|null}
 */
export function classifyRenderQuality({
  meanGray,
  colorStdev,
  edgeDensity,
  meanLuminance,
  brightFraction,
  whiteFraction,
}) {
  if (
    whiteFraction > WASHOUT_WHITE_FRACTION
    || (meanGray > WASHOUT_MEAN_GRAY_THRESHOLD && colorStdev < WASHOUT_COLOR_STDEV_THRESHOLD)
  ) {
    return `Render is washed out (mean gray: ${meanGray.toFixed(1)}, color stdev: ${colorStdev.toFixed(1)}, near-white fraction: ${whiteFraction.toFixed(3)})`;
  }
  if (colorStdev < HARD_BLANK_COLOR_STDEV_THRESHOLD && edgeDensity < HARD_BLANK_EDGE_DENSITY_THRESHOLD) {
    return `Render is blank/flat (color stdev: ${colorStdev.toFixed(1)}, edge density: ${edgeDensity.toFixed(2)})`;
  }
  if (colorStdev < SUSPECT_BLANK_COLOR_STDEV_THRESHOLD && edgeDensity < SUSPECT_BLANK_EDGE_DENSITY_THRESHOLD) {
    return `Render is low-detail / likely failed (color stdev: ${colorStdev.toFixed(1)}, edge density: ${edgeDensity.toFixed(2)})`;
  }
  if (meanLuminance < DARK_LUMINANCE_THRESHOLD && brightFraction < MIN_BRIGHT_FRACTION) {
    return `Render is too dark / likely blank (mean luminance: ${meanLuminance.toFixed(3)}, bright fraction: ${brightFraction.toFixed(4)})`;
  }
  return null;
}
