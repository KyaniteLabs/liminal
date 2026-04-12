# Stash `stash@{0}` Forensic Rescue

Date: 2026-04-12
Branch: `rescue/stash0-20260412`

## Goal

Preserve unique, low-conflict value from `stash@{0}` without touching the live
`fix/tui-main-integration` worktree or rewriting active developer branches.

## Inputs Compared

- `stash@{0}`
- `origin/main`
- `fix/tui-main-integration`
- open salvage lane `#148`

## Findings

- The stash contained 25 files.
- Most bridge/runtime orchestration files overlapped `#139`.
- `src/harness/prompts/self-improve.ts` overlapped `#148`.
- A smaller set of files remained uniquely valuable and low-conflict.

## Rescued Now

- `bin/liminal`
- `bubbletea/go.mod`
- `bubbletea/internal/app/model.go`
- `bubbletea/internal/app/view.go`
- `bubbletea/internal/ui/theme.go`
- `bubbletea/main.go`
- `src/core/validators/RevideoValidator.ts`
- `src/generators/GeneratorHarnessTools.ts`
- `src/generators/remotion/RemotionGenerator.ts`
- `src/harness/tools/index.ts`
- `src/harness/tools/types.ts`

## Intentionally Not Rescued

These remain forensic-only because they overlap the live `#139` lane or would
risk overwriting active owner work:

- `src/tui-bridge/TuiBridgeService.ts`
- `src/tui-bridge/TuiBridgeServer.ts`
- `src/harness/agent/LLMModeAgent.ts`
- `src/harness/prompts/self-improve.ts`
- `scripts/start-bubbletea-tui.mjs`
- `bubbletea/internal/app/update.go`
- `memory/git-monitor-log.md`

## Rationale

- Rescue only hunks that are both unique and low-conflict.
- Do not re-import the broad bridge/runtime snapshot while another agent is
  actively moving `#139`.
- Bubble Tea UI polish and Revideo contract hardening are valuable even without
  the overlapping runtime work.
