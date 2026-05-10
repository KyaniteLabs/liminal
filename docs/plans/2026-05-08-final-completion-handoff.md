# Final Completion Handoff Implementation Plan

**Goal:** Give the next agent a durable, evidence-backed plan for finishing the launch-blocker audit and completion work without pretending unfinished work is done.

**Architecture:** Treat this file as the handoff source of truth. Start from the canonical checkout, verify the current baseline, then work through small PRs: gate repair, proof refresh, final audit documentation, any new material fixes, and closure verification.

**Tech Stack:** Liminal repo, pnpm scripts, GitHub PRs, Electron Studio, existing final QA docs, existing proof receipts.

---

## Current Baseline

- Canonical checkout: derive with `git rev-parse --show-toplevel`; all paths below are repo-relative.
- Branch: `main`
- Current commit when this plan was written: `366d1c5062714cd321f9d42c5501c270b8bbc5e0`
- Local state when this plan was written: clean, `main...origin/main`
- Open PRs when checked: none
- Prior final QA audit folder: `docs/audits/final-qa-2026-05-06/`
- New final-completion audit folder: not created yet

## Explicitly Unfinished Work

This is the important part. Nothing below may be reported as complete until it has been implemented, verified, committed, pushed, reviewed if required, merged, and rechecked on `main`.

1. The final completion audit folder does not exist yet.
   - Required path: `docs/audits/final-completion-2026-05-08/`
   - Required files: `README.md`, `findings-ledger.md`, `verification-log.md`, `operator-journey-matrix.md`, `handoff-status.md`

2. `pnpm final-qa:test-quality` is failing.
   - Current failure: 4 new strict test-quality warnings.
   - Failing assertions:
     - `test/unit/core/ScoringEngine.test.ts:997`
     - `test/unit/core/ScoringEngine.test.ts:1149`
     - `test/unit/core/ScoringEngine.test.ts:1167`
     - `test/unit/generators/registerGenerators.test.ts:273`
   - Required fix: replace weak `not.toBeNull()` assertions with specific assertions that prove the expected value or shape.

3. `pnpm final-qa:surface` is failing.
   - Current failure: stale live creative-domain receipt.
   - Receipt path: `.omx/proof/domain-gauntlet-live.json`
   - Receipt commit: `c2c0eee3e92dc780a6965caa5b68692106c9eaa4`
   - Current commit: `366d1c5062714cd321f9d42c5501c270b8bbc5e0`
   - Required fix: rerun the live creative-domain proof on current `main` when provider credentials are configured.

4. The final launch-blocker re-audit has not been performed after commit `366d1c50`.
   - Required surfaces: Electron Studio, creative generation completion, shader generation, timeout/retry behavior, fallback behavior, provider failure visibility, stop/cancel, preview, TUI bridge, Bubble Tea if launch-relevant, proof scripts, launch claims, skipped/gated tests.
   - Required output: any new material issues must become `FCQA-*` findings in the final completion audit ledger.

5. Operator journey validation is not complete for this final pass.
   - Required: real execution, not only static inspection.
   - Required paths: at minimum Studio prompt to generated artifact, slow generation timeout visibility, retry/continue recourse, provider failure message, user stop/cancel, preview visibility, and proof receipt freshness.

6. No final closure PR exists yet.
   - Required: after all phase PRs merge, recheck current `main`, confirm no open material findings, confirm no open work PRs, and update the handoff status.

## Task 1: Repair Strict Test-Quality Blockers

**Files:**
- Modify: `test/unit/core/ScoringEngine.test.ts`
- Modify: `test/unit/generators/registerGenerators.test.ts`

**Steps:**

1. Create an isolated worktree from current `origin/main` before editing.
   - Example: `git fetch origin main && git worktree add ../liminal-test-quality-gate -b final-completion/test-quality-gate origin/main`
   - Work inside that new worktree, not the shared checkout.

