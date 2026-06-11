# Archive composition — first showpiece + gate regression fix (2026-06-11)

The post-pass-3 P1 direction made real: composites assembled from **curated archive-top entries** (zero new generations). Composer: `scripts/quality/compose-archive.mjs` (outputs to `.quality/showcase/`).

## Showpiece 1 — "Tide Pool (archive-composed)"

Ingredients (all archive-tops, thematically coherent): `thr_f18b242d` (three.js bioluminescent anemone tide pool, q0.95, base/normal), `gls_d946cb5b` (glsl breathing topography, q0.92, overlay 0.3), `p5_94485ccd` (p5 bioluminescent tide pool, q0.95, screen 0.75), `ton_23d7dfef` (tone audio bed, q1.00).

- First blend attempt (glsl base + two screen layers) washed to near-white — the F16 class, live.
- Re-blend (scene base / texture overlay / spark accents) reads as one work: anemone pool with bioluminescent water-glints. **Vision grade: B/B+.** Gate measure: lum 0.374, brightF 0.002, dark 0 → ok.
- Lesson: standalone archive entries carry opaque backgrounds; composition grammar is scene-base + low-opacity texture + screen accents. Craft lever is selection/blending and iterates at zero generation cost.

## Gate regression found live (FAB-026) — fixed

The washout went undemoted because `CompositeRenderGate`'s in-page measurement broke when H10 moved `luminanceFromRgb8`/thresholds into `LuminanceVerdict`: `page.evaluate` serializes its callback, so module references are undefined in browser scope — **every composite gate run since `5a158156` skipped** (honestly logged). Fix: inline rec601 luma + thresholds in the callback, with a drift-guard assertion pinning the inlined values to the module constants. Live proof: the Tide Pool measure above is the first real gate measurement since the regression. 813 composition tests green; typecheck/build clean.

Doctrine: a `page.evaluate` callback is a serialization boundary — module closures are silently undefined there; inline + drift-guard, and treat gate "skipped" logs as alerts.
