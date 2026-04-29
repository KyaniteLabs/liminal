# Bubble Tea Operator Cockpit

Keyboard-first TUI for the Liminal bridge. It is the operator cockpit for the same sessions, event stream, review gates, and cancel controls that the GUI Studio cockpit uses.

## Current scope

- shared TUI bridge session creation and replayable SSE event stream
- prompt submission with explicit creative/client intent
- review-card confirm/cancel controls for pending actions
- `/stop` cancellation for the active generation run
- provider/model/trust status, timeline, artifacts, preview, and diagnostics panes

## Smoke check

```bash
cd bubbletea
go test ./...
go run .
```

Press `q` or `ctrl+c` to exit.
