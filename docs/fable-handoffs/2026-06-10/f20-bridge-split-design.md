# Design — F20: TuiBridgeService split (3,634 LOC → service + command modules + presentation)

**Status:** Fable design, 2026-06-11. Implementation = Handoff 12. Do not start while Handoff 11 is unmerged if it touches bridge files (it shouldn't — it owns RalphLoop/archive).

## Measured shape (the evidence for the seams)

| Region | Lines | Responsibility |
|---|---|---|
| 222–523 | ~300 | Session/run lifecycle: create/status/events, run transitions, emit helpers — **the service's actual identity** |
| 524–883 | 359 | `submitInput` — generation orchestration entry |
| 883–1010 | ~130 | Pending-action confirm/cancel |
| 1011–2681 | **~1,670** | 22 `handle*Command` methods — slash-command logic (`handleCortexCommand` alone = 989 lines) |
| 1454–1573 | 119 | Lazy service accessors + hydration (GoalStore, EmergenceHooks, SinterFS, TasteLearningService) |
| 2681–2952 | ~270 | Draft/stream/live-session plumbing |
| 2952–3634 | ~680 | Creative presentation: intent brief, preference guidance, preview HTML, progress/phase mapping — mostly pure functions |

Nearly half the file is a command router that grew inline. The `endpoints/` subdir already establishes the extraction convention.

## Target structure

```
src/tui-bridge/
  TuiBridgeService.ts        # lifecycle + submitInput + actions (~1,100 lines)
  commands/
    CommandRouter.ts          # input → handler dispatch (the existing if/else chain, verbatim)
    BridgeCommandContext.ts   # interface: emitCommandResponse, updateStatus, accessors — what handlers may touch
    CortexCommands.ts         # 989-line handler, moved whole
    GoalCommands.ts
    WorkspaceCommands.ts      # workspace + sessions + report + mode + autonomy (small ones grouped)
  CreativePresentation.ts     # pure helpers from 2952–3634 (intent brief, preference lines, preview html, phase map)
  BridgeServices.ts           # lazy accessors + hydrateLatestTasteModel + ensureSessionsHydrated
```

## Rules that make this safe

1. **Move, don't rewrite.** Method bodies are relocated verbatim; only `this.X` references become `ctx.X`/imports. Any "improvement" is a defect in this lane.
2. **One module per commit**, each ending green (`pnpm typecheck` + bridge unit tests + `pnpm check:orphans`).
3. **Extraction order by risk:** (1) `CreativePresentation.ts` (pure functions, zero state), (2) `BridgeServices.ts`, (3) `CortexCommands.ts`, (4) remaining command modules + router. Stop at any red step.
4. **No public API change:** `TuiBridgeService`'s exported surface (constructor, createSession, submitInput, confirmAction, cancelAction, cancelRun, emit*) stays byte-compatible — `TuiBridgeServer.ts` and the Go TUI must not notice.
5. Integration-first: each new module is imported by the service in the same commit that creates it (the orphan gate enforces this anyway).

## Why this is worth doing now

Every taste/cortex/goal feature lands more lines in this file; three agents have collided in it before (it's the #1 split candidate in the design-debt inventory). Post-split, command features become append-a-module instead of grow-the-monolith — and the 989-line cortex handler becomes independently testable.

## Out of scope

Behavioral fixes discovered during the move (file them as findings), endpoint modules (already extracted), the Go side, session-store changes.
