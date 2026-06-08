# Taste Preference Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user taste actions, train a local taste model from persisted preference/archive data, and hydrate gardener replay bias with that model.

**Architecture:** Add a `TasteLearningService` that owns persistence/training/model hydration, then wire it into the TUI `/pin` and `/reject` paths plus `sinter preferences train|model`. Existing learning primitives remain the core implementation.

**Tech Stack:** TypeScript, Vitest, SinterFS, existing learning/autonomy modules, `bin/sinter` CLI.

---

### Task 1: TasteLearningService Core

**Files:**
- Create: `src/learning/TasteLearningService.ts`
- Test: `test/unit/learning/TasteLearningService.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests for recording a preference, training from persisted archive entries plus preferences, and loading the latest model.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run test/unit/learning/TasteLearningService.test.ts`

Expected: FAIL because `TasteLearningService` does not exist.

- [ ] **Step 3: Implement minimal service**

Implement:

- project-local preference directory resolution
- `recordPreference()`
- `trainFromProject()`
- `loadLatestModel()`
- SinterFS model persistence at `taste/model/latest`

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run test/unit/learning/TasteLearningService.test.ts`

Expected: PASS.

### Task 2: TUI Command Wiring

**Files:**
- Modify: `src/tui-bridge/TuiBridgeService.ts`
- Modify: `test/tui-bridge/tui-bridge-commands.test.ts`

- [ ] **Step 1: Write failing TUI tests**

Add coverage that successful `/pin <candidate-id>` records a `pin` preference and successful
`/reject <candidate-id>` records a `reject` preference.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run test/tui-bridge/tui-bridge-commands.test.ts`

Expected: FAIL because commands do not persist preferences.

- [ ] **Step 3: Wire service into command handling**

Add a lazy `getTasteLearningService()` and call it after successful pin/reject. Keep command
behavior working when SinterFS is unavailable.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run test/tui-bridge/tui-bridge-commands.test.ts`

Expected: PASS.

### Task 3: Gardener Model Hydration

**Files:**
- Modify: `src/tui-bridge/TuiBridgeService.ts`
- Modify: `test/unit/autonomy/AutonomousGardener.test.ts`

- [ ] **Step 1: Write failing hydration/bias test**

Prove that loaded taste weights bias replay selection toward the taste-aligned archive entry.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run test/unit/autonomy/AutonomousGardener.test.ts`

Expected: FAIL because the asserted taste bias path is not observable.

- [ ] **Step 3: Add minimal observable behavior**

Expose enough result metadata to prove taste-biased selection without leaking internals.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run test/unit/autonomy/AutonomousGardener.test.ts`

Expected: PASS.

### Task 4: CLI Operator Commands

**Files:**
- Modify: `bin/sinter`
- Test: add or update CLI contract test under `test/integration/` or `test/unit/cli/`

- [ ] **Step 1: Write failing CLI contract tests**

Assert `bin/sinter` exposes `preferences train` and `preferences model`, imports
`TasteLearningService`, and existing `preferences stats/export` use project-local storage.

- [ ] **Step 2: Verify RED**

Run the new/updated CLI contract test.

Expected: FAIL because the CLI commands are missing.

- [ ] **Step 3: Implement CLI wiring**

Call `TasteLearningService.trainFromProject()` for `train` and `loadLatestModel()` for
`model`. Print compact summaries.

- [ ] **Step 4: Verify GREEN**

Run the CLI contract test.

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm vitest run test/unit/learning/TasteLearningService.test.ts
pnpm vitest run test/tui-bridge/tui-bridge-commands.test.ts
pnpm vitest run test/unit/autonomy/AutonomousGardener.test.ts
```

- [ ] **Step 2: Run build**

Run: `pnpm build`

Expected: zero TypeScript errors.

- [ ] **Step 3: Run test quality gate**

Run: `pnpm test:quality`

Expected: pass.

- [ ] **Step 4: Open PR**

Push branch and open a PR summarizing capture, persistence, training, hydration, and verification.
