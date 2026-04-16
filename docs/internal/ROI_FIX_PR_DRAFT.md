# ROI Fix Branch — Draft PR Notes

Branch: `roi-audit-20260411`

Base commit used for the isolated worktree:
- `9b7d1b89` — Launch Bubble Tea TUI through GLM-backed bridge

## Summary

This branch lands a series of atomic fixes focused on operator trust, routing correctness, and command-surface consistency in the TUI / Bubble Tea / bridge stack, plus low-risk cleanup of stale excluded tests.

## Atomic commits included

1. `7153643c` — Restore clarification before generic p5 generation
2. `7ad65b5f` — Stop unverified mutation tasks from claiming success
3. `f265c939` — Carry Ralph iteration context into dispatched generators
4. `95d3599c` — Align source-of-truth docs with removed harness updater
5. `2f6be8b4` — Preserve bridge-requested domains in Ralph generation
6. `a03a445a` — Align NaturalInterface help with supported commands
7. `f8a220e0` — Execute confirmed bridge preview actions after approval
8. `b3c9d57c` — Let Bubble Tea bridge use the active configured provider
9. `3cd7a830` — Execute confirmed bridge run actions after approval
10. `44d6950e` — Execute confirmed bridge agent actions after approval
11. `cff8c178` — Delete stale conflicted pending generator tests
12. `489eb2b9` — Route explicit `/agent` through NaturalInterface
13. `59216ca4` — Add browser and audio commands to NaturalInterface
14. `c1941513` — Add confirm and cancel to NaturalInterface

## High-level outcomes

- ambiguous prompts are no longer masked by a generic p5 fallback
- mutation-task success now requires real verification evidence
- Ralph iteration context reaches dispatched generators
- bridge generation preserves requested domains instead of hardcoding p5
- confirmed bridge actions now execute for:
  - `/preview`
  - `/browser`
  - `/play`
  - `/run`
  - `/agent`
- Bubble Tea bridge startup now follows the active configured provider instead of assuming GLM
- NaturalInterface explicit command surface now supports:
  - `/run`
  - `/agent`
  - `/preview`
  - `/play`
  - `/stop`
  - `/browser`
  - `/confirm`
  - `/cancel`
- stale excluded pending generator tests with merge-conflict markers were removed
- source-of-truth docs were reconciled with current behavior

## Fresh verification evidence

Focused suites and checks that passed during the lane:

- `test/tui-bridge/tui-bridge-service.test.ts`
- `test/unit/tui/NaturalInterface.test.ts`
- `test/unit/harness/MultiProviderConfig.test.ts`
- `test/unit/tui-bridge/BridgeLauncherConfig.test.ts`
- `test/unit/LLMModeAgent.test.ts`
- `test/unit/core/GenerationOrchestrator.test.ts`
- `test/unit/generators/registerGenerators.test.ts`
- `test/unit/generators/confidence-functions.test.ts`
- `node --check scripts/start-bubbletea-tui.mjs`
- LSP / project TypeScript diagnostics reported 0 errors on the isolated branch

Most recent combined regression sweep:
- `vitest run --run test/tui-bridge/tui-bridge-service.test.ts test/unit/tui/NaturalInterface.test.ts test/unit/harness/MultiProviderConfig.test.ts test/unit/tui-bridge/BridgeLauncherConfig.test.ts`
- result: **4 files passed, 101 tests passed**

## Known gaps / honest notes

- Some full-repo test suites are environment-dependent and noisy under concurrent agent activity.
- A full `npm test` run in this environment still includes unrelated pre-existing / environment-sensitive failures outside this branch’s focus.
- Architect subagent review was requested but did not return before timeout during this session.

## Suggested PR framing

Title:
- `Harden TUI operator trust and command parity across bridge and NaturalInterface`

Short body:
- restores clarification before generic p5 fallback
- prevents unverified mutation tasks from claiming success
- preserves requested domains in bridge-triggered Ralph runs
- executes confirmed bridge actions instead of stalling after approval
- makes Bubble Tea launcher respect the active provider configuration
- aligns NaturalInterface command surface with actual supported actions
- cleans stale conflicted excluded pending tests
- reconciles source-of-truth docs
