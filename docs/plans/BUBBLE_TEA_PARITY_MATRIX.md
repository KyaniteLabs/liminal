# Bubble Tea Parity Matrix

**Status Date:** 2026-04-09
**Branch:** `liminal/sess-1775800331133-zl0uwd`

---

## Requirement → Status → Gap → Done-Test

| Requirement | Current Implementation | Gap | Done-Test |
|---|---|---|---|
| **Modes: Chat / Inspect / Action / Confirm** | `model.go` has `Mode` field; `parseInputIntent()` routes `/status`→inspect, `/run`/`/agent`→action, chat→chat; `action.confirmed`/`action.cancelled` events clear mode | `Confirm` mode itself not rendered as a distinct view state (only `action.confirmed` event fires) | `TestParseInputIntentCommands`, `TestApplyEventHandlesModeChangedToInspect` ✅ |
| **Panes: history / active response / input / status / activity / action review** | `model.go` has `ChatBlocks[]` (history), `ActiveResponse` (streaming), `TextInput`, `StatusLines()`, `PendingAction` (action review) | Activity pane (tool activity feed) not implemented — pending actions surface in status but no live tool log | `TestCommittedEventCreatesChatBlock` ✅ |
| **No mutation without confirmation** | Action-like inputs (`/run`, `/agent`, `/preview`) route to `action` mode → pending action card → `y` confirm, `n` cancel; `ConfirmPendingAction()` / `CancelPendingAction()` send HTTP requests | No explicit `CONFIRM` mode UI state — action flows directly from ACTION to CHAT after confirm/cancel | Go integration tests cover the flow; `action_confirm_test.go` verifies ✅ |
| **No silent escalation** | `parseInputIntent()` only marks `chat` for non-`/` inputs or `/stop`; all other commands are explicit | Audit: `parseInputIntent("/confirm")` → `action`, correct | `TestParseInputIntentCommands` ✅ |
| **No unsafe launch paths** | Preview tab shows code output; actual browser/audio launch is NOT in Bubble Tea (only in GUI backend via `/api/preview/run`) | Bubble Tea has no direct launch paths; safe by design | N/A — Bubble Tea itself has no exec |
| **No ambiguous mode behavior** | Mode is always one of: `CHAT`, `INSPECT`, `ACTION`, `CONFIRM`; mode badge always rendered in header | `CONFIRM` is not a separate rendered mode — confirm is a one-shot event. Clarify in docs that CONFIRM is a transient state, not a persistent mode | Documentation gap, not functional gap |
| **Committed history separate from active response** | `response.started` clears `ActiveResponse`; `response.delta` appends to `ActiveResponse`; `response.committed` moves to `ChatBlocks[]`; `response.completed` finalizes without committing | None | `TestApplyEventSeparatesActiveResponseFromCommittedHistory` ✅ |
| **Action review card** | `PendingAction` rendered in `renderCompactStatus()` and `renderStatusLine()`; requires `y`/`n` keybinding in ACTION mode | Action card only shown in compact status when preview hidden; full action card not prominent in ACTION mode view | `TestPreviewEventsUpdateState` covers pending action flow ✅ |
| **Bridge: session lifecycle** | `CreateSession` → `GetStatus` → `SubmitInput` → `ConfirmAction`/`CancelAction` → SSE events | None | `TestEndToEndBridgeFlow`, `TestClientSessionStatusAndSSE` ✅ |
| **Bridge: SSE / event streaming** | `StreamEvents` uses `bufio.Scanner` over SSE `data:` lines; `program.Send(bridgeEventMsg{event})` for real-time | None — SSE reconnect with backoff: `streamDisconnectedMsg` → `reconnectTickMsg` cycle | `TestStreamDisconnectedSetsReconnecting`, `TestReconnectTickRestoresConnection` ✅ |
| **Resize does not break layout** | `tea.WindowSizeMsg` handler recalculates `chatWidth`, `previewWidth`, `paneHeight`; clamps to minimums | None | Go test coverage via model state transitions |
| **Trust / provenance labels** | `TrustLabel` + `TrustColor()` in status line; `mode` badge in header; `provider/model` pill | Trust color logic only checks first letter (`T`→green, `U`→red); "Generated code is untrusted by default" label set on init | `TestViewRendersTrustAndModeLabels` ✅ |
| **Terminal sanitization** | `sanitizeTerminalText.ts` exists in `src/tui/`; Bubble Tea uses Lip Gloss which is safe by design | Terminal sanitizer not wired into GUI server debug output paths | Separate from Bubble Tea scope |
| **Lip Gloss style system** | `theme.go` has full semantic palette (Tokyo Night + Dracula): `AccentGreen/Blue/Purple/Cyan/Orange/Red/Yellow`, `BgBase/Surface/Overlay`, `FgText/Subtle/Muted` | Good palette already exists — Wave 4 beauty pass may refine but not rebuild | `TestViewRendersConnectionDot`, `TestViewRendersTrustAndModeLabels` ✅ |
| **Explicit mode badge** | `renderHeader()` always shows `ModeStyle` + mode name | None | `TestViewRendersTrustAndModeLabels` ✅ |

