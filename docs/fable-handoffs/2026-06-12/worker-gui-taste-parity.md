# Worker Task — GUI pin/reject taste parity (close the human-signal inlet)

Self-contained. Repo: `~/workspaces/liminal` (Sinter). Forgejo source of truth; land via branch → PR → merge (recipe: rule 6 of `docs/fable-handoffs/2026-06-12/codex-window-tasks.md`).

**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Problem (evidence, 2026-06-12)

The taste-learning loop currently trains on ZERO human signal. Proof chain:
- `sinter preferences train` reports `Preference events: 0`; all 418 training pairs are `score-gap` auto-feed pairs derived from the evaluator's own scores (`src/learning/PreferenceDatasetBuilder.ts` ~line 134, the "Auto-feed (audit F7)" block). The "taste model" biasing garden replay is a judge distillation, not taste.
- The ONLY production caller of `TasteLearningService.recordPreference` is the retired TUI path: `src/tui-bridge/TuiBridgeService.ts:1538` inside `recordReviewPreference(sessionId, action: 'pin'|'reject', artifactId)` (line ~1529), reached only via `/pin` / `/reject` bridge commands (lines ~1171-1204) which are gated on `this.reviewManager` candidates.
- The GUI (`gui/src/App.tsx`) has NO taste actions — its "Reject" button (line ~1802) is merge-proposal dismissal (`setMergeProposal(null)`), purely local state.

ADR 0005 names "GUI Review pin/reject parity" as the TUI retirement gate. This task is that parity, scoped minimally.

## Goal

1. **Bridge:** add an ungated preference command so the GUI can record taste for ANY artifact id (archive/showcase entries are not reviewManager candidates). In `TuiBridgeService`'s command dispatch (same block as `/pin`, ~line 1188): add `/taste <pin|reject> <artifactId>` → validate action ∈ {pin, reject} and artifactId non-empty → call `this.recordReviewPreference(sessionId, action, artifactId)` directly (NO reviewManager gating) → emit a `review.preference_recorded` event `{type, sessionId, action, artifactId, saved}` and a command response stating saved/unavailable. Do not modify the existing `/pin`//`/reject` semantics.
2. **GUI:** in the Showcase / archive-tops view (`gui/src/App.tsx` + relevant view component under `gui/src/`), add two small actions per displayed artifact: "Pin" and "Reject" (taste), sending the `/taste pin <id>` / `/taste reject <id>` command over the existing bridge session (`useTuiBridgeSession.ts` — reuse whatever send-command mechanism the chat/bench input uses). Show a transient confirmation from the command response. Follow repo a11y rules (focusable buttons, aria-labels naming the artifact, `:focus-visible`).

## Hard constraints

1. ISOLATED worktree; NEVER `git checkout` in the main checkout (live daemon + an active agent's feature branch live there):
   ```
   cd ~/workspaces/liminal && git fetch origin
   git worktree add .claude/worktrees/gui-taste-parity -b codex/gui-taste-parity origin/main
   cd .claude/worktrees/gui-taste-parity
   ```
2. Touch ONLY: `src/tui-bridge/TuiBridgeService.ts` (one new command block), `gui/src/**` (buttons + send + minimal styles), and tests for both. Do NOT touch `src/core/**`, `src/llm/**` (another agent's active lane), the daemon, vitest thresholds, `~/.sinter`.
3. Test rules are mandatory (CLAUDE.md): vi.hoisted for mock vars, exact-value assertions, error path (e.g. `/taste pin` with missing artifactId → usage response; preference service unavailable → `saved:false` path).
4. Never weaken/skip a failing check; blocked → append findings to `docs/fable-handoffs/2026-06-12/codex-findings.md` and stop.

## Acceptance (paste outputs in PR body)

1. Unit tests: bridge `/taste` command — records via TasteLearningService (mock at the service boundary), emits `review.preference_recorded`, handles missing args and service-unavailable. GUI component test if the repo has GUI tests (check `gui/` for vitest config; if none, skip GUI unit tests and say so).
2. `pnpm typecheck` and `pnpm build` green; GUI build green (check `gui/package.json` for its build script, e.g. `cd gui && pnpm build`).
3. `pnpm exec vitest run test/unit/tui-bridge --coverage.enabled=false` (or the bridge's actual test path) green.
4. END-TO-END PROOF (no LLM cost): from the worktree run the bridge-level flow via the unit/integration test OR a small script invoking `TasteLearningService.recordPreference` through the bridge handler with a real temp SinterFS dir, then assert a preference event artifact exists and `trainFromProject()` reports `preferenceEventCount >= 1`. Paste the evidence.
5. PR to main via Forgejo, merge, verify ancestor, remove worktree + branch. Append outcome to `codex-findings.md` under `## GUI TASTE PARITY`.
