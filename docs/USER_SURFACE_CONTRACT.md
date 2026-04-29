# Liminal User Surface Contract — One Engine, Two Cockpits

Liminal has one generation engine with two user-facing cockpits:

- **GUI / Studio cockpit** — the artist-facing workbench for prompts, artifacts, preview, review, and iteration.
- **TUI / Operator cockpit** — the keyboard-first control surface for the same sessions, events, review actions, and stop controls.

Both surfaces must preserve the same run truth. Differences in layout, density, or controls are acceptable; differences in state semantics are not.

## Shared run states

Every run should be explainable as the same sequence on both surfaces:

1. `intent` — capture the operator or artist request without forcing magic words.
2. `route` — show the chosen domain, model/provider role, and any prompt-overrides-selector decision.
3. `generate` — stream progress, active domain, attempt count, model labels, and recoverable errors.
4. `preview` — show the artifact or an explicit missing/sandbox-pending state. Never render fake fallback work.
5. `review` — present human-confirmation gates before any mutation, deletion, publish, or acceptance action.
6. `learn` — record receipts, scoring, failure classes, and user decisions for future harness improvement.

## Required cross-surface rules

- **Cancel stops active generation** — `/stop`, GUI Stop, and bridge cancel all terminate the active stream and publish a visible stopped event.
- **Confirm mutates only after review** — `y`, `/confirm`, and GUI Confirm may mutate only when the bridge exposes a pending action.
- **GUI and TUI consume the same bridge events** — both surfaces use the TUI bridge event stream with replayable event IDs and `Last-Event-ID` resume semantics.

## Labels and mental model

- Artist-facing wording is **Generate** for fast draft work and **Polish** for quality-gated proof work.
- Harness/proof wording belongs in receipts, diagnostics, and operator detail; it must not replace the artist-facing creative path.
- Provider/model labels must reflect the actual bridge session role truth, not wrapper or marketing names.

## Accessibility and observability baseline

- The GUI must expose skip navigation, current-mode state, polite live status, busy state while a run is active, and reduced-motion handling.
- The TUI must keep all active-run, review, and error transitions visible in text output.
- Both cockpits must make missing previews, cancelled runs, disconnected streams, and pending human review explicit.

## Canonical launch commands

- Studio GUI: `pnpm gui` launches the backend and browser workbench together.
- Operator TUI: `pnpm tui` launches the Bubble Tea operator cockpit with its bridge.
- Backend-only GUI API remains `node gui/start.js` for tests and focused debugging.
- Legacy Ink TUI is compatibility-only; use `pnpm run tui:ink` only with `LIMINAL_ENABLE_LEGACY_INK_TUI=1` for comparison or migration debugging.
