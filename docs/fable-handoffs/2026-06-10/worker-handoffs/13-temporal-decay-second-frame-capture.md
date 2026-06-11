# Handoff 13 — Temporal decay: second-frame capture in render evidence

**Mode:** You may edit `src/render/HeadlessRenderer.ts`, `src/perception/RenderEvidencePerception.ts`, `src/core/types/GenerationEvaluation.ts` (additive fields only), and tests. Do NOT touch `src/core/RalphLoop.ts` or archive code (Handoff 11's worker owns that lane until it reports).

## Purpose

FAB-020's real cause: two animated glsl shaders measured healthy at capture (`lum 0.51, brightF 0.81`) but decay to black within seconds — the archive admitted dead art with honest-looking evidence. One screenshot is a single sample of a time-varying signal; decayed/frozen animations are invisible to it.

## Design (decided; implement as specified)

1. **Capture a second screenshot late in the render window** (existing capture stays at its current moment; add one more at the END of the render wait, ≥1.5s after the first — reuse the page that is already open; cost is one extra `page.screenshot`, no extra browser/page).
2. `RenderEvidence` gains optional `lateScreenshot` (same shape as `screenshot`) — additive, no consumer breaks.
3. `measureRenderEvidence` (RenderEvidencePerception) computes the measure for BOTH frames when `lateScreenshot` exists. Decision rule: **the late frame is authoritative** — it is the steady state a viewer actually sees. Its measure is the stored one. Set `temporalDecay: true` (additive boolean on `RenderMeasure`) when the late verdict is non-`ok` but the first frame's was `ok` (decay shape). This also fixes the inverse loading-flash false-negative: a solid first frame with a healthy late frame now measures healthy.
4. The evaluator prompt line in `ScoringEngine` (the existing measured-numbers line) appends `decays-after-capture` when `temporalDecay` is true — no new prompt engineering beyond that token.
5. Audio/video domains unaffected (screenshot path only).

## Tests (red-green)

- Fixture pair A: first frame varied, late frame solid-black → measure = late frame's, `temporalDecay: true`, verdict `too-dark` (reuse the sharp PNG helpers in `test/unit/perception/render-evidence-perception.test.ts`).
- Fixture pair B: first frame solid (loading flash), late frame varied → measure = LATE frame's (`ok` verdict, healthy luminance), `temporalDecay` absent/false — the warm-up no longer penalizes.
- No `lateScreenshot` → behavior byte-identical to today (regression guard on an existing fixture).

## Verification

```bash
pnpm typecheck
pnpm exec vitest run test/unit/perception test/unit/render --coverage.enabled=false
```

Plus one live probe: generate a known-decaying shader shape (or replay `gls_2f06d51b`'s code from the archive READ-ONLY) through the render path and show the late frame catching the decay.

## What not to touch

RalphLoop, archive classes, LuminanceVerdict thresholds, daemon scripts.

## Final report format

```
DIFF: <stat>
TESTS: <commands + exit codes, pair A/B shown red→green>
LIVE PROBE: <first/late measures for the decaying shader>
```
