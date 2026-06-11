# Handoff 12 — F20: execute the TuiBridgeService split

**Mode:** Refactor, behavior-preserving. Isolated worktree branch. The design contract is `docs/fable-handoffs/2026-06-10/f20-bridge-split-design.md` — read it first and follow its target structure, extraction order, and rules verbatim.

## Purpose

`src/tui-bridge/TuiBridgeService.ts` is 3,634 lines; ~1,670 of them are 22 inline `handle*Command` methods (`handleCortexCommand` alone is 989). Split per the design so command features stop growing the monolith.

## Hard constraints

1. **Move, don't rewrite** — bodies relocated verbatim; only `this.` → `ctx.`/import rewiring. Zero behavioral change.
2. **One module per commit**, each commit green: `pnpm typecheck && pnpm lint && pnpm check:orphans && pnpm exec vitest run test/unit/tui-bridge --coverage.enabled=false` (locate the bridge tests first; if they live elsewhere, run that path).
3. **Extraction order:** CreativePresentation → BridgeServices → CortexCommands → router + remaining command modules. Stop at any red step and report.
4. **Public surface frozen:** anything `TuiBridgeServer.ts` or the endpoints/Go TUI call must keep its exact signature on the service.
5. Coverage ratchet: net coverage must not drop (moved code keeps its tests passing; if a module ends up with zero direct coverage, the CI gap checker will flag — add a thin smoke test for the router dispatch only, not new behavior tests).

## Definition of done

`TuiBridgeService.ts` ≤ ~1,200 lines; new modules under `src/tui-bridge/commands/` + `CreativePresentation.ts` + `BridgeServices.ts`, each imported by the service in its creation commit; all commands behave identically (spot-proof: `pnpm tui:bridge` boots and `/cortex status`, `/goal list`, `/mode` respond as before — capture the transcript).

## What not to touch

`src/core/` (Handoff 11's lane), `endpoints/`, `TuiSessionStore.ts`, the Go `bubbletea/` side, behavior of any command.

## Final report format

```
COMMITS: <one line each + green-gate proof per commit>
LINES: <TuiBridgeService.ts before/after, per-module sizes>
SMOKE: <bridge boot + 3-command transcript>
FINDINGS: <any behavioral oddities discovered but NOT fixed>
```

Stop and ask if any handler turns out to share mutable private state with submitInput beyond the context interface — that's a seam error in the design, not something to hack around.
