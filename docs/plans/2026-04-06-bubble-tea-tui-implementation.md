# Bubble Tea TUI + Ink Containment Implementation Plan

**Goal:** Contain the current Ink TUI so it cannot mutate state without explicit review/confirmation, while building a Bubble Tea MVP with pane-first operator UX and a safe bridge to the existing TypeScript backend.

**Architecture:** Split the work into two lanes. Lane A finishes immediate Ink safety containment and stops deeper strategic dependence on Ink. Lane B introduces a Bubble Tea shell backed by a new shared TypeScript TUI bridge service using local HTTP for commands and SSE for event streaming, with committed-history vs active-response separation and explicit Chat / Inspect / Action / Confirm modes.

**Tech Stack:** TypeScript, Ink, Express/HTTP, SSE, EventBus, Go, Bubble Tea, Lip Gloss, optional Bubbles components.

---

## Preconditions / Known Blockers

- Missing docs referenced by the takeover brief are not present in this worktree:
  - `docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md`
  - `docs/TUI_BUBBLE_TEA_MIGRATION_PLAN.md`
  - `docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md`
- The current containment patch references `/confirm`, but no confirm implementation exists yet.
- `HarnessAgent.executeTask()` and `LLMModeAgent.executeTask()` currently do not enforce `approved === true`.
- CWD-based loading still exists in `src/llm/PromptBuilder.ts`.
- Risky preview/audio flows still exist in `src/tui/preview/AudioPlayer.ts` and `src/tui/preview/BrowserLauncher.ts`.

---

### Task 1: Snapshot the current TUI safety gap before changing behavior

**Files:**
- Inspect: `src/tui/HarnessTUI.tsx`
- Inspect: `src/tui/NaturalInterface.ts`
- Inspect: `src/tui/commands.ts`
- Inspect: `src/harness/agent/HarnessAgent.ts`
- Inspect: `src/harness/agent/LLMModeAgent.ts`
- Inspect: `src/llm/PromptBuilder.ts`
- Inspect: `src/tui/preview/AudioPlayer.ts`
- Inspect: `src/tui/preview/BrowserLauncher.ts`
- Create: `docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md`

**Step 1: Write the failing checklist into the execution plan doc**

Add a section called `Current Ink Containment Gaps` listing:
- no mutation without confirmation
- no ordinary chat leading to destructive execution
- explicit mode requirement
- no direct execution from `/run` or `/agent`
- no unreviewed preview/audio subprocess launches
- no CWD-based prompt/personality loading in TUI-critical paths

**Step 2: Save the document with a dated status note**

Include exact findings from current code, not aspirations.

**Step 3: Verify the doc exists**

Run: `test -f docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md && echo OK`
Expected: `OK`

**Step 4: Commit**

```bash
git add docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md
git commit -m "docs(tui): record current ink containment gaps"
```

---

### Task 2: Add failing tests for approval enforcement in agent execution

