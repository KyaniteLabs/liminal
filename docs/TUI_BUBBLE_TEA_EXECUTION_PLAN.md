# TUI Bubble Tea Execution Plan

**Status Date:** 2026-04-28

## Current state

Bubble Tea is the canonical operator cockpit. Studio is the canonical GUI workbench.

The legacy Ink TUI is no longer a production surface. It remains compatibility-only for migration comparison and is disabled unless `LIMINAL_ENABLE_LEGACY_INK_TUI=1` is explicitly set.

## Canonical commands

- `pnpm gui` — starts Studio backend plus Vite GUI.
- `pnpm tui` — builds and launches the Bubble Tea operator cockpit through the shared bridge.
- `pnpm run tui:bridge` — starts the bridge without the Go shell for API/debug work.
- `pnpm run tui:ink` — compatibility-only legacy Ink launcher, guarded by env var.

## What must stay true

1. No destructive mutation without pending-action review and confirmation.
2. GUI and Bubble Tea consume the same bridge event semantics.
3. `/stop`, GUI Stop, and bridge cancel publish visible stopped events.
4. Provider/model/trust labels come from session truth, not display guesses.
5. Legacy Ink must not be reintroduced as a blessed launch path.

## Remaining execution priority

1. Maintain full non-visual E2E proof for prompt, stream, stop, confirm/cancel, and preview routes.
2. Keep GUI bundle budget green after new panels or dependencies.
3. Move any still-useful legacy Ink utilities into shared non-Ink modules before deleting Ink code.
