# Liminal — Project Instructions

## Mandatory Coding Skill

All coding, review, and refactor work in this repo must follow `karpathy-guidelines`.

If the runtime supports local skills, load and apply `karpathy-guidelines` directly. If it does not, still follow the same rules:
1. Think before coding and surface assumptions/tradeoffs.
2. Prefer the simplest sufficient change.
3. Make surgical edits only.
4. Define concrete verification criteria before claiming success.

## Git Hygiene (mandatory for all agents)

This repo has multiple agents working simultaneously in worktrees. Breaking these rules causes data loss and merge conflicts.

### The 6 Rules

1. **Always push after committing.** Run `git push` immediately after every commit. Unpushed commits on a worktree that gets cleaned up = lost work. No exceptions.
2. **Clean up your worktree when done.** After your work is pushed and/or merged: remove the worktree (`git worktree remove <path>`), delete your local branch if merged, delete remote branch if merged. Never leave idle worktrees behind.
3. **Start fresh branches after merges.** If your branch was merged (squash or otherwise) to main, do NOT continue committing on it. Checkout main, pull, create a new branch. Continuing on merged branches creates divergence.
4. **Check the monitor log.** Before starting work, read `memory/git-monitor-log.md` to see what other agents are doing. Avoid stepping on active worktrees.
5. **Commit incrementally.** Don't let 20+ files sit dirty. Commit in logical batches (every 5-10 files). Large uncommitted diffs make conflict resolution harder.
6. **Clean up stashes at session end.** Git stashes are repo-global (not per-worktree). Test runners using `auto-stash` pile up fast — 90+ stashes from a single test session is typical. Before closing a session: `git stash list` → drop all `liminal: auto-stash` entries with `git stash drop stash@{N}`. Keep only stashes with meaningful WIP. If the stash list exceeds 10 entries, it's overdue for cleanup.

### Parallel Agent Isolation (mandatory)

When launching 2+ agents for parallel work, you MUST use the /team skill:
```
/oh-my-claudecode:team "description of parallel work"
```

`/team` creates isolated git worktrees per worker and handles merging.
Never launch 2+ parallel Task() calls directly — they share the working directory and will collide.

Single-agent tasks (one-off investigation, single-file edits) may use Task() directly.

### Convention Violation Monitor

A cron job scans every 5 minutes and logs violations to `memory/git-monitor-log.md`. Violations are flagged as:
- **HIGH** — Data loss risk (unpushed work, diverged branches)
- **MEDIUM** — Hygiene (idle worktrees, main behind remote)
- **LOW** — Naming, stale branches

If you see your worktree flagged, fix it immediately.

## Test Quality Standards (mandatory for all agents)

Every test file written or modified MUST meet these standards. No exceptions.

### The 7 Rules

1. **Assert outcomes, not process.** Test what the code *returns/does*, not which internal functions it calls. `expect(result.score).toBe(0.8)` not `expect(mockFn).toHaveBeenCalled()`.

2. **No `toBeDefined()` / `toBeTruthy()` / `toBeGreaterThan(0)` alone.** Every assertion must check a specific expected value or a tight range. If you can't name the expected value, the test isn't testing anything.

3. **`vi.hoisted()` is mandatory** for any mock variable referenced inside `vi.mock()` factories. Vitest hoists `vi.mock()` above all `const` declarations — plain variables cause `ReferenceError: Cannot access before initialization`.

4. **Mock at boundaries, not internals.** Mock external deps (LLM APIs, filesystem, network). Never mock the module under test. If you're mocking 5+ internal modules, the test proves nothing — refactor to test at a higher level.

5. **Mock API contracts must match reality.** `rateLimiter.execute()` returns `{ result: T }`, not `T`. `telemetryWrapper.wrap()` calls `tool.execute(params)`. A mock that returns the wrong shape passes tests but proves nothing.

6. **Test error paths, not just happy paths.** Every module must have at least one test for: empty input, null/undefined, thrown errors, failed operations. If only happy-path tests exist, the file is WEAK.

7. **Integration tests must integrate.** A file in `test/integration/` must exercise ≥2 real modules together with real data flowing between them. Tests that import a single module and call it in isolation are unit tests — put them in `test/unit/`.

### Test Quality Ratings

| Rating | Meaning | Action |
|--------|---------|--------|
| GOOD | Behavioral assertions, real data flow, error paths covered | Ship it |
| ADEQUATE | Tests real behavior but gaps in assertions or error paths | Fix before merge |
| WEAK | Tests private methods, over-mocked, trivial assertions | Rewrite required |
| PADDING | Only constructor + report tests | Do not commit |

### Coverage Target (MANDATORY — all agents)

**Target: 70% coverage across all 4 metrics.**

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Statements | 67.4% | 70% | -2.6pp |
| Branches | 57.3% | 70% | -12.7pp |
| Functions | 68.2% | 70% | -1.8pp |
| Lines | 68.2% | 70% | -1.8pp |

*(Current values auto-update via the ratchet. This table reflects the gap at ratchet start.)*

**Rules:**
1. Every new `src/` file MUST include a corresponding test file. Zero-coverage files are CI failures.
2. Every PR that modifies `src/` code MUST not decrease coverage. The ratchet enforces this.
3. When writing tests, target the 70% threshold — not the current ratchet floor. Write tests that move the needle.
4. Priority modules for coverage investment: `src/music/`, `src/plugins/`, `src/config/`, `src/generators/` — these have the largest gaps.
5. `toBeDefined()` usage MUST stay below 5% of total assertions per file. Use `toBe(expectedValue)` or `toEqual(expectedShape)` instead.
6. The ratchet (`autoUpdate` in `vitest.config.ts`) is the enforcement mechanism. **Never manually lower thresholds.** They only go UP.

**Quality checker** (`pnpm test:quality`) enforces: vi.hoisted compliance, no weak assertions, no padding tests.
**CI pipeline** (`.github/workflows/ci.yml`) enforces: coverage ratchet, quality checker, coverage gap detection.
**Pre-commit hook** (`.githooks/pre-commit`) enforces: related-file tests pass before commit.

### Enforcement

- **ESLint custom rules** in `eslint-rules/` catch `vi.hoisted` violations and weak assertions at lint time
- **Vitest coverage ratchet** (`autoUpdate: true` in `vitest.config.ts`) ensures coverage only goes UP
- **Pre-commit hook** (`.githooks/pre-commit`) runs `vitest --related` for staged source files
- **Quality checker** (`scripts/testing/test-quality-check.mjs`) enforces assertion quality standards
- **CI coverage gate** (`scripts/ci/check-coverage-gaps.ts`) blocks on zero-coverage files

## Archaeology — MOVED TO SEPARATE REPO

The archaeology pipeline has been extracted to **`dev-archaeology`** (private repo).
- **Repo:** `~/workspaces/dev-archaeology/`
- **GitHub:** `https://github.com/Pastorsimon1798/dev-archaeology`
- **Liminal data:** `projects/liminal/` inside that repo

**DO NOT** create archaeology files, run archaeology scripts, or reference `narrative/data/` in this repo. All archaeology work happens in `dev-archaeology`.

The `narrative/` directory has been removed. Git history is preserved on the `narrative/liminal-archaeology` branch.

## Integration-First Rule (mandatory for all agents)

1. No new module may be created without a specific call site in the existing CLI or loop.
2. Every task must end with a verifiable CLI command or test run.
3. Orphaned files (created but never imported) are defects — the pre-commit hook blocks them.
4. Prefer surgical edits to existing files over creating new files.
5. Before claiming completion, run the verification command and show the output.
