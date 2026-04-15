# PRD: Bubble Tea Charm Operator Surface Parallel Implementation

## Problem
Liminal's Bubble Tea surface is functional but underpowered as an operator console. It needs richer Bubbles-based interaction primitives, stronger Lip Gloss design semantics, and preserved visual beauty while staying safe and testable.

## Outcome
Deliver the next parallelizable Bubble Tea polish slices after the already-landed progress instrumentation:
1. richer multiline input via Bubbles textarea
2. better operator selection/state browsing via Bubbles list/table scaffolding where appropriate
3. refined colorful visual semantics for operator cards, panes, and input focus
4. docs updated to reflect reality

## Constraints
- Preserve Liminal's color and beauty; do not flatten into generic admin UI.
- Keep diffs small and reversible.
- Work inside the Bubble Tea feature worktree.
- No new non-Charm dependencies.
- Maintain confirmation-first operator UX.

## Parallel lanes
- Lane A: Input UX / textarea integration
- Lane B: Visual system polish / Lip Gloss semantic refinement
- Lane C: Docs + verification support for the new surface

## Initial touched files
- bubbletea/internal/app/model.go
- bubbletea/internal/app/update.go
- bubbletea/internal/app/view.go
- bubbletea/internal/app/layout.go
- bubbletea/internal/ui/theme.go
- bubbletea/internal/app/operator_surface_test.go
- docs/visual-bible.html
- docs/THE_BIBLE.md