---

## Critical Safety Verification

| Safety Invariant | Verified By | Status |
|---|---|---|
| Ordinary chat cannot mutate state without review | `parseInputIntent()` for plain text → `chat` mode → `SubmitInput` → no mutation path | ✅ Verified |
| `/run` and `/agent` route to Action mode | `parseInputIntent("/run X")` → `action`, `parseInputIntent("/agent X")` → `action` | ✅ `TestParseInputIntentCommands` |
| Confirm is required before mutation | `ConfirmPendingAction()` sends `POST /actions/{id}/confirm`; cancel sends `POST /actions/{id}/cancel` | ✅ Bridge integration test |
| No preview/audio auto-launch from Bubble Tea | Bubble Tea only sends input to bridge; no `exec`, `spawn`, or `open` calls | ✅ Code audit |
| Bridge connection uses SSE with backoff reconnection | `streamDisconnectedMsg` → 2s backoff → `reconnectTickMsg` → restart stream | ✅ `TestStreamDisconnectedSetsReconnecting` |

---

## Mode Behavior Summary

| Mode | Trigger | Display | Confirm Path |
|---|---|---|---|
| `CHAT` | Plain text, `/stop` | Full chat pane + preview pane | N/A — read only |
| `INSPECT` | `/status`, `/tasks`, `/help`, `/dogfood` | Status/inspect info in status pane | N/A — read only |
| `ACTION` | `/run`, `/agent`, `/preview`, `/play`, `/confirm`, `/cancel` | Compact status + pending action card | `y` to confirm → HTTP confirm; `n` to cancel → HTTP cancel |
| `CONFIRM` | Transient — fires after `action.confirmed` event | Returns to `CHAT` mode automatically | One-shot, not a persistent mode |

---

## Known Gaps (Non-Blocking)

1. **CONFIRM mode is not a persistent UI mode** — it is a one-shot event that returns to CHAT. This is a documentation澄清, not a bug. The spec says "Confirm mode approval is required before mutation" — and it IS required; the `CONFIRM` name in the mode enum is misleading since it is not a rendered state.
2. **Activity pane** — live tool activity feed is not implemented. Pending actions surface in status line.
3. **Debug header** — `view.go` line 101-103 has an orange debug block showing `blk:N resp:N` which should be removed before merge.
4. **No Go tests for UI rendering** — `theme.go` has no test file; view rendering is covered indirectly via `TestViewRendersConnectionDot` and `TestViewRendersTrustAndModeLabels`.

---

## Files Changed (Bubble Tea)

```
bubbletea/
  main.go                          — entry point, reads LIMINAL_BRIDGE_URL env
  internal/app/
    model.go                       — state, ApplyEvent, ConfirmPendingAction, CancelPendingAction
    update.go                      — Update, Init, key handling, SSE reconnection
    view.go                        — View, renderHeader, renderFooter, renderChatContent
    global.go                      — GlobalProgram for SSE→BubbleTea event injection
    e2e_bridge_test.go             — 17 tests covering bridge lifecycle
    wave2_features_test.go         — 7 tests covering command routing
    bridge_bootstrap_test.go        — 7 tests covering init and session creation
    preview_routing_test.go         — preview tab and event routing
    stream_commit_test.go          — committed history vs active response separation
    action_confirm_test.go         — confirm/cancel flow
    trust_labels_test.go            — trust label rendering
    preview_test.go                — preview pane behavior
  internal/bridge/
    client.go                      — HTTP+SSE client
    events.go                      — Event type definitions
    client_test.go                 — bridge client unit tests
  internal/ui/
    theme.go                       — Lip Gloss semantic color palette
```

---

## Verification Commands

```bash
# Go tests (all pass)
cd bubbletea && go test ./... -v -count=1

# Build binary
cd bubbletea && go build -o liminal-tui .

# Run (requires GUI server on localhost:3000)
LIMINAL_BRIDGE_URL=http://localhost:3000 go run .
```
