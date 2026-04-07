# TUI Lip Gloss Recovery Design

## Context
The Lip Gloss / Bubble Tea aesthetic plan that once lived under `docs/TUI_AESTHETIC_IMPROVEMENT_PLAN.md` and companion Bubble Tea planning artifacts disappeared from the current branch, leaving the TUI operator guidance incomplete. The 2026-04-06 Bubble Tea execution/migration/priority/remediation documents captured the safety-first path toward the operator-grade shell, so recovering them preserves the documented intent.

## Objectives
1. Restore the Lip Gloss aesthetic guidance so readers can see the shell principles, MVP layout, and semantic states.
2. Recover the Bubble Tea execution, migration, priority, and remediation plans to preserve the safe migration narrative.
3. Record this recovery in a short design artifact that explains why the docs were reintroduced and what still needs attention.

## Approach
1. Re-create the five plan documents exactly as they existed in commit `0b8cc6c61d12f9470bbff86a89140889002a3546` (extracted text is embedded verbatim to avoid drift).
2. Add `docs/plans/2026-04-07-tui-lipgloss-recovery-design.md` so future agents know the restoration was intentional and tied to the operator-grade aesthetic plan.
3. After the restore, confirm `git status` shows the new/updated plan files plus the new design doc, then run targeted lint/format (if any) only if the docs include formatting requiring it (none here).

## Verification
- `git status` should show the five recovered docs and the new design doc as tracked files.
- Quick spot check of the key files (header, key sections) should match the extracted text from commit `0b8cc6c6`.
