# Worker Task — Self-improve ledger observability (admissions, floors, dirty-tree truth)

Self-contained. Repo: `~/workspaces/liminal` (product = Sinter). Forgejo is source of truth; main is branch-protected — land via branch → PR → merge (recipe: rule 6 of `docs/fable-handoffs/2026-06-12/codex-window-tasks.md`).

**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Problem (evidence-backed, 2026-06-12)

The self-improve daemon (`com.sinter.self-improve`) runs `scripts/quality/self-improve-cycle.mjs` every ~20 min and appends one record per cycle to `docs/validation/self-improve-ledger.jsonl`. The QualityArchive (`~/.sinter/archive/quality_archive.json`) is a rolling top-20 per domain — `QualityArchive.add()` in `src/learning/QualityArchive.ts:180` sorts by `qualityScore` desc and slices to 20, so new entries DISPLACE weaker ones.

All 10 domains are at cap (200 total). Consequences:
1. The ledger's `archiveDelta` is permanently `0` even when admissions happen. Proven: archive entry timestamps `2026-06-12T05:27` (hydra), `06:52` (svg), `07:44` (ascii) landed during cycles whose ledger records say `Δ+0`. The loop's actual learning signal (rising per-domain floors via displacement) is invisible.
2. The ledger's `codeSha` records `git rev-parse HEAD` but the daemon builds dist from the working tree, which today has uncommitted `src/` edits on a feature branch — the recorded sha implies code that is NOT what ran.

## Goal

Each ledger record additionally reports:
- `admitted` (int): how many of this cycle's generations ended up in the archive. Compute by diffing per-domain entry-id sets of the archive file read BEFORE vs AFTER the cycle's generations (read-only reads; the archive file is already read by the script via `readPerDomainCounts`).
- `floors` (object): per-domain min `qualityScore` after the cycle, rounded to 3dp. Also `tops`: per-domain max, 3dp.
- `dirty` (bool): `git status --porcelain` non-empty at cycle start.
- `branch` (string): `git branch --show-current` at cycle start.

Implement the before/after diff as a PURE exported helper in `scripts/quality/self-improve-domains.mjs` (e.g. `diffArchiveAdmissions(beforeArchives, afterArchives) -> { admitted, admittedIds, floors, tops }`) so it is unit-testable without fixtures touching the real archive.

## Hard constraints

1. Work in an ISOLATED worktree. NEVER run `git checkout` in the main checkout — the live daemon and another agent's dirty feature branch (`feat/generation-craft-contracts`) live there.
   ```
   cd ~/workspaces/liminal && git fetch origin
   git worktree add .claude/worktrees/ledger-observability -b codex/ledger-observability origin/main
   cd .claude/worktrees/ledger-observability
   ```
2. Touch ONLY: `scripts/quality/self-improve-cycle.mjs`, `scripts/quality/self-improve-domains.mjs`, and test files for them (look for existing tests: `rg -l "self-improve-domains" test/`). If no test file exists, create `test/unit/quality/self-improve-domains.test.ts` following repo test rules (vi.hoisted for mock vars; assert exact values, no `toBeDefined()`).
3. Do NOT touch: `src/` (active agent lane), `scripts/quality/self-improve-daemon.sh`, `vitest.config.ts` thresholds, anything under `~/.sinter` (read-only access ONLY), `docs/validation/self-improve-ledger.jsonl` (live daemon file — never commit it).
4. Ledger schema is append-only JSONL consumed by other tooling: ADD fields only; never rename or remove existing fields.
5. Never weaken/skip/silence a failing check. Blocked → append findings to `docs/fable-handoffs/2026-06-12/codex-findings.md` and stop.

## Acceptance tests (run all; paste outputs in the PR body)

1. Unit tests for `diffArchiveAdmissions`: two fixture archive objects where (a) one domain has one entry replaced (same count, different ids) → `admitted: 1`, floors/tops exact; (b) identical input → `admitted: 0`; (c) empty/missing domains → no throw, sane defaults.
2. `node --check scripts/quality/self-improve-cycle.mjs` and `node --check scripts/quality/self-improve-domains.mjs` → pass.
3. `pnpm exec vitest run test/unit/quality --coverage.enabled=false` → green.
4. `pnpm build` → green.
5. Do NOT run a real generation cycle (costs LLM inference). A dry diff against two reads of the real archive file (read-only) showing `admitted: 0` is sufficient runtime proof.

## Land + report

- Push branch, open PR to main via Forgejo API recipe, merge, verify `git merge-base --is-ancestor <sha> origin/main`.
- Append outcome (branch, PR#, verification outputs) to `docs/fable-handoffs/2026-06-12/codex-findings.md` under heading `## LEDGER OBSERVABILITY`.
- Remove the worktree and delete the merged branch.
