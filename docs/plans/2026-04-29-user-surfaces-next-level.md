# User Surfaces Next-Level Implementation Plan

**Goal:** Land every remaining non-visual TUI/GUI backlog item as one shared user-surface contract: controls, provider truth, preview failure states, accessibility semantics, workbench IA, and TUI command/help consolidation.

**Architecture:** Keep the TUI bridge as the single source of truth. Add small typed lifecycle events for cancellation and preview unavailability, expose role truth from bridge session creation, derive both GUI and Bubble Tea surfaces from the same event/status fields, and add deterministic proof scripts so the surfaces can be verified without cloud model credentials.

**Tech Stack:** TypeScript, React/Vite GUI, Node HTTP/SSE TUI bridge, Bubble Tea Go TUI, Vitest, Go test, existing proof-script pattern.

---

### Task 1: Control-plane parity

**Files:**
- Modify: `src/tui-bridge/types.ts`
- Modify: `src/tui-bridge/TuiBridgeService.ts`
- Modify: `gui/src/gui/workbenchTelemetry.ts`
- Modify: `gui/src/gui/cockpitDerivation.ts`
- Modify: `gui/src/gui/useTuiBridgeSession.ts`
- Modify: `gui/src/App.tsx`
- Modify: `bubbletea/internal/app/model.go`
- Test: `test/tui-bridge/tui-bridge-service.test.ts`
- Test: `test/unit/gui-workbench-telemetry.test.ts`
- Test: `bubbletea/internal/app/action_confirm_test.go`

**Steps:**
1. Add failing tests for `generation.cancelled`, status updates after confirm/cancel, GUI cancelled summary, and TUI visible stopped state.
2. Emit `generation.cancelled` and `status.updated` when a run is stopped.
3. Emit `status.updated` after action confirm/cancel so both surfaces clear pending state from SSE alone.
4. Add GUI cancel-pending control next to confirm.
5. Update Bubble Tea event application and view text.

### Task 2: Provider/model truth labels

**Files:**
- Modify: `src/tui-bridge/TuiBridgeServer.ts`
- Modify: `bubbletea/internal/bridge/events.go`
- Modify: `bubbletea/internal/app/model.go`
- Modify: `bubbletea/internal/app/view.go`
- Test: `test/tui-bridge/tui-bridge-service.test.ts`
- Test: `bubbletea/internal/app/trust_labels_test.go`

**Steps:**
1. Add failing tests proving session status includes generator/harness/evaluator roles and Bubble Tea renders role-specific labels.
2. Use `summarizeBridgeRuntime()` when creating bridge sessions.
3. Decode roles in Bubble Tea status and render Generator/Harness/Evaluator in compact/operator surfaces.

### Task 3: Missing/disconnected preview states

**Files:**
- Modify: `src/tui-bridge/types.ts`
- Modify: `gui/src/gui/useTuiBridgeSession.ts`
- Modify: `gui/src/gui/workbenchTelemetry.ts`
- Modify: `gui/src/gui/cockpitDerivation.ts`
- Modify: `gui/src/App.tsx`
- Modify: `bubbletea/internal/bridge/events.go`
- Modify: `bubbletea/internal/app/model.go`
- Test: `test/unit/gui-workbench-telemetry.test.ts`
- Test: `bubbletea/internal/app/preview_test.go`

**Steps:**
1. Add failing tests for `preview.missing` and synthetic `stream.disconnected` surface summaries.
2. Add typed `preview.missing` event.
3. Let GUI EventSource errors append a visible disconnected event.
4. Render missing/disconnected preview as explicit blocked state instead of blank stage.
5. Let Bubble Tea show missing preview in the operator preview card.

### Task 4: Accessibility semantics

**Files:**
- Modify: `gui/src/components/WorkbenchShell.tsx`
- Modify: `gui/src/App.tsx`
- Modify: `gui/src/index.css`
- Test: `test/unit/gui-workbench-accessibility.test.ts`

**Steps:**
1. Add static tests for skip link, named prompt control, busy main region, polite status, reduced-motion CSS, and visible preview status text.
2. Add stable IDs/ARIA wiring to the command bar, main stage, and timeline.
3. Ensure reduced-motion disables pulse/transition-heavy motion.

### Task 5: Workbench IA shell completion

**Files:**
- Modify: `gui/src/gui/workbenchState.ts`
- Modify: `gui/src/components/WorkbenchShell.tsx`
- Modify: `gui/src/App.tsx`
- Test: `test/unit/gui-workbench-state.test.ts`

**Steps:**
1. Add tests proving Generate is the default/front-door mode and Settings is not first.
2. Make shell copy and labels center Generate/Review/Evolve/Observe/Settings instead of legacy tab language.
3. Keep legacy panels supplemental only.

### Task 6: TUI command/help consolidation

**Files:**
- Modify: `bubbletea/internal/app/update.go`
- Modify: `bubbletea/internal/app/layout.go`
- Test: `bubbletea/internal/app/wave2_features_test.go`
- Test: `bubbletea/internal/app/operator_surface_test.go`

**Steps:**
1. Add failing tests for one command registry powering parse intent and help rows.
2. Replace scattered command/help lists with a small `operatorCommands` table.
3. Include `/stop`, `/confirm`, `/cancel`, `/model`, `/provider`, `/preview`, and core inspection commands with concise descriptions.

### Task 7: Deterministic proof runner

**Files:**
- Create: `scripts/proof/user-surface-controls.ts`
- Modify: `package.json`
- Test: `test/scripts/user-surface-controls-proof-script.test.ts`

**Steps:**
1. Add failing package/script wiring test.
2. Start real bridge + GUI servers, exercise role status, stop/cancel/confirm, missing preview, and GUI preview route.
3. Write `.omx/proof/user-surface-controls.json` and fail if any check is false.

### Task 8: Verification, PR, CI, and cleanup

**Steps:**
1. Run focused Vitest and Go tests.
2. Run `pnpm build`, `pnpm lint`, `pnpm run proof:user-surfaces`, `pnpm run proof:user-surface-observability`, `pnpm run proof:user-surface-controls`, full Vitest, GUI build, and Bubble Tea tests.
3. Commit with Lore trailers, open PR, monitor checks and review threads, fix comments, merge, fast-forward main, and remove worktree.
