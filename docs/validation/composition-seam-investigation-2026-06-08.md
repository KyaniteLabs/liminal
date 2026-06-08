# Composition Layer Seam — Investigation (Unit C) — 2026-06-08

**Outcome: STOP + SURFACE — not a deterministic composition-engine bug.** The seam in the showpiece
`gallery/2026-06-07--tundra-aurora-resonance` is an artifact of **LLM-generated layer content**, not
inter-layer compositing. No engine change made (churning a non-fix is a defect). Branch:
`fix/composition-layer-seam`.

## Premise tested (from the dispatch + prior root-cause note)
"Opaque iframe layers stack with `mix-blend-mode:normal; opacity:1` and no feather, so inter-layer
compositing leaves a hard seam." **Falsified by evidence below.**

## How layers are actually composited
`src/composition/CompositionOrchestrator.assemble()` emits one **full-stage** iframe per layer
(`position:absolute; inset:0; width:100%; height:100%`), stacked by z-index with per-layer
`mix-blend-mode:${blend}; opacity:${opacity}` (CompositionOrchestrator.ts:255-260). Decoding the
showpiece's 4 layers:

| z | domain | blend | opacity | individual render |
|---|--------|-------|---------|-------------------|
| 1 | three | normal | 1.0 | coherent tundra scene (pines/snow/faint aurora) — **no seam** |
| 2 | shader | screen | 0.85 | soft green/purple aurora ribbon on black — **no seam** |
| 3 | p5 | lighten | 0.70 | **two-tone sky: dark-navy top band → light-blue bottom with a HARD horizontal boundary** ← the seam |
| 4 | strudel | (audio) | 0 | invisible |

Per-layer PNGs rendered to `.quality/renders/layer-{0,1,2}-*.png` (gitignored) and **graded by eye**.

## Mechanism
Layers are NOT `normal+opacity:1` hard-stacks — they use `screen`/`lighten`, which correctly make
each layer's dark pixels transparent. The seam comes entirely from **layer 2 (p5)**, whose generated
sketch draws an **opaque two-tone background** (dark navy sky on top, lighter blue below) with a hard
horizontal transition. Under `lighten` (max(base, layer)) at 0.7: the dark-top stays below the base
and reveals the three/shader layers; the light-bottom wins and shows layer 2 — so the composite shows
a hard transition exactly where layer 2's drawn background flips tone (~y=100). A "foreground detail"
layer drew a full opaque sky instead of sparse, transparent detail.

## Why the requested engine fix would not work (and why I did not churn it)
- **Feather/gradient-mask layer boundaries (LayerMask):** layers are full-stage; their only spatial
  boundary is the canvas edge. Feathering edges cannot touch layer 2's *internal* horizontal band.
- **Change blend modes / opacity falloff per layer:** the layers already merge cleanly; the seam is
  intra-layer. There is no deterministic signal at the composition level that "layer 2 has an internal
  seam → pick a different blend." Overriding the LLM's deliberate `lighten`/0.7 choice would be a magic
  heuristic that risks regressing other compositions and violates "don't regress single-layer works."
- Anti-slop bound: I can name the defect (layer 2's opaque two-tone background) but cannot name a
  deterministic, in-lane (`src/composition/*`) fix **plus** a verification that proves it. So it is not
  a fix — skipped.

## Recommendation (the real fix path — out of this lane / future)
The defect is generation-side: composition **foreground/detail layers must draw transparent, sparse
content** (stars/streaks over a transparent canvas), not a full opaque sky that competes with the
background layers. That belongs in the per-domain layer generation prompt (e.g. the p5 generator's
composition-layer mode), **not** in `src/composition/*`, and its verification is vision-graded
re-rendering (LLM, non-deterministic). The decomposer already asks for "detail … shows through"
(CompositionOrchestrator.decomposePrompt) but cannot control what the generated sketch actually draws.
Concrete next step: add a composition-layer generation contract — "transparent background, no
full-canvas fill, sparse foreground only" — for non-base layers, then re-render to confirm by eye.

## Verification of the investigation
`pnpm build` 0 TS errors · no `src/` changed · the four per-layer renders + the baseline composite
render (`.quality/renders/gallery/2026-06-07--tundra-aurora-resonance.png`) were inspected directly.
