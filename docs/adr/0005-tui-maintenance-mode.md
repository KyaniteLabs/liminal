# ADR 0005 — TUI enters maintenance mode; the Studio GUI is the product surface

**Status:** Accepted (Simon, 2026-06-11)
**Context:** docs/validation/product-ux-audit-2026-06-11.md

## Decision

Sinter keeps ONE invested user surface: the **Studio GUI** (plus the CLI, which is the operator/agent substrate and is not in question). The **Bubble Tea TUI** (Go binary + bridge launcher path + Ink fallback) enters **maintenance mode**: it stays functional as-is, receives fixes only for outright breakage, and receives no new features, no UX investment, and no refactoring.

## Why

1. The product's output is visual/audio — a terminal cockpit categorically cannot display the work. The archive is now A-grade and composable; only the GUI can show it.
2. Every TUI job has a better home: loop operation is CLI (how the daemon/agents drive it); taste curation (pin/reject) belongs where the art is visible.
3. Cost asymmetry: the TUI is the most expensive surface per user reached — Go toolchain dependency, dedicated bridge launcher, `TuiBridgeService` (3.6k lines), Ink fallback, ~90s cold start. Every UX fix would be built twice.
4. TELOS fit: public proof, demos, and accessibility-by-default are GUI-shaped.

## Consequences

- **F20 (split TuiBridgeService) is retired, not split** — the register row closes as obsoleted by this ADR. (The bridge server itself still backs parts of the GUI/agents; only the split-for-the-TUI's-sake refactor dies.)
- The product-UX audit's TUI P0s (Go-missing crash, rebuild-on-launch) are downgraded to documentation: "requires Go; first launch builds (~90s)". No code is fixed on a frozen surface.
- No code is deleted now (repo rule: unfinished ≠ orphaned; the surface still works for those who use it).
- **Retirement gate:** when the GUI Review tab has pin/reject parity (the TUI's one exclusive feature), the Go TUI + its launcher path may be removed in a dedicated PR.
- Entry points print a one-line maintenance notice; help text tags the commands.

## What future agents must NOT do

Add TUI features; "fix" TUI UX findings; split TuiBridgeService for the TUI's sake; treat the maintenance notice as a bug.
