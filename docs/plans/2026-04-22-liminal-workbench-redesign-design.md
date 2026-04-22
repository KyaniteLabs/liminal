# Liminal Workbench Redesign Design

**Goal:** Replace the current merged-app GUI shell with a professional creative coding workbench that makes generation, preview, evaluation, and system state feel like one instrument.

**Architecture:** The browser GUI should be reorganized around one creation workspace: prompt and controls, live canvas, generation timeline, artifacts, and role/system inspector. Existing backend routes and TUI bridge events stay in place; this is a front-end integration and design-system repair first, not a rewrite of generation logic.

**Tech Stack:** React, Vite, existing Express GUI backend, existing TUI bridge HTTP/SSE events, Playwright screenshot verification.

---

## Current Evidence

- Screenshot evidence: `.omx/proof/gui-design-review/current-home.png` and `.omx/proof/gui-design-review/current-mobile.png`.
- The GUI package is still named `atelier-gui`, which preserves pre-merge product identity.
- The app shell is a top tab list: `Config`, `Create`, `Cockpit`, `Live organism`, `Live Music`, `Curator`, `Activity`, `Compost`.
- The visible default screen is a settings form, so the first impression is administration, not creation.
- The design system is dominated by `atelier-*` tokens with a dark brown/gold palette, narrow centered layout, serif display type, and repeated cards.
- Legacy `atelier` config paths are valid compatibility surfaces, but they are mixed with current product identity and comments.

## Product Target

The GUI should become **Liminal Studio**, a professional creative coding workbench. It should feel closer to a creative tool than a web form: canvas first, dense but readable controls, visible progress, and an operator-grade system model. The interface should convey that Liminal is generating code, rendering artifacts, evaluating the result, and learning from the process.

## Layout Model

Desktop layout:

- **Top command bar:** product identity, connection state, generator/evaluator badges, prompt command input, run/stop controls.
- **Left rail:** workspace mode, artifacts, projects, domains, and compact navigation.
- **Center stage:** live preview/canvas with generated code/result tabs available as secondary views.
- **Right inspector:** role config, evaluator vision status, Cortex/Gardener status, trust/provenance, render health.
- **Bottom timeline:** domain plan, attempts, candidate receipts, validations, errors, ETA, artifact creation.

Mobile layout:

- Command bar remains at top.
- Center stage comes first.
- Inspector, timeline, and artifacts become segmented lower panels.
- Settings move into a drawer or route, never the default first screen.

## Navigation Model

Replace the current top-level tab pile with modes inside one workbench:

- **Generate:** prompt, run controls, canvas, timeline.
- **Review:** candidate/artifact comparison, curator controls.
- **Evolve:** compost, seeds, recombination, lineage.
- **Observe:** activity log, Cortex, Gardener, provider health.
- **Settings:** generator/evaluator roles, loop thresholds, gallery path.

The initial screen should be Generate.

## Visual System

Rename design tokens away from `atelier-*` toward `liminal-*` or `studio-*`.

Target palette:

- `bg-void`: near-black neutral, not brown.
- `surface-1`, `surface-2`, `surface-3`: layered graphite/ink neutrals.
- `signal-cyan`: generation/progress.
- `signal-violet`: creative/artifact domain.
- `signal-orchid`: evaluation/vision.
- `signal-green`: success.
- `signal-amber`: warning or primary action only.
- `signal-red`: failure/destructive state.

Typography:

- Use a modern sans for product UI.
- Use monospace for code, event names, paths, model ids, and timing.
- Avoid large serif branding and marketing-style copy in the workbench surface.

Shape and density:

- Cards only for repeated items, modals, and true panels.
- Avoid card-inside-card.
- Use full-height panes, compact headers, resizable or responsive grid tracks.
- Keep buttons and controls predictable and dense enough for repeated creative work.

## Observability And Motion

Motion must describe real process state:

- Progress pulse while waiting on provider.
- Candidate receipt animation when code arrives.
- Timeline ticks for attempt started, candidate generated, validation, evaluation, artifact saved.
- ETA updates from elapsed timeout metadata.
- Inline preview should show latest artifact or a clear empty state with next expected event.

No fake success animation. No decorative movement that does not map to process state.

## Integration Debt Policy

Compatibility surfaces may remain:

- `~/.atelier/config.json` migration.
- `config/atelier.json` fallback.
- `ATELIER_CONFIG_PATH` fallback.

But current product identity should not use `atelier`:

- Package name.
- CSS tokens/classes.
- UI copy.
- Default docs for current GUI.

Compatibility comments should explicitly say “legacy Atelier compatibility.”

## Acceptance Criteria

- First viewport shows a live creative workbench, not a config form.
- A user can type a prompt and see model roles, current phase, timeline, and preview in one screen.
- Generator/evaluator role split remains visible and configurable.
- Cortex/Gardener/system state remains visible but explained and visually integrated.
- `atelier-*` design tokens are removed or compatibility-wrapped; no user-facing “Atelier” naming remains outside legacy docs.
- Desktop and mobile screenshots pass visual QA.
- No regression to bridge generation, config save, preview routes, or existing security tests.
