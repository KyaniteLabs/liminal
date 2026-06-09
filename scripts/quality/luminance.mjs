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

// Mean luminance (0..1) above this is flagged WASHED OUT (overbright / near-white).
// Calibrated against the 2026-06-09 hydra washout data: washed renders measured
// 0.89–0.99; acceptable renders measured 0.32–0.68. See
// docs/validation/visual-quality-depth-2026-06-09.md.
export const WASHOUT_LUMINANCE_THRESHOLD = 0.85;

// True if a render's mean luminance is washed out (overbright). The generator
// cannot predict this at codegen time, so it is judged on the rendered image.
export function isWashedOut(meanLuminance) {
  return meanLuminance > WASHOUT_LUMINANCE_THRESHOLD;
}
