# F19 calibration — labeled render dataset (2026-06-11)

Fulfils the "next calibration data needed" contract from `render-measure-calibration-2026-06-11.md`: 30 archive entries rendered headless (production measurement: `dist/render/DecodedImageVisibility.js`), 3 lowest + 3 highest `qualityScore` per visual domain, key flags vision-graded by the main agent. Raw data + PNGs: `.quality/f19-renders/` (gitignored; regenerate with `.quality/f19-calibrate.mjs`).

## Headline findings

1. **`washout: meanLuminance ≥ 0.8` alone is unshippable as a score gate: 50% false-positive rate on this set, and the FPs are the archive's best work** (two pastel three.js flower meadows, qualityScore 0.95/0.85, vision-graded GOOD). Mean luminance cannot distinguish "washed to structureless fog" from "bright pastel scene with a readable subject".
2. **`brightnessStd` (0–255 luma scale) is the separating signal.** True washouts (vision-graded): hydra fog std 8.80, three blank-pink std 9.49. Good high-key art: std 18.48, 20.42. Clean gap [9.5, 18.5] → gate `washout = lum ≥ 0.8 AND std < 15`.
3. **`too-dark`'s only flag was a false positive** — an intentional glowing-pond p5 nocturne (q 0.95, lum 0.065, std 11.34, vision-graded GOOD). Dead renders have std ≈ 0 → add `std < 5` to the too-dark rule.
4. **Unit bug: `LOW_CONTRAST_MAX_STD = 0.08` is on a 0–1 scale but `brightnessStd` is 0–255** — the opt-in low-contrast verdict can never fire. With structure-aware washout/dark gates it is likely redundant; fix-or-delete is specified in Handoff 10.
5. SVG rows excluded: all six rendered as identical blanks (lum 0.0322, std 0) — a sweep-harness wrapping failure (the F14 viewBox-sizing class), not a measurement result.

## Vision-graded labels

| Render | qualityScore | mean lum | std | machine verdict | human label |
|---|---|---|---|---|---|
| hydra-q0.65-hyd_2d3d | 0.65 | 0.8296 | 8.80 | washout | WASHED (gray field, sliver debris) — true positive |
| three-q0.65-thr_1653 | 0.65 | 0.9386 | 9.49 | washout | WASHED (blank pink, specks) — true positive |
| three-q0.95-thr_8a8e | 0.95 | 0.8310 | 20.42 | washout | GOOD (pastel flower meadow) — **false positive** |
| three-q0.85-thr_c9b5 | 0.85 | 0.8173 | 18.48 | washout | GOOD (pastel flower meadow) — **false positive** |
| p5-q0.95-p5_d7260 | 0.95 | 0.0654 | 11.34 | too-dark | GOOD (glowing-pond nocturne) — **false positive** |
| hydra-q0.85-hyd_5f99 | 0.85 | 0.7472 | 12.42 | ok | GOOD (vivid psychedelic marble) — true negative |

Remaining 18 usable rows (hydra/p5/glsl/three, machine verdict `ok`, qualityScore 0.65–0.95) serve as implicit negatives; none vision-contradicted on spot checks.

## Calibrated rules (specified in Handoff 10)

- `washout`: `meanLuminance ≥ 0.8 AND brightnessStd < 15`
- `too-dark`: `meanLuminance ≤ 0.1 AND brightFraction < 0.02 AND brightnessStd < 5`
- `low-contrast`: delete or rescale to ≈15 (0–255 units); never enable at 0.08.

Re-run rule: the 6 labeled fixtures above are the regression table — any future threshold change must keep all six correct.
