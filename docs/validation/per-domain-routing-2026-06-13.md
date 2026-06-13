# Per-domain Generator Routing — Evidence Review (Phase 4.G1)

> Diagnose-and-fix campaign, Phase 4.G1. The handoff: *"Extend the `three → MiniMax-M3`
> pattern to other domains ONLY where the judge-calibration matrix shows a better generator.
> Don't guess — get the per-domain-winner evidence first."* This is that evidence review.

## Current state (verified live)

`three → MiniMax-M3` is the only per-domain generator route, and it is **live**:
- `scripts/quality/self-improve-cycle.mjs:134` — `domain === 'three' ? ' --provider minimax --model MiniMax-M3' : ''`, which the self-improve daemon runs every cycle.
- Plumbed end-to-end: `bin/sinter` parses `--provider`/`--model` (lines 260/262) → sets `LIMINAL_LLM_*` env → `getEffectiveConfig` honors it for the **generator** role. The **evaluator** stays GLM (role config outranks env in the `LLMClient` constructor), so judging is unaffected.

## The evidence (memory `prompt-tiering-and-judge-calibration`, 2026-06-12 judge-swap matrix)

| Generator | Domain(s) tested | Verdict |
|---|---|---|
| **MiniMax-M3** | three | **WINS** — lanes C/D: both M3 scenes (cathedral B+/A-, orrery A-/A by Fable control) beat every GLM `three` compositionally. **Routed.** |
| MiniMax-M3 | (other domains) | No evidence it beats GLM anywhere but `three`. |
| **DeepSeek v4 Flash** | hydra (gated) | **FAILS** — brightness 0.3 then 0.5 vs the 0.75–0.95 contract; weak constraint-following. "Not for gated domains." |
| **DeepSeek v4 Pro** | hydra (gated) | **FAILS** — white washout (honest 0.00) then static-gated. DeepSeek v4 = **judge-tier only**. |
| GLM (default) | all others | Obeys numeric contracts (e.g. hydra brightness floor); the safe default. `hydra generator stays GLM`. |

No committed validation data (`docs/validation/*calibration*`, `prompt-audit-2026-06.md`) contradicts this — none establishes a better-than-GLM generator for `p5`, `glsl`, `svg`, `ascii`, `kinetic`, `hydra`, or `textgen`.

## Conclusion

**The per-domain generator routing is evidence-complete.** The single proven win (`three → M3`)
is already routed; every other domain's best-evidenced generator is the GLM default, and the only
other generator actually measured (DeepSeek v4) *failed* as a generator. Adding routes for other
domains would be guessing, which the handoff explicitly forbids. **No code change is warranted.**

## Future unlock (recommended, not run here)

More routing needs *new* evidence, not a guess: a deliberate **per-domain generator-calibration
matrix** — N novel prompts × candidate generators (GLM / M3 / others) × each visual domain, graded
against a Fable visual control, using `.quality/variance-study.mjs` for seeded/deterministic frames
(the judge-swap matrix flagged ±0.3 render variance as a confound, so seeded evidence is the
methodology fix). This is an inference-heavy experiment scoped separately from this campaign — run it
deliberately with a token budget, not speculatively. The new weekly **rescore cadence** (Phase 4.G2)
surfaces stale-score drift that can re-trigger this when a domain's tops fall below the quality bar.

## Verification

- `three → M3` route present + flags plumbed: confirmed by inspection (`self-improve-cycle.mjs:134`,
  `bin/sinter:260,262`).
- Evaluator unaffected (stays GLM): role config outranks env, per the routing comment's own note.
