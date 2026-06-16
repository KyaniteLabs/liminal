# Deprecation-to-Deletion Sweep Candidates (2026-06-15)

> **Purpose:** inventory of `@deprecated` / `retired` modules safe to batch-delete
> in a single PR. Verified zero production importers (excluding test files and
> `src/index.ts` barrel re-exports). Reused by G002/G005 across clean passes.

## Method

For each candidate module:
- `grep -rln "from.*['\"]<module>['\"]" src/` — must return empty (no production
  importers).
- Module must carry an explicit `@deprecated Audit C<num>` (C10) or `@deprecated
  Audit C<num>` (C9) or `retired` (C11) header.
- A single `git rm` + cleanup of `src/index.ts` barrel re-exports is the only
  follow-up needed.

## C10 — 17 modules (all zero production importers)

| # | Module | Header | Importers |
|---|--------|--------|-----------|
| 1 | `src/ledger/ReplayBundle.ts` | `@deprecated Audit C10` | 0 |
| 2 | `src/core/OrganismLoop.ts` | `@deprecated Audit C10` | 0 |
| 3 | `src/plugins/HookSystem.ts` | `@deprecated Audit C10` | 0 |
| 4 | `src/gallery/FeedbackQueue.ts` | `@deprecated Audit C10` | 0 |
| 5 | `src/agent/ResponseComposer.ts` | `@deprecated Audit C10` | 0 |
| 6 | `src/agent/TaskDelegator.ts` | `@deprecated Audit C10` | 0 |
| 7 | `src/scavenger/DNAExtractor.ts` | `@deprecated Audit C10` | 0 |
| 8 | `src/audio/FormantAnalyzer.ts` | `@deprecated Audit C10` | 0 |
| 9 | `src/audio/BPMKeyDetector.ts` | `@deprecated Audit C10` | 0 |
| 10 | `src/audio/VoiceToShapeMapper.ts` | `@deprecated Audit C10` | 0 |
| 11 | `src/dreaming/CrossModalTransfer.ts` | `@deprecated Audit C10` | 0 |
| 12 | `src/evaluation/HoldoutCriticBus.ts` | `@deprecated Audit C10` | 0 |
| 13 | `src/brain/CreativePreferenceExtractor.ts` | `@deprecated Audit C10` | 0 |
| 14 | `src/brain/StyleBlender.ts` | `@deprecated Audit C10` | 0 |
| 15 | `src/fs/adapters/TraceFSAdapter.ts` | `@deprecated Audit C10` | 0 |
| 16 | `src/fs/adapters/SeedFSAdapter.ts` | `@deprecated Audit C10` | 0 |
| 17 | `src/git/CompostBridge.ts` | `@deprecated Audit C10` | 0 |

## C9 — nodeprompt graph pipeline (PR #149)

| # | Module | Header | Importers |
|---|--------|--------|-----------|
| 1 | `src/nodeprompt/layout/coordinates.ts` | `@deprecated Audit C9` | 0 |
| 2 | `src/nodeprompt/layout/fibonacciSphere.ts` | `@deprecated Audit C9` | 0 |
| 3 | `src/nodeprompt/layout/SphereLayout.ts` | `@deprecated Audit C9` | 0 |
| 4 | `src/nodeprompt/gesture/gestureTypes.ts` | `@deprecated Audit C9` | 0 |
| 5 | `src/nodeprompt/gesture/GestureEngine.ts` | `@deprecated Audit C9` | 0 |
| 6 | `src/nodeprompt/extraction/schemas.ts` | `@deprecated Audit C9` | 0 |
| 7 | `src/nodeprompt/store/HistoryStore.ts` | `@deprecated Audit C9` | 0 |
| 8 | `src/nodeprompt/store/GraphStore.ts` | `@deprecated Audit C9` | 0 |

`src/nodeprompt/synthesizer.ts` is the only live module in this directory.

## C11 — calibration subsystem (PR #147)

`src/calibration/` directory contains the dead CalibrationSuite + CorrelationCalculator + 8
`calibratedScore` branches. All marked `retired`. `useCalibration && isCalibrated()` is
permanently false. Safe to delete in a follow-up.

## B1 — routing bandit writers/readers (this pass)

