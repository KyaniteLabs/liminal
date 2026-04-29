# User Surface Observability Slice Implementation Plan

**Goal:** Make the TUI and GUI share a small, explicit generation-observability contract and add a deterministic smoke runner that proves the contract through live bridge/GUI surfaces.

**Architecture:** Reuse the existing TUI bridge event stream as the single source of truth. Add two explicit lifecycle events (`generation.route.selected` and `preview.verified`) around the already-existing generation and preview events, then teach GUI derivation helpers to render those events without creating a second backend. The proof runner starts real local bridge and GUI servers, submits a natural-language creative prompt marker, publishes deterministic proof events through the bridge stream, verifies SSE replay, verifies GUI preview availability, and writes a receipt under `.omx/proof/`.

**Tech Stack:** TypeScript, Vitest, existing `TuiBridgeService`/`TuiBridgeServer`, GUI telemetry helpers, Node/tsx proof script, existing Express GUI app.

---

### Task 1: Lock the bridge lifecycle event contract

**Files:**
- Modify: `src/tui-bridge/types.ts`
- Modify: `src/tui-bridge/TuiBridgeService.ts`
- Test: `test/tui-bridge/tui-bridge-no-chat-lane.test.ts`

**Steps:**
1. Write a failing service test that submits a workbench creative prompt and expects `generation.route.selected` before `generation.attempt.started`.
2. Add a typed `generation.route.selected` event with `domain`, `domains`, `executionMode`, `candidateCount`, and `timeoutMinutes`.
3. Emit the event in both draft and prove generation paths immediately after `buildCreativeDomainPlan()`.
4. Run the focused TUI bridge test.

### Task 2: Lock GUI interpretation of route and verified preview events

**Files:**
- Modify: `gui/src/gui/workbenchTelemetry.ts`
- Modify: `gui/src/gui/cockpitDerivation.ts`
- Test: `test/unit/gui-workbench-telemetry.test.ts`
- Test: `test/unit/gui-operator-cockpit-state.test.ts`

**Steps:**
1. Write failing GUI helper tests for route-selected activity and verified-preview status.
2. Teach `workbenchTelemetry` recent activity and process steps to recognize `generation.route.selected` and `preview.verified`.
3. Teach `deriveCockpit` to expose `verified preview` when the preview verification event arrives.
4. Run focused GUI helper tests.

### Task 3: Add the live user-surface observability proof runner

**Files:**
- Create: `scripts/proof/user-surface-observability.ts`
- Modify: `package.json`
- Test: `test/integration/user-surface-e2e.test.js`
- Optional static test: `test/scripts/user-surface-observability-proof-script.test.ts`

**Steps:**
1. Write a failing integration test that requires a script/package entry for the observability proof and verifies the event sequence over SSE.
2. Implement a deterministic runner that starts `TuiBridgeServer` and GUI `createApp`, submits a natural-language creative prompt marker, publishes route/attempt/artifact/preview/verified events, verifies SSE event order, verifies GUI `/api/preview/run` and `/preview`, and writes `.omx/proof/user-surface-observability.json`.
3. Add `proof:user-surface-observability` to `package.json`.
4. Run the script and focused integration test.

### Task 4: Verify, commit, PR, and monitor

**Files:**
- All changed files above.

**Steps:**
1. Run focused tests for TUI bridge, GUI telemetry, GUI cockpit, and user-surface integration.
2. Run `pnpm build` and `pnpm lint`.
3. Run the new proof script.
4. Commit with Lore trailers.
5. Push, open PR, monitor CI/review threads, address any actionable feedback, merge, and sync local main.
