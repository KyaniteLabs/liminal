# Composition Screen-Blend Washout — Brightness Budget Fix — 2026-06-08

**Fixes the washout class** surfaced by the #619 caveat: live composites came out near-white because
the decomposer puts a `screen`/`lighten` blend on every foreground layer, so a 3-4 layer work stacks
multiple additive layers whose cumulative brightening blows out to white. (Separate from the #619 seam
fix.) Branch: `fix/composition-screen-blend-washout` (isolated worktree). Lane: `src/composition/*` only.

## Root cause
`CompositionOrchestrator.decomposePrompt`'s planner prompt says "foreground detail … with a screen or
lighten blend so it shows through" — so the LLM tends to give EVERY foreground a brightening blend.
Layers composite correctly; the defect is the blend SELECTION stacking too many additive layers.

## The fix — `src/composition/BlendBudget.ts`
- `BLEND_BRIGHTNESS`: per-blend brightening weight (screen 1.0, lighten 0.85, overlay 0.35; normal/
  multiply/darken/difference/exclusion 0). `CUMULATIVE_BRIGHTNESS_BUDGET = 1.3` (≈ one full-strength
  screen layer + small headroom). Audio domains excluded (they render invisibly).
- `cumulativeBrightness(layers)` / `exceedsWashoutBudget(layers)` — deterministic guard.
- `capLayerBrightness(layers)` — walk z-order; keep brightening layers while within budget; for an
  over-budget brightening layer, **reduce its opacity** so its contribution fits the remaining budget,
  **keeping the additive blend**. Wired into `decomposePrompt` (after `parseSpec`), plus a one-line
  planner-prompt clause ("brightening blend on AT MOST ONE foreground layer") as defense-in-depth.

### Why reduce-opacity, not demote-to-normal (caught by verification)
My first approach demoted excess brightening layers to `normal`. The content-controlled A/B render
(below) caught the flaw: demoting to `normal` makes a layer **occlude** everything beneath it if it
isn't transparent (an opaque `three` top layer at opacity 1 blacked the composite out → lum 0.000).
`screen`/`lighten` never occlude (dark pixels stay transparent), so the safe cap is to **scale opacity
down** while keeping the additive blend. Switched to that.

## Verification

**Deterministic (24 unit/integration cases — `BlendBudget.test.ts` + `composition-orchestrator.test.ts`):**
weights/budget; guard flags 3 stacked bright layers and passes a single bright / normal composite;
`capLayerBrightness` keeps the first dominant bright layer, reduces excess bright layers' opacity to
fit budget (blends kept), excludes audio, and never exceeds the budget. `decomposePrompt` with a mock
LLM emitting 4 bright layers → returned spec no longer exceeds the budget (opacities scaled: screen@1,
screen@0.3, lighten@0).

**Live, content-controlled A/B (vision-graded by me — the real proof):** composed a NEW work
(`sinter compose`, never-before-used prompt "a radiant supernova nebula …", real GLM/MiniMax → gallery
`2026-06-08--supernova-nebula-cascade`). Re-composited its **identical** generated layers two ways:
- **BEFORE** (every visual layer `screen@1` — the old decomposer pattern): cumulative brightness 3.0,
  mean luminance **0.943** — washed to near-white, focal nebula blown out (`.quality/renders/ab-before2.png`).
- **AFTER** (my `capLayerBrightness`: `screen@1, screen@0.3, screen@0`): cumulative brightness 1.3,
  mean luminance **0.307** — dark space preserved with a visible central nebula glow, NOT washed
  (`.quality/renders/ab-after2.png`).
Same content, blend-opacity the only variable → isolates the fix.

**Live end-to-end:** the composed supernova work itself rendered un-washed (one screen layer; cap not
needed because the planner-prompt clause led the LLM to a single bright layer this run — the cap is the
deterministic guarantee for when it doesn't).

## Honest scope note
The AFTER composite is properly exposed but its glow is soft/monochrome — a *content-quality* matter
(faint/weak generated layers; one shader retried empty), NOT washout and NOT in this lane. The washout
class — multi-layer composites blowing out to white — is eliminated.

## Gates
`pnpm build` 0 TS · `pnpm lint` clean · `test/unit/composition/` **792/792** · `pnpm test:quality`
0 new warnings · A/B renders inspected directly.

## In-lane
Only `src/composition/` (new `BlendBudget.ts`, wired into `CompositionOrchestrator.ts`) + its tests.
Did NOT touch `CodeValidator`/`detectDomain`, `src/generators` (Worker C's `[object Arguments]`
color-codegen bug), `scripts/*`, `bin/sinter`, or `package.json`.