**Files:**
- Modify: `src/harness/agent/HarnessAgent.ts`
- Modify: `src/harness/agent/LLMModeAgent.ts`
- Create/Test: `test/harness/agent-approval-gate.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `HarnessAgent.executeTask()` rejects unapproved tasks
- `LLMModeAgent.executeTask()` rejects unapproved tasks
- approved tasks can proceed past the initial gate

Example skeleton:

```ts
it('rejects unapproved structured tasks', async () => {
  const agent = new HarnessAgent(mockLLMClient());
  await expect(agent.executeTask({
    id: 't1',
    title: 'danger',
    description: 'mutate files',
    approved: false,
  })).rejects.toThrow(/approved/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/harness/agent-approval-gate.test.ts`
Expected: FAIL because execution currently ignores approval.

**Step 3: Write minimal implementation**

At the top of both `executeTask()` methods, reject if `approved !== true` with a clear error.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand test/harness/agent-approval-gate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/harness/agent-approval-gate.test.ts src/harness/agent/HarnessAgent.ts src/harness/agent/LLMModeAgent.ts
git commit -m "fix(tui): enforce approval gates in agents"
```

---

### Task 3: Replace fake `/confirm` messaging with a real pending-action flow in Ink

**Files:**
- Modify: `src/tui/NaturalInterface.ts`
- Modify: `src/tui/commands.ts`
- Modify: `src/tui/HarnessTUI.tsx`
- Create/Test: `test/tui/confirm-flow.test.ts`

**Step 1: Write the failing test**

Test the following flow:
- action request creates a pending action record
- no mutation occurs yet
- `/confirm <id>` executes the pending action
- `/cancel <id>` removes it

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/tui/confirm-flow.test.ts`
Expected: FAIL because `/confirm` and `/cancel` do not exist.

**Step 3: Write minimal implementation**

Implement:
- pending action queue/store
- action IDs
- `/confirm <id>`
- `/cancel <id>`
- clear status text explaining review-before-mutation

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand test/tui/confirm-flow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/tui/confirm-flow.test.ts src/tui/NaturalInterface.ts src/tui/commands.ts src/tui/HarnessTUI.tsx
git commit -m "feat(tui): add explicit confirm and cancel flow"
```

---

### Task 4: Remove remaining CWD-based trust leaks from prompt loading

**Files:**
- Modify: `src/llm/PromptBuilder.ts`
- Test: `test/llm/prompt-builder-path-safety.test.ts`
- Update: `docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md`

**Step 1: Write the failing test**

Add tests proving the TUI-critical prompt path does not read:
- `process.cwd()/SOUL.md`
- `process.cwd()/PROJECT_RULES.md`
- `process.cwd()/docs/domains/*.md`
when operating in the containment-safe path.

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/llm/prompt-builder-path-safety.test.ts`
Expected: FAIL because `PromptBuilder` currently uses `process.cwd()`.

**Step 3: Write minimal implementation**

Introduce a safe resolver using repo-relative or explicitly configured roots only.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand test/llm/prompt-builder-path-safety.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/llm/prompt-builder-path-safety.test.ts src/llm/PromptBuilder.ts docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md
git commit -m "fix(prompt): remove cwd-based loading from safe tui path"
```

---

### Task 5: Sanitize terminal/debug output before it reaches Ink surfaces

**Files:**
- Modify: `src/tui/HarnessTUI.tsx`
- Modify: `src/tui/TuiDebugger.ts`
- Modify: `src/core/EventBus.ts`
- Create: `src/tui/sanitizeTerminalText.ts`
- Test: `test/tui/sanitize-terminal-text.test.ts`

**Step 1: Write the failing test**

Test removal/truncation of:
- ANSI control sequences
- carriage-return overwrites
- escape/control characters
- sensitive prompt fragments
- long tool payloads

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/tui/sanitize-terminal-text.test.ts`
Expected: FAIL because no dedicated sanitizer exists.

**Step 3: Write minimal implementation**

Create `sanitizeTerminalText()` and route all debug/log/history writes through it.

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand test/tui/sanitize-terminal-text.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tui/sanitizeTerminalText.ts test/tui/sanitize-terminal-text.test.ts src/tui/HarnessTUI.tsx src/tui/TuiDebugger.ts src/core/EventBus.ts
git commit -m "fix(tui): sanitize terminal and debug output"
```

---

### Task 6: Harden risky preview and audio execution in the Ink TUI

**Files:**
- Modify: `src/tui/preview/AudioPlayer.ts`
- Modify: `src/tui/preview/BrowserLauncher.ts`
- Modify: `src/tui/commands.ts`
- Test: `test/tui/preview-safety.test.ts`

**Step 1: Write the failing test**

Test that:
- ordinary chat does not auto-launch browser/audio
- preview/audio require explicit command or explicit confirm-mode approval
- file paths are validated/allowlisted
- shell-based launch paths are rejected in safe mode

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/tui/preview-safety.test.ts`
Expected: FAIL because preview/audio are launch-capable without enough containment.

**Step 3: Write minimal implementation**

Implement:
- explicit launch gating
- safe path checks
- no implicit launch from ordinary chat
- disable Windows shell fallback unless explicitly approved and reviewed

**Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand test/tui/preview-safety.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/tui/preview-safety.test.ts src/tui/preview/AudioPlayer.ts src/tui/preview/BrowserLauncher.ts src/tui/commands.ts
git commit -m "fix(tui): harden preview and audio execution"
```

---

### Task 7: Define the Bubble Tea bridge contract as code-backed docs before writing Go UI logic

**Files:**
- Create: `docs/TUI_BUBBLE_TEA_MIGRATION_PLAN.md`
- Create: `docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md`
- Create: `src/tui-bridge/types.ts`
- Create: `src/tui-bridge/README.md`

**Step 1: Write the bridge types first**

Define:
- session status shape
- mode enum: `chat | inspect | action | confirm`
- pending action shape
- trust/provenance payloads
- SSE event union

**Step 2: Write the migration doc**

Document:
- why local HTTP + SSE is the MVP bridge
- why WebSocket is deferred
- how Ink containment and Bubble Tea migration run in parallel

**Step 3: Write the aesthetic plan**

Document operator-grade shell rules:
- pane-first layout
- semantic palette
- trust/provenance badges
- active-response pane behavior
- review-card behavior

**Step 4: Verify typecheck on new bridge types**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/TUI_BUBBLE_TEA_MIGRATION_PLAN.md docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md src/tui-bridge/types.ts src/tui-bridge/README.md
git commit -m "docs(tui): define bubble tea bridge and migration contract"
```

---

### Task 8: Build the shared TypeScript TUI bridge service before Bubble Tea integration

**Files:**
- Create: `src/tui-bridge/TuiBridgeService.ts`
- Create: `src/tui-bridge/TuiSessionStore.ts`
- Create: `src/tui-bridge/TuiEventStream.ts`
- Modify: `gui/server.js`
- Test: `test/tui-bridge/tui-bridge-service.test.ts`

**Step 1: Write the failing test**

Test endpoints/behavior for:
- create session
- submit input
- mark action as review-required
- confirm action
- cancel action
- emit response delta events without committing history until completion

**Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand test/tui-bridge/tui-bridge-service.test.ts`
Expected: FAIL because service does not exist.

**Step 3: Write minimal implementation**

Implement a shared service used by the GUI HTTP server and future Bubble Tea adapter.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --runInBand test/tui-bridge/tui-bridge-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add test/tui-bridge/tui-bridge-service.test.ts src/tui-bridge/TuiBridgeService.ts src/tui-bridge/TuiSessionStore.ts src/tui-bridge/TuiEventStream.ts gui/server.js
git commit -m "feat(tui-bridge): add shared http and sse bridge service"
```

---

### Task 9: Scaffold the Bubble Tea app with a static shell first

**Files:**
- Create: `bubbletea/go.mod`
- Create: `bubbletea/main.go`
- Create: `bubbletea/internal/app/model.go`
- Create: `bubbletea/internal/app/view.go`
- Create: `bubbletea/internal/app/update.go`
- Create: `bubbletea/internal/ui/theme.go`
- Create: `bubbletea/README.md`

**Step 1: Write the failing smoke check**

Add a simple shell command or README step asserting the app starts and renders static panes.

**Step 2: Run the shell to verify it fails before scaffolding**

Run: `cd bubbletea && go run .`
Expected: FAIL because app does not exist.

**Step 3: Write minimal implementation**

Scaffold a static shell with:
- header
- history pane
- active response pane
- status pane
- footer input bar
- explicit mode badge

**Step 4: Run shell to verify it renders**

Run: `cd bubbletea && go run .`
Expected: terminal UI launches without backend dependency.

**Step 5: Commit**

```bash
git add bubbletea
git commit -m "feat(bubbletea): scaffold pane-first static shell"
```

---

### Task 10: Connect Bubble Tea to bridge status and SSE activity before chat mutation flows

**Files:**
- Modify: `bubbletea/internal/app/model.go`
- Modify: `bubbletea/internal/app/update.go`
- Modify: `bubbletea/internal/app/view.go`
- Create: `bubbletea/internal/bridge/client.go`
- Create: `bubbletea/internal/bridge/events.go`
- Test: `bubbletea/internal/bridge/client_test.go`

**Step 1: Write the failing test**

Test that the Go bridge client:
- creates a session
- fetches status
- consumes SSE events
- routes `response.delta` into active response state only

**Step 2: Run test to verify it fails**

Run: `cd bubbletea && go test ./...`
Expected: FAIL because bridge client does not exist.

**Step 3: Write minimal implementation**

Implement client methods and wire the status pane + active response pane.

**Step 4: Run tests to verify they pass**

Run: `cd bubbletea && go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add bubbletea/internal/bridge bubbletea/internal/app
git commit -m "feat(bubbletea): connect shell to bridge status and events"
```

---

### Task 11: Implement committed-history vs active-response behavior in Bubble Tea

**Files:**
- Modify: `bubbletea/internal/app/model.go`
- Modify: `bubbletea/internal/app/update.go`
- Modify: `bubbletea/internal/app/view.go`
- Test: `bubbletea/internal/app/stream_commit_test.go`

**Step 1: Write the failing test**

Test:
- `response.started` clears active response pane
- `response.delta` appends only to active response pane
- `response.completed` finalizes active response
- `response.committed` moves finalized content into history pane

**Step 2: Run test to verify it fails**

Run: `cd bubbletea && go test ./...`
Expected: FAIL until event handling is implemented.

**Step 3: Write minimal implementation**

Add active-response buffer and committed transcript list.

**Step 4: Run tests to verify they pass**

Run: `cd bubbletea && go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add bubbletea/internal/app
git commit -m "feat(bubbletea): separate active response from committed history"
```

---

### Task 12: Add Action mode and Confirm mode review cards in Bubble Tea

**Files:**
- Modify: `bubbletea/internal/app/model.go`
- Modify: `bubbletea/internal/app/update.go`
- Modify: `bubbletea/internal/app/view.go`
- Test: `bubbletea/internal/app/action_confirm_test.go`

**Step 1: Write the failing test**

Test:
- action-like input transitions from Chat to Action mode
- review card renders before mutation
- confirm action sends backend confirm request
- cancel action sends backend cancel request
- no mutation occurs before confirm success

**Step 2: Run test to verify it fails**

Run: `cd bubbletea && go test ./...`
Expected: FAIL until mode transitions exist.

**Step 3: Write minimal implementation**

Implement:
- mode enum in UI state
- action review card renderer
- confirm/cancel keybindings
- pending action banner

**Step 4: Run tests to verify they pass**

Run: `cd bubbletea && go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add bubbletea/internal/app
git commit -m "feat(bubbletea): add action and confirm modes"
```

---

### Task 13: Render trust state and provenance labels in Bubble Tea MVP

**Files:**
- Modify: `bubbletea/internal/ui/theme.go`
- Modify: `bubbletea/internal/app/view.go`
- Test: `bubbletea/internal/app/trust_labels_test.go`
- Update: `docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md`

**Step 1: Write the failing test**

Test that UI renders:
- mode badge
- provider/model badge
- trust label
- provenance label
- `generated code is untrusted` state when applicable

**Step 2: Run test to verify it fails**

Run: `cd bubbletea && go test ./...`
Expected: FAIL until labels are rendered.

**Step 3: Write minimal implementation**

Add styles and view composition for semantic trust/provenance badges.

**Step 4: Run tests to verify they pass**

Run: `cd bubbletea && go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add bubbletea/internal/ui/theme.go bubbletea/internal/app/view.go bubbletea/internal/app/trust_labels_test.go docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md
git commit -m "feat(bubbletea): render trust state and provenance labels"
```

---

### Task 14: Update the documentation bible after each meaningful landing

**Files:**
- Modify: `docs/visual-bible.html`
- Modify: `docs/THE_BIBLE.md`
- Modify: `docs/features.html` (if Bubble Tea becomes a documented feature)
- Modify: `docs/cli-reference.html` (if Bubble Tea gets a CLI entrypoint)

**Step 1: Update status truthfully after each merged milestone**

Reflect actual state only:
- Ink containment status
- Bubble Tea MVP status
- bridge readiness
- migration readiness

**Step 2: Verify docs reference the correct dashboard**

Only update `docs/visual-bible.html`; do not create new dashboard files.

**Step 3: Run a light docs check**

Run: `rg -n "Bubble Tea|Ink containment|trust|provenance|Confirm mode" docs/visual-bible.html docs/THE_BIBLE.md docs/features.html docs/cli-reference.html`
Expected: matching updated documentation.

**Step 4: Commit**

```bash
git add docs/visual-bible.html docs/THE_BIBLE.md docs/features.html docs/cli-reference.html
git commit -m "docs: update visual bible and tui migration status"
```

---

## Recommended execution order

1. Task 1 — snapshot missing docs + current gaps
2. Task 2 — enforce approval in agents
3. Task 3 — real Ink confirm flow
4. Task 4 — remove CWD trust leaks
5. Task 5 — sanitize terminal/debug output
6. Task 6 — harden preview/audio execution
7. Task 7 — define bridge docs/types
8. Task 8 — build shared TS bridge
9. Task 9 — scaffold Bubble Tea shell
10. Task 10 — connect Bubble Tea to bridge
11. Task 11 — separate active-response from history
12. Task 12 — action/confirm modes
13. Task 13 — trust/provenance aesthetics
14. Task 14 — update documentation bible

---

## Now / Next / Later mapping

### Now
- Tasks 1–6
- Outcome: Ink becomes contained enough to trust as an interim shell.

### Next
- Tasks 7–10
- Outcome: Bubble Tea MVP exists and can speak to the TS backend.

### Later
- Tasks 11–14
- Outcome: Bubble Tea becomes the operator-grade default and Ink can move toward retirement.

---

## Subagent-dispatchable workstreams

### Workstream A: Ink Safety Containment
Owns:
- `src/tui/*`
- `src/llm/PromptBuilder.ts`
- `src/harness/agent/*`
- related tests

Starts with:
- Tasks 2–6

### Workstream B: TS Bridge Contract + Service
Owns:
- `src/tui-bridge/*`
- `gui/server.js`
- related tests/docs

Starts with:
- Tasks 7–8

### Workstream C: Bubble Tea Shell + Modes
Owns:
- `bubbletea/*`

Starts with:
- Tasks 9–13

### Workstream D: Documentation Bible Alignment
Owns:
- `docs/visual-bible.html`
- `docs/THE_BIBLE.md`
- TUI migration docs

Starts with:
- Task 14, but only after concrete implementation lands

---

## Definition of done for MVP

The Bubble Tea MVP is done when all of the following are true:
- user input always occurs in an explicit mode
- action-like requests route to Action mode, not direct mutation
- Confirm mode approval is required before mutation
- committed history is separate from active streaming response
- trust/provenance labels render clearly
- backend bridge supports session, input, status, confirm/cancel, and SSE events
- Ink remains in containment-only mode and no new strategic feature dependency is added there
