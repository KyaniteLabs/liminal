# TUI Bubble Tea Migration Plan

## Decision

Bubble Tea is now the canonical operator TUI. The Studio GUI is the canonical artist-facing workbench.

The old Ink TUI is compatibility-only and disabled by default through `pnpm run tui:ink` unless `LIMINAL_ENABLE_LEGACY_INK_TUI=1` is set.

## Transport

The shared TypeScript bridge remains the runtime boundary:

- local HTTP request endpoints for control
- SSE event streaming with event IDs and `Last-Event-ID` replay

HTTP + SSE fits the current backend shape, is simple to audit, and is enough for the pane-first operator cockpit.

## Current launch contract

- Studio GUI: `pnpm gui`
- Operator TUI: `pnpm tui`
- Bridge-only diagnostics: `pnpm run tui:bridge`
- Legacy Ink comparison only: `LIMINAL_ENABLE_LEGACY_INK_TUI=1 pnpm run tui:ink`

## Remaining migration work

1. Keep Bubble Tea and GUI on the shared surface contract in `docs/USER_SURFACE_CONTRACT.md`.
2. Keep legacy Ink out of the blessed launch path.
3. Delete legacy Ink code only after any remaining useful utilities are either moved or proven unused.
