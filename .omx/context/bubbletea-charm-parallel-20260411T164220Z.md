# Context Snapshot

## Task statement
Use a coordinated team to continue Bubble Tea Charm adoption in parallel from the `fix/bubbletea-operator-surface` worktree.

## Desired outcome
Parallelize the next safe, independent implementation slices after the first shipped progress-bar slice.

## Known facts
- First slice already landed in worktree only: task progress bar + generation progress card.
- Bubble Tea tests currently pass.
- User explicitly requires color and beauty to remain central.
- Candidate touchpoints are in `bubbletea/internal/app/*` and `bubbletea/internal/ui/theme.go`.

## Constraints
- Keep worktree isolated.
- Preserve aesthetics.
- Avoid overlapping write scopes when possible.
- Use tests before code for behavior changes.

## Unknowns
- Exact shape of textarea integration in current input flow.
- Whether list/table scaffolding should fully land this round or be partially staged.

## Likely touchpoints
- `bubbletea/internal/app/model.go`
- `bubbletea/internal/app/update.go`
- `bubbletea/internal/app/view.go`
- `bubbletea/internal/app/layout.go`
- `bubbletea/internal/ui/theme.go`
- `bubbletea/internal/app/operator_surface_test.go`
- docs updates
