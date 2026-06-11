# Render measure calibration — 2026-06-11

Purpose: make the H06 luminance scorer honest. It should penalize obvious washed-out or black renders, but it must not pretend to grade artistic quality without calibration data.

## Current thresholds

| Verdict | Rule |
| --- | --- |
| `washout` | mean luminance >= `0.80` |
| `too-dark` | mean luminance <= `0.10` and bright fraction < `0.02` |
| `low-contrast` | disabled by default; requires `SINTER_CONTRAST_VERDICT=1` or explicit scorer option |

## Available calibration artifact

Command used:

```bash
node scripts/quality/render-gallery.mjs --count 8 --wait 1000
```

| Artifact | mean | bright fraction | dark fraction | brightness std | verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| `gallery/2026-06-11--cli-project/v1.js` | `0.4096` | `0.3427` | `0.1019` | `0.2500` | `ok` |

## Decision

The available gallery set has only one visual artifact, so it does **not** prove a reliable separation between C+/D work and A-grade work. H06 therefore ships the objective failure gates only:

- extreme washout;
- extreme darkness with almost no bright focal content;
- no penalty for missing/undecodable screenshots, because that is an infrastructure gap, not evidence of bad art.

Low-contrast scoring remains opt-in until the gallery contains a representative set of washed Hydra, pale p5, A-grade shader, and hyperframes renders with human labels.

## Next calibration data needed

Capture at least 10 labeled renders across Hydra, p5, GLSL, three, hyperframes, and SVG. Include at least:

- two known washed-out failures;
- two known too-dark failures;
- two low-contrast-but-intentional pieces;
- four strong accepted pieces.

Only then should `low-contrast` become a default verdict.
