# Handoff 11 — Archive dead-frame hygiene + rendered-score cap wiring trace

**Mode:** Investigate + fix. You may edit `src/core/RalphLoop.ts` (wiring only), add tests, and write a remediation script under `scripts/quality/`. Archive data may ONLY be mutated through `QualityArchive`/`ArchiveLearning` class methods (hard rule — hand-editing the JSON destroyed the archive once already).

## Purpose

The 2026-06-11 movement audit found **two near-black glsl frames in the quality archive scored 0.85** (`gls_62c94740`, `gls_2f06d51b`, created 03:10–03:11Z): measured meanLuminance 0.099, brightFraction 0, brightnessStd ~4 — vision-confirmed dead frames. They were generated while H06's too-dark cap (×0.6) was live, and `0.85` is impossible post-cap — **the cap did not affect archive admission**. These entries now feed score-gap taste training as winners.

## Part A — wiring trace (do this first; it decides Part B's scope)

`scoreRenderedEvidence` is called at `src/core/RalphLoop.ts:704` and `:905` (result: `genEval`). Archive admission happens at `:1355` (`archiveLearning.addOutput(...)`) with quality scores drawn from `evaluation.score` (`:1441`) / `bestScore|finalScore` (`:1719`). Determine:

1. Does `genEval` (the capped score) ever flow into the score used at `:1355`/`:1441`/`:1719`, or is admission fed by an uncapped evaluator channel?
2. Did the render measurement even execute for these gens (check whether the daemon flow captures a screenshot — no screenshot ⇒ no measure ⇒ no cap)?

Fix the wiring so the capped score is the one archived (smallest change; if the rendered-evidence path legitimately doesn't run in some flows, the archive entry must record that no render proof existed).

## Part B — retroactive archive hygiene

Write `scripts/quality/archive-measure.mjs` (base it on `.quality/f19-calibrate.mjs`): render + measure EVERY visual-domain archive entry, list entries whose measure is dead (brightFraction = 0 AND meanLuminance ≤ 0.12 AND brightnessStd < 5), and quarantine them **via class methods** (down-score or remove — prefer whatever `QualityArchive` supports without schema changes). Known expected hits: the two glsl IDs above. Print a before/after per-domain count table.

## Verification

```bash
pnpm typecheck && pnpm exec vitest run test/unit/core --coverage.enabled=false
node scripts/quality/archive-measure.mjs --dry-run   # table first
# after applying: re-load the archive WITH THE CLASS and confirm counts + that taste training still runs:
node bin/sinter preferences train
```

## What not to touch

`LuminanceVerdict.ts` thresholds (freshly calibrated in 5a158156 — if you believe a threshold is wrong, report with render evidence instead of tuning), `~/.sinter` files directly, the daemon scripts.

## Final report format

```
WIRING: <which channel feeds admission + the fix diff>
MEASURE TABLE: <dead-frame list>
QUARANTINED: <ids + method used>
POST-CHECK: <preferences train output + archive counts>
```

Stop and ask if Part A reveals the cap is wired correctly and the explanation is render variance at the 0.1 knife-edge — that becomes a threshold/hysteresis question for a calibration follow-up, not a wiring fix.
