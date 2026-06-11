# Design — Single-generation render measurement (F12 hydra washout + F19 p5 contrast, the #637 lane)

**Status:** Fable design, 2026-06-10. Implementation = Handoff 06.

## Problem

The two worst visual grades (hydra D, p5 C+) are washout and pale-on-pale contrast. Generation-side fixes are settled dead ends (memory: near-identical code diverges 0.82 vs 0.44; prompt mandates don't move measurements). #694 shipped objective, measured gating — but only for composites. Single generations still rely entirely on the evaluator LLM's vision judgment, which is subjective and unavailable in honest-degraded mode.

## Discovery that shapes the design

The single-gen pipeline ALREADY has every ingredient; they're just not connected:

| Ingredient | Where it exists today |
|---|---|
| Headless render + screenshot per iteration | `src/render/HeadlessRenderer.ts` (`RenderResult.screenshot`, base64 + dims) |
| Pixel decode + stats (`visibleRatio`, `uniqueColors`, `brightnessStd`) | `src/render/DecodedImageVisibility.ts` (sharp-optional, graceful null) |
| Calibrated luminance verdicts (washout ≥0.8 mean; DARK <0.12) | `src/composition/CompositeRenderGate.ts` (`CompositeMeasure`, `verdictFromMeasure`) |
| A consumer in the loop | `src/perception/RenderEvidencePerception.ts` → `ScoringEngine.scoreRenderedEvidence` |
| An actuator | RalphLoop already iterates on low scores — no new control flow needed |

**The defect in one line:** `RenderEvidencePerception.ts:27-28` decodes the full pixel analysis and then returns only `visibility.hasVisibleContent` — the washout/contrast signal is computed and discarded.

## Design

1. **Extend the decoded stats, don't add a render.** `analyzeDecodedPixels` (DecodedImageVisibility) additionally returns `meanLuminance`, `brightFraction`, `darkFraction` using the exact formulas/constants from `CompositeRenderGate` (0.299R+0.587G+0.114B; bright >0.5; dark <0.12). Zero extra renders, zero extra puppeteer time.
2. **One shared verdict module.** Extract the thresholds + `verdictFromMeasure` from `CompositeRenderGate` into a shared `src/render/LuminanceVerdict.ts`; add one new verdict `low-contrast` (mid/high mean luminance AND `brightnessStd` below a calibrated floor — this is the F19 signal; std is already computed). CompositeRenderGate imports from it; thresholds stay defined once.
3. **Deterministic score consequence.** In `scoreRenderedEvidence`: non-`ok` verdict ⇒ cap the technical/aesthetic score contribution (suggested: multiply by 0.6, floor information preserved in feedback) AND append a concrete repair line to the score feedback ("rendered frame measured washed out: mean luminance 0.87 — reduce additive brightness / raise contrast"). The existing iterate-on-low-score loop is the actuator; honest-degraded mode (evaluator offline) now still penalizes measured washout — strictly better than today.
4. **Evidence to the vision judge.** Append the measured numbers to the evaluator user prompt (one line). Helps calibration; costs nothing.
5. **Persist the measure** on the QualityArchive entry (small object). Audits stop re-deriving it, and it becomes a future taste-model feature.
6. **Sharp-missing behavior:** measurement skipped ⇒ no penalty, no verdict (today's behavior). Never block on the optional dep.

## Calibration (worker task, evidence-driven)

`low-contrast` floor must be calibrated against real graded renders before enforcement: run the measurement over the existing `.quality/` render gallery; the pale p5 (C+) and washed hydra (D) artifacts must trip, the A-grade shader/hyperframes must not. Ship the thresholds with that table in the PR description. If separation is poor, ship `washout`/`too-dark` only and leave `low-contrast` behind an env flag (`SINTER_CONTRAST_VERDICT=1`).

## Explicitly out of scope

- Re-render/retry inside the gate (composites demote blends; single-gen has no equivalent — the Ralph iteration IS the retry).
- Any generation-side prompt/clamp changes (settled dead end).
- Strudel/audio domains (no screenshot semantics).

## Risk notes

- Score caps interact with the archive admission bar and the daemon's score-gap taste feed; capped scores produce *more* score-gap training pairs labeling washed work as losers — that is the desired direction, but the calibration table must keep false-positive caps rare (<1 in 10 on the current gallery).
- `LIMINAL_RENDERED_SCORE_TIMEOUT_MS` (45s bound from #683) is unaffected: measurement happens on the already-captured buffer, outside the LLM call.
