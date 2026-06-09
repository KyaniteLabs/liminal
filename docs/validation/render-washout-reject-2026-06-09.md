# Render-Luminance Washout Reject — 2026-06-09

Deterministic fix for the hydra washout class handed off from PR #636
(`docs/validation/visual-quality-depth-2026-06-09.md`). Branch `fix/render-washout-reject`.

## Why this lives in the render path, not the generator
Worker U proved that generator-side prompt-tuning does **not** reliably stop hydra washout — objective
mean render luminance ranged **0.32–0.99** across prompt variants (majority ≥0.8 = washed). Washout is
a property of the **rendered image** (osc/colour/blend luminance), which the generator cannot measure
at codegen time. So the reliable clamp must act on the rendered PNG — in the gauntlet render path,
which already does the inverse (a too-**dark** reject, #616).

## The fix
- `scripts/quality/luminance.mjs`: added `WASHOUT_LUMINANCE_THRESHOLD = 0.85` (calibrated: washed
  hydra renders measured 0.89–0.99; acceptable renders 0.32–0.68) and `isWashedOut(mean)`. Mirrors the
  existing `DARK_LUMINANCE_THRESHOLD`.
- `scripts/domains/gauntlet.mjs` `renderToPng`: after computing mean luminance (same per-pixel
  `relativeLuminance` pipeline as the too-dark check), a render with `mean > WASHOUT_LUMINANCE_THRESHOLD`
  pushes a `Render is washed out / too bright (...)` error and sets a `washedOut` flag → the render
  check FAILs (so a washed render can no longer falsely PASS).
- `runDomain`: a washed PNG render is **regenerated** with a fresh patch (`bypassCache`) up to
  `WASHOUT_REGEN_ATTEMPTS = 3` total attempts, since washout is intermittent and a re-gen usually
  renders with normal exposure. Only washout is retried — validation/compile/blank/too-dark failures
  are deterministic and are **not** masked by the retry.

## Verification
- Unit: `test/unit/quality/luminance.test.ts` — threshold = 0.85; `isWashedOut` flags 0.89/0.99,
  passes 0.32/0.47/0.68, boundary at 0.85.
- Calibration (real renders through the gauntlet's exact sharp pipeline): washed renders →
  `0.943`/`0.992` → `isWashedOut=true`; the acceptable render → `0.417` → `isWashedOut=false`.
- Live (`node scripts/domains/gauntlet.mjs --domain hydra`, ×3):
  - Run 1: washed (attempt 1) → "render washed out, regenerating (2/3)" → washed → (3/3) → washed →
    **FAIL** `Render is washed out / too bright (mean luminance: 0.943)`.
  - Run 2: **PASS** on the first attempt with a non-washed render (luminance 0.417).
  - Run 3: washed ×3 → **FAIL** `... (mean luminance: 0.992)`.
  The PASS render (0.417), inspected by eye, is genuinely non-washed: a rich copper/orange voronoi
  field with **deep blue/dark shadow regions** and warm highlights — real contrast, not a white field.
- `node --check` on both edited .mjs files: OK. Luminance unit test 8/8.

## Honest note
Hydra's *generation* washes out very frequently (most gens — 2 of 3 runs failed even after 3 regen
attempts). The reject does exactly its job: it stops washed renders from **falsely passing**, gives a
regen chance, and guarantees that a **PASS render is non-washed**. It does NOT (and should not) force
hydra to always pass — the high underlying washout rate is a separate generator-quality problem that
this render-side clamp now surfaces honestly instead of hiding.

## Scope
Render path only: `scripts/domains/gauntlet.mjs` + `scripts/quality/luminance.mjs` + the luminance
test. Applies to all PNG-render domains (hydra is the known offender; glsl/three get the same guard
for free). No generator/validator changes.
