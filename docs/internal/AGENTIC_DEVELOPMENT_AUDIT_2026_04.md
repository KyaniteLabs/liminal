# Agentic Development Audit, April 2026

**Date:** 2026-04-17  
**Branch:** `fix/marketing-readiness-proof-gates`  
**Baseline checked:** `main == origin/main` at `038edfe37` before this branch  
**Purpose:** translate the post-completion strategy into repo-specific launch and marketing readiness work.

## Executive Summary

Liminal is architecturally strong, but the latest remote state was not marketing-ready when this audit began. The primary Bubble Tea launch path contained committed merge-conflict markers in `scripts/start-bubbletea-tui.mjs`, full Vitest was red, and docs overstated readiness relative to current proof.

This branch fixed the launch-path syntax failure, restored Bubble Tea Go compilation, added a regression test so launcher conflict markers are caught, and stabilized the full Vitest run. This does not make Liminal launch-ready by itself. It changes the status from "primary launcher cannot parse and full suite is red" to "candidate branch has a green full-suite gate and an explicit remaining proof queue."

## Current Evidence

Latest remote grounding before changes:

- `git fetch --all --prune --tags`: completed.
- `git status --short --branch`: clean `main...origin/main`.
- `git rev-list --left-right --count main...origin/main`: `0 0`.
- Latest base commit: `038edfe37`.

Initial audit findings on latest `main`:

- `node --check scripts/start-bubbletea-tui.mjs`: failed on `<<<<<<< HEAD`.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec eslint src/ --no-cache`: passed with 94 warnings.
- `pnpm exec vitest run --coverage=false`: failed 9 files / 19 tests; 522 files and 9387 tests passed.
- `pnpm check:orphans`: failed with 28 likely-unwired source files.

Focused branch verification after the first fix:

- `pnpm build`: passed.
- `node --check scripts/start-bubbletea-tui.mjs`: passed.
- `pnpm exec vitest run test/scripts/bubbletea-launcher.test.ts test/unit/tui-bridge/BridgeLauncherConfig.test.ts test/unit/tui-bridge/TuiBridgeServer.test.ts --coverage=false`: 3 files passed, 8 tests passed.
- `cd bubbletea && go test ./...`: passed.
- Bridge-only smoke on localhost `/health`: returned `{ "status": "ok", "bridge": "liminal-tui" }`.

Branch verification after test-stability fixes:

- `pnpm build`: passed.
- `pnpm exec vitest run --coverage=false`: passed, 531 files passed, 9387 tests passed, 12 files skipped.
- Remaining verification noise: jsdom prints missing `HTMLCanvasElement.getContext()` / `toDataURL()` messages and the audio path prints `Recording... Press ENTER to stop.` These are not failing tests, but they make proof logs less operator-friendly and should be cleaned up before marketing capture.

## What Would Get Yelled At

- **False readiness drift:** older docs say the system is ready, but current full tests and launch path evidence contradicted that.
- **Committed conflict markers:** this is a basic professional hygiene failure and especially damaging because it was in the marketing/operator launch path.
- **Proof surfaces were brittle:** render/scoring, emergence hooks, guardrails, and audio/aesthetic tests are close to the public claims, so timeout-only failures and leaked global stubs needed to be treated as launch-readiness defects.
- **Horizontal sprawl:** many domains, scripts, docs, and compatibility names exist at once, including stale Remotion/Revideo language.
- **Unwired modules:** the orphan smoke check reports 28 likely-unwired files. Some may be false positives, but each needs an explicit disposition.
- **Silent success risk:** `return null`, warning-only failures, and timeout-based tests make it too easy for a run to look successful without proof.
- **Script surface outside typecheck:** JavaScript and Go launch surfaces need their own gates because TypeScript passing was not enough.

## What Was Done Right

- **Architecture direction is coherent:** harness, ledger, evaluation fabric, LiminalFS, Bubble Tea bridge, dogfood scripts, and proof flows all point toward self-improving creative software.
- **Verification culture exists:** the project already has thousands of tests and dogfood scripts; the problem is not absence of testing, but unreliable proof selection.
- **Agent orchestration created real leverage:** the codebase reflects product direction, research synthesis, dogfood learning, and multi-agent coordination, not random code dumping.
- **You identified the real marketing bar:** recording usage and self-dogfood proof matters more than claiming architectural sophistication.
- **Provider/model role thinking is strong:** harness, generator, evaluator, and local/cloud roles are being treated as different jobs, which is the right mental model.

## Launch-Blocker Queue

P0 until disproven:

1. Full Bubble Tea launch must work from `pnpm run tui` with the configured provider.
2. Full proof-path tests must stay green in repeated runs, not just one lucky run.
3. Three proof flows must produce persisted evidence: creative copilot, emergence garden, self-improvement.
4. Documentation must stop saying "ready" where current evidence says "candidate."
5. Any UI "success" state must include verification evidence or an explicit "unverified" label.

P1:

1. Classify the 28 orphan smoke findings as `wire`, `future`, `test-only`, `false-positive`, or `delete`.
2. Audit stale Remotion/Revideo naming and public docs before marketing.
3. Remove noisy jsdom canvas and recording prompts from automated verification output.
4. Replace any remaining long-running timeout tests with deterministic assertions or explicit environment skips.

## Design And Color Theory Constraint

Liminal has a music theory engine. It must also have a design/color theory engine for launch, but it must not encode proprietary artist styles or scrape living artists' work into prompts.

Allowed source material:

- public-domain and textbook color theory,
- academic design principles,
- perceptual color models and accessibility contrast guidance,
- composition fundamentals such as balance, rhythm, hierarchy, proportion, gestalt grouping, and figure/ground,
- open standards and documented formulas.

Disallowed source material:

- named living artist imitation packs,
- proprietary brand systems,
- copyrighted course material copied into prompts,
- style rules framed as "make it like Artist X",
- prompt templates that smuggle protected work through examples.

Implementation direction:

- Add a `ColorTheoryEngine` / `DesignTheoryEngine` launch-scope module parallel in spirit to the music theory engine.
- Keep it principle-based, source-attributed, and testable.
- Expose neutral vocabulary to generators and evaluators: palette harmony, contrast, hierarchy, visual rhythm, spatial balance, density, and accessibility.
- Defer broad component renaming until after launch proof gates are stable.

## Next Implementation Slices

1. Make `pnpm run tui:bridge` and `pnpm run tui` reliable enough for manual recording.
2. Remove noisy test output so proof logs are readable for launch review.
3. Create a machine-readable proof bundle shape for canonical demos.
4. Generate the first honest marketing-readiness scorecard from actual runs.
5. Draft a naming glossary after proof gates pass, not before.
