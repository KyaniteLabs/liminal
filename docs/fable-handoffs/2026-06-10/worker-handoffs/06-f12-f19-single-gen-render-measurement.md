# Handoff 06 — F12+F19: wire objective render measurement into single-generation scoring

**Mode:** You may edit code + tests. Isolated worktree branch. Implements the Fable design at `docs/fable-handoffs/2026-06-10/render-measure-lane-design.md` — read it first; it is the contract.

## Purpose

Single generations compute pixel stats from their rendered screenshot and then throw them away (`src/perception/RenderEvidencePerception.ts:27-28` keeps only `hasVisibleContent`). Connect the existing stats to scoring so measured washout (F12, hydra) and low contrast (F19, p5) deterministically lower scores and drive Ralph iterations — including when the evaluator LLM is offline.

## Exact files

1. `src/render/LuminanceVerdict.ts` (NEW — extracted thresholds + `verdictFromMeasure` from `src/composition/CompositeRenderGate.ts`, plus the new `low-contrast` verdict). CompositeRenderGate must import from it afterward (no duplicated constants).
2. `src/render/DecodedImageVisibility.ts` — `analyzeDecodedPixels` additionally returns `meanLuminance`, `brightFraction`, `darkFraction` (formulas per design §1).
3. `src/perception/RenderEvidencePerception.ts` — surface the full measure, not just the boolean.
4. `src/core/ScoringEngine.ts` (`scoreRenderedEvidence`) — score cap ×0.6 on non-ok verdict + repair feedback line + measured numbers appended to the evaluator prompt (design §3-4).
5. Archive entry persistence of the measure (design §5) — find the admission site in QualityArchive's caller; smallest field addition that survives `ArchiveDataSchema` (do NOT hand-edit `~/.sinter` data files; mutate through the class).
6. Tests: unit tests for the verdict math (exact threshold boundary values), one ScoringEngine test proving a washout measure caps the score and an `ok` measure does not, one test proving sharp-missing ⇒ no penalty.

## Calibration gate (required evidence)

Run the new measurement over the existing `.quality/` render gallery and produce the table from design §Calibration: washed hydra + pale p5 must trip; A-grade shader/hyperframes must not. If `low-contrast` separation is poor, gate it behind `SINTER_CONTRAST_VERDICT=1` and ship washout/too-dark only.

## Exact commands

```bash
pnpm typecheck && pnpm lint
pnpm exec vitest run test/unit/render test/unit/core --coverage.enabled=false   # plus your new test files explicitly
pnpm exec vitest run test/unit/composition --coverage.enabled=false             # CompositeRenderGate must stay green after the extraction
```

## Definition of done

All commands exit 0; calibration table in the PR body; diff confined to the files above + tests; no change to `CompositeRenderGate` behavior (its tests prove it); no generation-side prompt changes.

## What not to touch

Generator prompts/clamps (settled dead end — see memory rules), `HeadlessRenderer` capture logic, `LIMINAL_RENDERED_SCORE_TIMEOUT_MS` semantics, composite demotion logic, `scripts/quality/*` (Handoff 05 owns harness scripts).

## Final report format

```
DIFF: <stat>
COMMANDS: <each + exit code>
CALIBRATION: <the gallery table>
VERDICT THRESHOLDS SHIPPED: <values + which are env-gated>
```

Stop and ask if: the archive schema change requires a migration, or calibration shows the C+/D artifacts do NOT separate from A-grade ones (that would falsify the design's premise — report, don't force thresholds).
