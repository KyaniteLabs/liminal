# Handoff 10 — F19: structure-aware luminance verdicts (calibrated, labeled-data-backed)

**Mode:** You may edit `src/render/LuminanceVerdict.ts`, its unit tests, and `docs/validation/render-measure-calibration-2026-06-11.md`. Nothing else.

## Purpose

The 2026-06-11 Fable calibration sweep (30 archive renders, production measurement code, 6 vision-graded by the main agent; data: `.quality/f19-renders/measurements.json` + `docs/validation/f19-calibration-2026-06-11.md`) found:

1. **`washout: meanLuminance ≥ 0.8` has a 50% false-positive rate, and the false positives are top-quality work** — two pastel three.js flower meadows (qualityScore 0.95/0.85) measured lum 0.82–0.83. The two TRUE washouts (structureless hydra fog lum 0.83, near-blank pink three lum 0.94) measure brightnessStd ≤ 9.5, while the good high-key art measures ≥ 18.5.
2. **`too-dark`'s only flag was a false positive** — an intentional glowing-pond p5 nocturne (q 0.95, lum 0.065, std 11.3). Dead renders measure std ≈ 0.
3. **UNIT BUG: `LOW_CONTRAST_MAX_STD = 0.08` compares against `brightnessStd`, which is on a 0–255 luma scale** (see `analyzeDecodedPixels`'s own flatness check `brightnessStd < 0.5`). The opt-in low-contrast verdict can mathematically never fire.

## Exact changes

In `src/render/LuminanceVerdict.ts`:

1. `washout` requires `meanLuminance >= 0.8 AND brightnessStd < 15` (new constant `WASHOUT_MAX_STD = 15`, document the 0–255 scale and the calibration gap [9.5, 18.5]).
2. `too-dark` additionally requires `brightnessStd < 5` (new constant `DARK_MAX_STD = 5`).
3. `LOW_CONTRAST_MAX_STD`: either fix to the measured scale (≈ 15, 0–255 units) or delete the verdict as redundant with the new structure-aware gates — **prefer deletion** unless a caller depends on it; the calibration shows the structure gate subsumes it.
4. The verdict function must take `brightnessStd` as input if it doesn't already; thread it from the callers' existing `PixelVisibilityAnalysis` (no new measurement work — the field already flows).

## Tests (red-green; exact fixture values from the labeled data)

| Case | mean | std | expected |
|---|---|---|---|
| hydra fog (true washout) | 0.8296 | 8.7951 | washout |
| three blank-pink (true washout) | 0.9386 | 9.4877 | washout |
| pastel flower field A (good) | 0.831 | 20.4243 | ok |
| pastel flower field B (good) | 0.8173 | 18.4812 | ok |
| glowing-pond nocturne (good, brightFraction 0.0) | 0.0654 | 11.3449 | ok |
| dead black render | 0.03 | 0.5 | too-dark |

## Verification

```bash
pnpm exec vitest run test/unit/render --coverage.enabled=false
pnpm typecheck && pnpm lint
```

Composition tests must stay green (`CompositeRenderGate` imports the shared module): `pnpm exec vitest run test/unit/composition --coverage.enabled=false`.

NOTE: CompositeRenderGate's composite-level thresholds were calibrated separately (#694, live-probed). If the shared `verdictFromMeasure` signature changes, keep the composite call sites behaviorally identical unless their tests still pass with the structure gate (they should — composites with structure shouldn't demote).

## What not to touch

`ScoringEngine` cap logic, `DecodedImageVisibility` measurement code, the calibration sweep script, archive data.

## Final report format

```
DIFF: <stat>
TESTS: <each command + exit code; the 6 fixture cases shown red→green>
DECISION: <low-contrast fixed-scale or deleted, with reasoning>
```

Stop and ask if any existing test encodes the old washout-without-std behavior as a product contract (rather than just pinning constants).
