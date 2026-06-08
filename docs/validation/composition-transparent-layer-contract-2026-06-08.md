# Composition Transparent-Layer Contract — Seam Class Fix — 2026-06-08

**Fixes the composition layer-seam class at its real (generation-side) source**, per the #617
investigation (`composition-seam-investigation-2026-06-08.md`). Branch:
`feat/composition-transparent-layer-contract` (isolated worktree).

## Root cause (from #617)
The showpiece seam was NOT an engine bug — layers composite correctly. A **foreground** layer (the
showpiece's z3 p5 sketch) painted an **opaque full-stage two-tone sky** (a manual vertical gradient:
a per-row loop of `rect(0, y, width, 1)` strips plus `line(0, height*0.25, width, …)` at the exact
seam boundary). Its blend then surfaced that hard band as the composite seam. Only the base layer
should own an opaque full-stage background.

## The fix (durable, whole-class) — `src/composition/LayerContract.ts`
1. **Contract (prompt):** every NON-base layer's generation prompt gets `FOREGROUND_TRANSPARENCY_CONTRACT`
   + a domain hint ("draw only your subject on a FULLY TRANSPARENT canvas; p5 → `clear()` not
   `background()`; shader → alpha 0 / discard; three → `setClearColor(c, 0)`"). The base layer (z=1)
   is untouched (it may render opaque). Wired in `CompositionOrchestrator.generateLayer` (base =
   index 0).
2. **Guard (deterministic):** `paintsOpaqueBackground(code, domain)` flags a foreground layer that
   violates the contract — opaque p5 `background()` (1 or 3 args, no alpha) OR full-width horizontal
   bands (`rect(0, y, width, …)` / `line(0, y, width, …)`, i.e. a manual gradient background — the
   exact showpiece technique). Recorded as `ComposedLayer.opaqueBackground` + a `Logger.warn`. Non-p5
   foreground opacity isn't reliably detectable from source, so the guard returns false there (the
   prompt contract still applies) — stated honestly, not faked.

## Verification

**Deterministic (unit, 22 cases — `LayerContract.test.ts` + `composition-orchestrator.test.ts`):**
contract applied to foreground but NOT base; orchestrator passes the contract'd prompt to foreground
generators only; guard flags opaque `background()`, full-canvas rect, and the gradient-strip technique,
and passes a sparse `clear()`-based foreground.

**Deterministic on the REAL artifacts:**
- Baseline showpiece's seam-causing p5 layer → `paintsOpaqueBackground = true` ✓ (the guard catches
  the exact defect — it uses `rect(0, y, width, 1)` gradient strips + `line(0, height*0.25, width…)`).
- New contract-built p5 foreground → `paintsOpaqueBackground = false`, **uses `clear()` = true**,
  opaque `background()` = false ✓.

**Live end-to-end (no fake fallback — real GLM/MiniMax):** `sinter compose --prompt "a vast indigo
glacier cavern lit by drifting turquoise will-o-wisps with slow falling frost glints in the
foreground"` (never-before-used). Decomposed to 4 layers (three base / shader screen 0.9 / **p5
foreground screen** / strudel audio); **no contract-violation warning fired** → the foreground was
generated transparent. Rendered via `quality:render-gallery`.

**Before / after (vision-graded by me):**
- BEFORE — `gallery/2026-06-07--tundra-aurora-resonance`: hard horizontal **seam** at ~y=100 (dark
  star band → teal aurora).
- AFTER — `gallery/2026-06-08--indigo-glacier-cavern-with-drifting-will`: **NO seam** — the composite
  is uniform, the foreground p5 layer is transparent (sparse glints), no hard band.
  (PNGs in `.quality/renders/gallery/` — gitignored, inspected directly.)

## Honest caveat (separate issue, NOT the seam, NOT fixed here)
The AFTER render is **washed out / near-white** — caused by two stacked `screen` blends (decomposer's
blend choice) plus a p5 **color error in one layer** (`[object Arguments] is not a valid color`), an
LLM codegen quirk. This is unrelated to the seam and not introduced by the contract (which only adds
transparency instructions). Surfacing it as a follow-up: the decomposer should avoid stacking multiple
`screen` layers of bright content, and layer codegen should be validated. The seam — this task's scope
— is eliminated.

## Gates
`pnpm build` 0 TS errors · `pnpm lint` clean · `test/unit/composition/` 779/779 · `pnpm test:quality`
0 new warnings · live compose ran on real providers · before/after renders inspected directly.

## In-lane / out-of-lane
Touched only `src/composition/` (new `LayerContract.ts`, wired into `CompositionOrchestrator.ts`) + its
tests. Did NOT touch `CodeValidator`/`detectDomain` (Codex's Strudel lane).