2. Replace the three weak `repairAdvice` assertions in `ScoringEngine.test.ts`.
   - For fallback scorer cases, assert the exact fallback repair advice shape or exact stable fields.
   - The assertion must prove more than existence.

3. Replace the weak `p5Entry` assertion in `registerGenerators.test.ts`.
   - Use a guard that narrows the type and proves the entry exists by name.
   - Then keep the explicit routing assertions:
     - `p5Entry.canHandle('make it cooler')` is `0`
     - `p5Entry.canHandle('create a p5.js sketch with bouncing balls')` is `0.95`

4. Run focused verification.
   - `pnpm vitest run test/unit/core/ScoringEngine.test.ts test/unit/generators/registerGenerators.test.ts --coverage=false`
   - `pnpm final-qa:test-quality`
   - `pnpm typecheck`

5. Commit with Lore trailers.
   - Commit intent line should explain why: strict QA gates must prove fallback behavior, not only object presence.
   - Include `Tested:` trailers for the commands above.

6. Open PR 1 and merge only after checks/review requirements are satisfied.

## Task 2: Refresh Current-Commit Live Creative-Domain Proof

**Files:**
- Likely modified generated proof receipt: `.omx/proof/domain-gauntlet-live.json`
- If the proof runner writes additional receipt files, include them only if they are repo-intended or required by the surface gate.

**Steps:**

1. Start from an isolated worktree based on current `origin/main` after PR 1 merges.
   - Example: `git fetch origin main && git worktree add ../liminal-live-domain-proof -b final-completion/live-domain-proof origin/main`
   - Work inside that new worktree, not the shared checkout.

2. Check whether provider credentials are configured.
   - Do not print secrets.
   - If credentials are missing, record this as a blocker in the final completion audit docs and do not fake the receipt.

3. Run the live proof.
   - `pnpm proof:live-creative-domains -- --timeout-ms=180000`

4. Verify the receipt.
   - Confirm `gitCommit` equals the current `git rev-parse HEAD`.
   - Confirm all 12 launch domains pass.
   - Confirm provider/model truth is recorded.

5. Run surface gates.
   - `pnpm final-qa:surface`
   - `pnpm qa:creative-domains:static`

6. Commit the refreshed receipt only if it is an intended tracked artifact.
   - If it is untracked or ignored, document the proof path and command output in the audit docs instead.

7. Open PR 2 and merge only after checks/review requirements are satisfied.

## Task 3: Create Final Completion Audit Folder

**Files:**
- Create folder: `docs/audits/final-completion-2026-05-08/`
- Create: `README.md`
- Create: `findings-ledger.md`
- Create: `verification-log.md`
- Create: `operator-journey-matrix.md`
- Create: `handoff-status.md`

**Required content:**

1. `README.md`
   - Current commit and branch.
   - Scope: launch blockers only.
   - Prior audit reference: `docs/audits/final-qa-2026-05-06/`.
   - Stop condition: no material `FCQA-*` findings open, no stale proof receipts, no failing required gates, no open work PRs.

2. `findings-ledger.md`
   - New `FCQA-*` findings only.
   - Status values: `new`, `confirmed`, `duplicate`, `non-material`, `fixed`, `verified`, `accepted-risk`.
   - Material launch blockers cannot remain `accepted-risk` unless fixing them would require changing the product promise.

3. `verification-log.md`
   - Every command run.
   - Exit code.
   - Date/time.
   - Commit tested.
   - Short result summary.
   - Links to PRs and proof files.

4. `operator-journey-matrix.md`
   - Rows for Studio prompt-to-artifact, shader prompt, slow generation, retry/continue, provider failure, stop/cancel, preview visibility, proof freshness, TUI bridge, Bubble Tea launch relevance.
   - Columns for command/manual path, expected user-visible behavior, actual result, evidence, status, linked finding.

5. `handoff-status.md`
   - What is done.
   - What is not done.
   - PR links.
   - Remaining blockers.
   - Exact next command for a new agent.

**Verification:**
- `pnpm check:doc-links`
- `pnpm final-qa:surface`

