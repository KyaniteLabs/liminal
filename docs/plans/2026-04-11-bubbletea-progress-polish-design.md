# Bubble Tea Progress Polish Design

## Context
Liminal's Bubble Tea operator surface already exposed task cards, timelines, changed files, verification jobs, artifacts, and shortcut help, but it still lacked a strong sense of live motion and progress. The right column was informative yet visually flatter than the rest of Liminal's terminal identity.

## Intent
Add the first Charm/Bubbles-driven polish slice without destabilizing the bridge or interaction model:
- keep the current operator layout intact
- add visible progress instrumentation
- preserve color and beauty as a product requirement, not a later pass

## Chosen Slice
Use `charmbracelet/bubbles/progress` to add:
1. a colorful task-progress bar inside the task card
2. a dedicated generation-progress card that surfaces model, score, duration, and progress percentage

## Why This Slice First
- It is visually obvious immediately
- It strengthens operator awareness without changing command semantics
- It introduces another Bubbles primitive with low risk
- It creates a reusable pattern for later list/table/textarea enhancements

## Files
- `bubbletea/internal/app/layout.go`
- `bubbletea/internal/app/operator_surface_test.go`
- `bubbletea/internal/ui/theme.go`
- `bubbletea/go.mod`
- `bubbletea/go.sum`

## Verification
- Add failing tests for visible progress copy (`Progress`, percentage, `Generation` card)
- Run `go test ./... -count=1` inside `bubbletea/`