| # | Symbol | Location | Action |
|---|--------|----------|--------|
| 1 | `recordRoutingOutcome` | `src/routing/RoutingData.ts` | `@deprecated` header added; call site in `RalphLoop.ts:1636` removed (no live consumer) |
| 2 | `getRollingPerformance` | `src/routing/RoutingData.ts` | `@deprecated` header added |
| 3 | `getOptimalModelBandit` | `src/routing/RoutingData.ts` | `@deprecated` header added |
| 4 | `getBanditStats` | `src/routing/RoutingData.ts` | `@deprecated` header added |
| 5 | `recordRoutingOutcome` import in `src/core/RalphLoop.ts` | `src/core/RalphLoop.ts:49` | removed |

## D12 — HeuristicScorer prompt-vs-source token overlap (this pass)

Tracked in the next clean pass. The current behavior is documented as fallback; the
preferred path is render-signal-based. Low-priority deletion candidate.

## Total

- 17 C10 modules (ready for batch delete)
- 8 C9 nodeprompt modules (ready for batch delete)
- ~1-2 C11 calibration directories (ready for batch delete)
- 4 B1 routing symbols (deprecated; code preserved for re-wiring)
- D12 tracked for follow-up

**Estimated deletion: ~3000-4000 LOC across 26-28 files.**

## Follow-up

G005 (Final review gate) batches these into a single delete PR with a single
`git rm` and a single `src/index.ts` barrel cleanup. Verification: full test
suite + typecheck + build green.

## C9 (nodeprompt graph pipeline) — DELETED 2026-06-15

8 C9 nodeprompt modules + 5 matching test files removed in a single batch:

| # | Module | Status |
|---|--------|--------|
| 1 | `src/nodeprompt/layout/coordinates.ts` | deleted |
| 2 | `src/nodeprompt/layout/fibonacciSphere.ts` | deleted |
| 3 | `src/nodeprompt/layout/SphereLayout.ts` | deleted |
| 4 | `src/nodeprompt/gesture/gestureTypes.ts` | deleted |
| 5 | `src/nodeprompt/gesture/GestureEngine.ts` | deleted |
| 6 | `src/nodeprompt/extraction/schemas.ts` | deleted |
| 7 | `src/nodeprompt/store/HistoryStore.ts` | deleted |
| 8 | `src/nodeprompt/store/GraphStore.ts` | deleted |

`src/nodeprompt/index.ts` re-exports trimmed to only the live `synthesizePrompt` path.
Tests: 11,695 → 11,592 (-103 nodeprompt tests, +6 new tests for D12 + landing rebrand). Full test suite green.

## C10 / C11 — COMPLETED 2026-06-15

### C10 (17 orphaned modules) — RESOLVED

Of the 17 C10-flagged modules:

**13 deleted** (zero-consumer or dead-guarded):
- 11 modules with zero src/ importers (first pass): ReplayBundle, HookSystem, FeedbackQueue,
  TaskDelegator, DNAExtractor, VoiceToShapeMapper, HoldoutCriticBus, CreativePreferenceExtractor,
  StyleBlender, TraceFSAdapter, SeedFSAdapter
- CrossModalTransfer (barrel-only export, zero consumers)
- CompostBridge (dead-guarded: `bridgeToCompost && this.compostBridge` never true because
  GitIntegration is always constructed without a CompostBridge argument)

**4 reclassified as LIVE** (false deprecation headers removed):
- ResponseComposer — used by StudioAgent (8 call sites: direct/creative/engineering/hybrid response formatting)
- OrganismLoop — used by RalphLoop organism mode (`if (mode === 'organism')` branch)
- FormantAnalyzer — used by AudioToVisualMapper, AudioAnalyzer, RalphLoop voice-input pipeline
- BPMKeyDetector — used by AudioToVisualMapper, AudioAnalyzer, RalphLoop voice-input pipeline

### C11 (calibration suite) — DELETED

Entire `src/calibration/` directory removed (CalibrationSuite.ts, CorrelationCalculator.ts, index.ts).
All calibration code stripped from three consumers:
- `src/core/CreativeEvaluator.ts` (~200 LOC removed)
- `src/aesthetic/AestheticCritic.ts` (~200 LOC removed)
- `src/harness/HarnessMemory.ts` (~80 LOC removed)

Verification: typecheck exit 0, build exit 0, lint 0 errors, 761 test files / 11,316 tests green.