Open PR 3 and merge only after checks/review requirements are satisfied.

## Task 4: Run Final Launch-Blocker Re-Audit

**Scope:** Launch blockers only. Do not expand into broad enhancements unless the issue can plausibly make the desktop Studio/product unpublishable, dishonest, unusable, insecure, silently broken, or customer-angering.

**Required audit passes:**

1. Static pass.
   - Search for swallowed errors, silent catches, stale launch claims, skipped tests, proof bypasses, hardcoded stale commits, timeout paths, provider fallback dishonesty, and UI paths with no recovery action.
   - Use `rg` first.

2. Gate pass.
   - `pnpm check:script-targets`
   - `pnpm check:orphans`
   - `pnpm check:doc-links`
   - `pnpm final-qa:test-quality`
   - `pnpm final-qa:surface`
   - `pnpm typecheck`
   - `pnpm build`

3. Operator pass.
   - Launch Electron Studio through the same path a user opens.
   - Test at least three representative prompts, including a shader prompt.
   - Confirm slow generation shows progress and recourse.
   - Confirm timeout does not dead-end the user.
   - Confirm provider failure is visible and actionable.
   - Confirm stop/cancel leaves the user with understandable state.
   - Confirm preview/artifact visibility is obvious.

4. Bridge/TUI pass.
   - Verify launch-relevant TUI bridge behavior only.
   - Record any Bubble Tea path that is no longer launch-relevant as non-material with rationale.

5. Saturation pass.
   - Repeat unfamiliar surfaces after fixes.
   - Stop only after two independent passes produce no new material findings.

## Task 5: Fix Any New `FCQA-*` Material Findings

For each material finding:

1. Create an isolated worktree with a focused branch from current `origin/main`.
2. Write or update the regression proof first when practical.
3. Implement the smallest product-level fix.
4. Remove dead stubs, commented-out fake features, or misleading fallback behavior related to the finding.
5. Add code comments only where they improve future maintainability.
6. Run focused tests plus required gate commands.
7. Update `findings-ledger.md` with fix evidence.
8. Open one PR per coherent subsystem.
9. Merge only after checks/review requirements are satisfied.

If a fix teaches something transferable to `liminal-sites`, create a GitHub issue in `https://github.com/Pushing-Squares/liminal-sites` with the learning, evidence, and a concise recommendation.

## Task 6: Final Closure Verification

**Files:**
- Modify: `docs/audits/final-completion-2026-05-08/handoff-status.md`
- Modify as needed: `docs/audits/final-completion-2026-05-08/verification-log.md`

**Required final checks on current `main`:**

- `git status --short --branch`
- `git rev-parse HEAD`
- `gh pr list --state open`
- `pnpm final-qa:test-quality`
- `pnpm final-qa:surface`
- `pnpm check:script-targets`
- `pnpm check:orphans`
- `pnpm check:doc-links`
- `pnpm typecheck`
- `pnpm build`
- `pnpm gui:build`
- `pnpm bubbletea:test`
- `pnpm verify:integration`
- `pnpm test:e2e`
- `pnpm test:ci:slow`
- `pnpm proof:live-creative-domains -- --timeout-ms=180000` when configured
- Electron Studio operator smoke through the installed/user-facing app path

**Completion criteria:**

- No open material `FCQA-*` findings.
- No stale proof receipts for launch claims.
- No unclassified skipped/pending/gated tests.
- No required gate failures.
- No open PRs for this work.
- All merged PRs rechecked on current `main`.
- Final `handoff-status.md` states what was verified, what was not verified, and why.

## Assumptions And Defaults

- Scope is launch blockers only, not broad enhancement work.
- Target is desktop Electron Studio, not mobile runtime.
- Prior `FQA-*` findings remain closed unless current execution disproves them.
- Live provider tests run only when configured; missing credentials are documented honestly.
- Factory/persona material is reference-only and not runtime configuration.
- The next agent should act autonomously within this plan, but must preserve evidence, commit boundaries, and PR boundaries.
