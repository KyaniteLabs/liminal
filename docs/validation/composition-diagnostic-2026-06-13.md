# Composition Pipeline Diagnostic — 2026-06-13 (Phase 3.E)

> Diagnose-and-fix campaign, Phase 3.E. Verifies the end-to-end composition pipeline
> (`CompositionOrchestrator.composeFromPrompt`, wired at `bin/sinter` `compose`) on
> **3 novel multi-domain prompts**, grading each composite's rendered frame for
> **luminance + seam**. LayerContract (#619) and CompositeRenderGate (#43/#694) are live.

## Method

- Command: `sinter compose --prompt "<novel idea>" -o <dir>`
- Generation: MiniMax-M3 decomposer + per-domain generators (GLM/MiniMax — compliant roster).
- Grading: the built-in `CompositeRenderGate` measures the **assembled, headless-Chrome-rendered**
  composite (mean luminance + brightness spread/`brightnessStd`); `LayerContract`'s
  `paintsOpaqueBackground` guard flags any foreground layer that paints an opaque full-canvas
  background (a seam risk). This PR surfaces that grade in the `compose` CLI output (it was
  computed but previously hidden).
- Prompts were never-before-used (cache-mask rule).

## Results

| # | Prompt (abbrev) | Layers (domain·blend·opacity) | Composed | Render-gate verdict | Mean luminance | Spread | Seam |
|---|---|---|---|---|---|---|---|
| 1 | derelict lighthouse · phosphorescent kelp · sonar | shader·normal·1, three·screen·0.95, p5·lighten·0.41, strudel | 4/4 | **MUDDY** (remediation reverted) | 0.234 | 11.4 | none |
| 2 | origami cranes · brass orrery · synth chimes | shader·screen·0.85, ascii·lighten·0.53, strudel; (three layer self-rejected) | 3/4 | OK | 0.111 | 32.5 | none |
| 3 | sandstorm · art-deco station · hieroglyphic glyphs · dub bass | shader·normal·1, ascii·screen·0.55, tone | 3/3 | OK | 0.007 | 12.5 | none |

Artifacts: `composition.html` 40.6 KB / 28.4 KB / 65.3 KB respectively — all real, multi-layer, with canvas + inlined layer scripts.

## What works (the question Phase 3.E answers)

- **The pipeline is functional end-to-end.** All 3 novel prompts decomposed into a multi-domain
  layer spec, generated each layer through the real domain generators, assembled one standalone
  composite HTML, render-measured it, and persisted it to the gallery + a self-improvement episode.
- **LayerContract held on all 3** — zero `paintsOpaqueBackground` seam flags. The transparent-layer
  contract (#619) is doing its job: no foreground layer stomped the base with an opaque background.
  The original "composition seam" class (hard intra-layer bands) did **not** recur.
- **Per-layer dark-background validation fired correctly** (#2): the `three` layer self-rejected its
  own `0x0a0608` clear color as "too dark for image proof" — the per-domain contract caught it before
  it entered the composite. The system protecting itself, not a pipeline break.

## What's weak (generation-side, → sub-plan, NOT fixed in this PR)

1. **Composites trend dark.** All 3 sampled means are low (0.007 / 0.111 / 0.234). #1 measured
   **muddy** and the gate's blend-demotion remediation could not lift it (reverted to original).
   This is the same *generation-side* darkness tendency the hydra/shader memory documents — the base
   shader/three layers render dark, and additive blends don't reliably recover a viewable frame.
2. **The render gate permits near-black by design.** #3 measured **luminance 0.007** (essentially
   black) yet verdicted **OK**, because `verdictFromMeasure` flags *washout* (too bright) and *mud*
   (mid-gray + low spread) but deliberately allows *dark-with-contrast* frames (spread 12.5) to avoid
   crushing legitimate night scenes (the documented hydra-washout tradeoff). 0.007 is at the extreme
   edge of that tradeoff — a near-black composite passing OK is worth a threshold review.

### Recommendation (pre-declared sub-plan, per the campaign's fix-or-spawn posture)

The weakness is a **generation-side darkness class + a gate too-dark-floor question**, exactly the
LayerContract-saga territory the plan says to *spawn*, not promise an in-PR fix for. Proposed sub-plan:

- **Craft-contract for composite base layers**: bias the decomposer/base-layer prompt toward a
  mid-tone or accented base (the per-domain dark-bg validator already exists for `three`; extend the
  same "viewable luminance" contract to shader/p5 bases used as composite layer 0).
- **Gate floor review**: decide whether `CompositeRenderGate` should add a hard near-black floor
  (e.g. mean < 0.03 ⇒ `too-dark` regardless of spread) — a taste/threshold call (cf. G3).
- Re-measure with the seeded reliability harness once a contract lands; this doc is the baseline.

## Verdict

Composition pipeline: **functional and seam-free** (LayerContract working). Composite *brightness*
is the open quality axis — a generation-side darkness tendency, tracked here as a sub-plan, not a
compositing-engine defect.
