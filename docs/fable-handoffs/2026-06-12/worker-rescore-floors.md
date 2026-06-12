# Worker Task — Quantify archive floor inflation (bottom-2 re-score, read-only)

Self-contained. Repo: `~/workspaces/liminal` (Sinter). Forgejo source of truth; land via branch → PR → merge (recipe: rule 6 of `docs/fable-handoffs/2026-06-12/codex-window-tasks.md`).

**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Problem (evidence, 2026-06-12)

The QualityArchive (`~/.sinter/archive/quality_archive.json`) admits by displacement: rolling top-20 per domain sorted by `qualityScore`. Stored scores predate the banded-rubric judge (PRs #22–#24) and are inflated (measured: stored 0.95 → fresh 0.85). Degenerate distributions prove it: kinetic floor=max=0.85 (all 20 entries identical), tone floor 0.9/max 1.0, strudel max 1.0. Inflated FLOORS gatekeep admission — fresh honest scores (e.g. ascii 0.72 vs floor 0.82 at the 08:09Z cycle) may be losing to stale optimism, suppressing real improvements.

`scripts/quality/rescore-tops.mjs` (PR #27, `pnpm quality:rescore`) re-scores only the TOP-2 per domain. Floors are what gate admission.

## Goal

Extend `scripts/quality/rescore-tops.mjs` with a `--floors` flag: for each visual domain (p5, glsl, three, hydra, svg, ascii, textgen, kinetic), take the BOTTOM-2 non-quarantined entries by stored `qualityScore`, re-render via `dist/render/HeadlessRenderer.js` `renderWithEvidence(entry.output, {domain})`, re-score via `dist/core/ScoringEngine.js` `scoreRenderedEvidence`, print one JSON line per entry: `{id, domain, position: "floor", stored, fresh, delta}`. Default (no flag) behavior unchanged (top-2). READ-ONLY — never mutate the archive or any `~/.sinter` file.

## Hard constraints

1. ISOLATED worktree; NEVER `git checkout` in the main checkout (live daemon + an active agent's dirty feature branch live there):
   ```
   cd ~/workspaces/liminal && git fetch origin
   git worktree add .claude/worktrees/rescore-floors -b codex/rescore-floors origin/main
   cd .claude/worktrees/rescore-floors && pnpm build
   ```
2. Touch ONLY `scripts/quality/rescore-tops.mjs` (+ package.json IF adding a `quality:rescore:floors` script alias — optional).
3. Do NOT touch `src/`, the daemon, vitest thresholds, ledger, `~/.sinter` (reads only).
4. The run costs ~16 cloud evaluator calls — run the floors report exactly ONCE.
5. Never weaken/skip a failing check; blocked → write to `codex-findings.md` and stop.

## Acceptance

1. `node --check scripts/quality/rescore-tops.mjs` → pass.
2. Default top-2 mode still works structurally (no behavior change; verify by code path, do NOT re-run the paid top-2 report).
3. `pnpm quality:rescore -- --floors` (or `node scripts/quality/rescore-tops.mjs --floors`) → 16 JSON lines, no exceptions. Capture ALL 16 lines.
4. Append the full 16-line output + a 3-sentence summary (mean delta, worst domain, whether floors are inflated) to `docs/fable-handoffs/2026-06-12/codex-findings.md` under `## FLOOR RESCORE`.
5. PR to main via Forgejo, merge, verify ancestor, remove worktree + branch.
