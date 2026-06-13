# Sinter User Surface Contract — Chat First, Preview First

Sinter keeps one generation engine and one invested user surface, the Studio GUI (ADR 0005). The operator/bridge substrate sits behind it:

- **Studio GUI** — the artist-facing workbench: clean conversation, same-screen preview, quick revision, optional details.
- **Operator TUI** — retired as a standalone terminal cockpit (ADR 0005); its operator review, diagnostics, stop controls, and proof/debug work now run through the Studio GUI and the bridge event stream.

Studio and the bridge event stream must preserve the same run truth. Studio should feel like Codex for creative coding.

## Artist-facing run model

The default Studio surface should explain a run in human language:

1. **Brief** — understand the user's creative request without requiring magic words.
2. **Medium** — choose the creative domain or honor explicit user intent such as p5, Hydra, Tone.js, or GLSL.
3. **Generate** — create the first artifact and keep progress visible without turning the page into a dashboard.
4. **Preview** — show the artifact in the same screen, either inline or in the right preview panel. Never substitute a fake fallback.
5. **Revise / Variation / Polish** — let the user keep talking to adjust direction or run deeper quality checks.
6. **Details** — expose receipts, model/provider truth, review packs, and diagnostics only when opened.

## Required cross-surface rules

- **Cancel stops active generation** — `/stop`, GUI Stop, and bridge cancel all terminate the active stream and publish a visible stopped event.
- **Confirm mutates only after review** — `y`, `/confirm`, and GUI Confirm may mutate only when the bridge exposes a pending action.
- **GUI and TUI consume the same bridge events** — both surfaces use the TUI bridge event stream with replayable event IDs and `Last-Event-ID` resume semantics.
- **Prompt beats stale selectors** — explicit user wording such as "p5", "Hydra", or "Tone.js" overrides stale UI mode selections, and the surface must make that override understandable.

## Labels and mental model

- Artist-facing wording is **Generate** for fast draft work and **Polish** for quality-gated proof work.
- Prefer **Brief**, **Medium**, **Generate**, **Preview**, **Reflection**, **Model**, and **Details** over internal words like intent, route, cognition, or runtime.
- Harness/proof wording belongs in receipts, diagnostics, and operator detail; it must not replace the artist-facing creative path.
- Provider/model labels must reflect the actual bridge session role truth, not wrapper or marketing names.
- Proof/review capabilities must remain available, but they should not clutter the default Studio view.

## Preview and microphone baseline

- Studio must keep generated artifacts visible in the same screen. A pop-up alone is not enough.
- p5/Three/GLSL/Hydra/Tone/Strudel-style outputs should either mount in the right preview panel or present a clear same-screen playable/inspectable artifact.
- Microphone preview must show recording/stopped states, sound-derived prompt text or feature fallback, generated synesthetic visual output, and a clear permission-denied message when access is blocked.

## Accessibility and observability baseline

- The GUI must expose skip navigation, current-mode state, polite live status, busy state while a run is active, and reduced-motion handling.
- The TUI must keep all active-run, review, and error transitions visible in text output.
- Both surfaces must make missing previews, cancelled runs, disconnected streams, and pending human review explicit.

## Canonical launch commands

- Studio GUI: `pnpm gui` launches the backend and browser workbench together.
- Backend-only GUI API remains `node gui/start.js` for tests and focused debugging.
- The Bubble Tea operator cockpit and the legacy Ink TUI were retired (ADR 0005); the bridge event stream remains as the operator/agent substrate behind the Studio GUI.

## Current launch-candidate proof

Current tracked proof summary: [docs/launch/launch-candidate-2026-04-30.md](./launch/launch-candidate-2026-04-30.md)

It should include at minimum:

- current commit and PR status summary
- Studio p5 generation + same-screen preview + revision receipt
- final Studio screenshots
- microphone preview smoke receipt
- focused mic/audiosync test output
- remaining honest caveats
