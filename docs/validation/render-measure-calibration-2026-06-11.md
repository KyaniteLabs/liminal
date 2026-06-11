# Render measure calibration — 2026-06-11

Purpose: make the H06/F19 luminance scorer honest. It should penalize obvious washed-out or black renders, but it must not punish bright high-key work with real structure.

## Current thresholds

| Verdict | Rule |
| --- | --- |
| `washout` | mean luminance >= `0.80` and brightness std < `15` |
| `too-dark` | mean luminance <= `0.10`, bright fraction < `0.02`, and brightness std < `5` |
| `low-contrast` | deleted from live verdicting; structure-aware washout/dark gates cover the calibrated failure class |

`brightnessStd` is on the `0..255` luma scale produced by `DecodedImageVisibility`. Missing `brightnessStd` keeps the legacy mean-only behavior for older composite measurements that do not yet carry the field.

## Calibration artifact

The first H06 artifact was intentionally conservative: one measured gallery render, verdict `ok`. Handoff 10 upgrades the rule from the F19 labeled sweep documented in `docs/validation/f19-calibration-2026-06-11.md`.

The regression table is the six vision-graded fixtures from that sweep:

| Fixture | mean | brightness std | bright fraction | previous verdict | calibrated verdict |
| --- | ---: | ---: | ---: | --- | --- |
| hydra fog, true washout | `0.8296` | `8.7951` | default | `washout` | `washout` |
| three blank-pink, true washout | `0.9386` | `9.4877` | default | `washout` | `washout` |
| pastel flower field A, good high-key | `0.8310` | `20.4243` | default | `washout` | `ok` |
| pastel flower field B, good high-key | `0.8173` | `18.4812` | default | `washout` | `ok` |
| glowing-pond nocturne, good dark | `0.0654` | `11.3449` | `0.0` | `too-dark` | `ok` |
| dead black render | `0.0300` | `0.5000` | `0.0` | `too-dark` | `too-dark` |

## Decision

Mean luminance alone was too blunt: it flagged bright pastel work as washout and dark intentional work as too-dark. The labeled set shows the separating signal is structure (`brightnessStd`): true washouts are below `9.5`, while good high-key renders are above `18.4`.

Live verdicting now uses:

- `washout = mean >= 0.80 && brightnessStd < 15`
- `too-dark = mean <= 0.10 && brightFraction < 0.02 && brightnessStd < 5`

The old opt-in `low-contrast` branch is removed from live verdicting instead of rescaled. Rescaling it would reintroduce false positives on the same high-key/low-key art class the F19 sweep was meant to protect. Keep future contrast work behind a separately labeled dataset and a separate regression table.
