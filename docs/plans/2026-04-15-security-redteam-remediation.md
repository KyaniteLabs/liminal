# Security Redteam Remediation Implementation Plan

**Goal:** Extract the still-valuable security fixes from `security/redteam-remediation-20260409` into current `main` without replaying stale TUI, lint, or unrelated generator changes.

**Architecture:** Treat the branch as a salvage source, not a merge source. Split it into narrow security PRs by trust boundary: adapter sandboxing, CLI/command execution, and regression tests. Each PR starts from fresh `origin/main`, cherry-picks or reapplies only one security behavior, proves it with focused tests, then updates the docs bible.

**Tech Stack:** TypeScript, Vitest, composition adapters, Tone/HTML/Hydra/P5/Three adapter surfaces, `bin/liminal`, `RalphLoop`, `HeadlessRenderer`, `TestFailureDetector`, project docs.

---

## Current Evidence

Source branch: `security/redteam-remediation-20260409`

Commits on branch:
- `70cf0307` - `fix(p5): emit all custom colors, not just one`
- `86f4e039` - `fix(tui): prevent UI corruption from streaming markdown and bridge logs`
- `520bb557` - `fix(lint): resolve 2 ESLint errors blocking CI`
- `44b17cda` - `security(adapter): replace eval() with sandboxed execution in ToneAdapter`
- `d4c9e9d6` - `security(adapters): fix arbitrary code execution vulnerabilities`
- `6dd020b9` - `security: fix command injection and XSS vulnerabilities (Tasks 5-6)`

Branch footprint against current `origin/main`:
- 20 files changed
- 1,987 insertions, 66 deletions
- Main risk area: `src/composition/adapters/*Adapter.ts`
- Test additions: adapter security tests for HTML, Hydra, P5, Three, Tone

Do not merge the branch wholesale. It includes unrelated P5/TUI/lint commits and is 90+ commits behind current `main`.

## Mental Model

Classify each commit before touching code:

| Commit | Classification | Default Action |
|--------|----------------|----------------|
| `44b17cda` Tone adapter sandbox | `MERGE_CANDIDATE` | Salvage first |
| `d4c9e9d6` adapter arbitrary execution fixes | `MERGE_CANDIDATE` | Salvage by adapter, one commit per adapter if needed |
| `6dd020b9` command injection / XSS | `MERGE_CANDIDATE`, broad | Split into CLI command-injection and adapter XSS slices |
| `70cf0307` P5 color fix | `REFERENCE_ONLY` for this security lane | Move to product-quality backlog |
| `86f4e039` TUI log/UI fix | `REFERENCE_ONLY` for this security lane | Move to TUI backlog |
| `520bb557` lint fix | `MERGE_ONLY_IF_NEEDED` | Reapply only if current code needs it |

## Task 1: Create Isolated Salvage Worktree

**Files:**
- No code changes.

**Step 1: Refresh remote truth**

Run:
```bash
git fetch --all --prune
git status --short --branch
git worktree list
git branch -vv | rg "security|redteam|adapter|tone|hydra|three|p5|html"
```

Expected:
- Root worktree is clean on `main`.
- `security/redteam-remediation-20260409` exists locally.
- No open PR is using this branch directly.

**Step 2: Create worktree**

Run:
```bash
git worktree add .worktrees/security-redteam-salvage-20260415 -b security/redteam-salvage-20260415 origin/main
cd .worktrees/security-redteam-salvage-20260415
```

Expected:
- New worktree on `security/redteam-salvage-20260415`.
- Clean `git status`.

**Step 3: Record branch rejection**

Add a short note to the PR/plan later:
- `Rejected: merge security/redteam-remediation-20260409 wholesale | branch is broad, stale, and includes non-security commits`

## Task 2: Salvage Tone Adapter Sandbox

**Files:**
- Modify: `src/composition/adapters/ToneAdapter.ts`
- Test: `test/unit/composition/adapters/ToneAdapter.test.ts`

**Step 1: Inspect current and source versions**

Run:
```bash
git diff origin/main...security/redteam-remediation-20260409 -- src/composition/adapters/ToneAdapter.ts test/unit/composition/adapters/ToneAdapter.test.ts
```

Expected:
- Identify the exact `eval()` or dynamic execution path being replaced.
- Identify security tests that assert malicious code is blocked.

**Step 2: Cherry-pick without commit**

Run:
```bash
git cherry-pick --no-commit 44b17cda
```

Expected:
- Either clean apply or conflicts only in `ToneAdapter.ts` / `ToneAdapter.test.ts`.

If conflicts occur:
- Keep current `main` structure.
- Reapply only the sandboxing behavior and tests.
- Do not import unrelated adapter changes from later commits.

**Step 3: Verify no direct eval remains in Tone adapter**

Run:
```bash
rg -n "eval\\(|new Function|Function\\(" src/composition/adapters/ToneAdapter.ts
```

Expected:
- No unsafe dynamic execution unless it is explicitly sandboxed and tested.

**Step 4: Run focused test**

Run:
```bash
npx vitest run test/unit/composition/adapters/ToneAdapter.test.ts --reporter=dot --coverage.enabled=false
```

Expected:
- Tone adapter tests pass.

**Step 5: Commit**

Use Lore-style message:
```bash
git add src/composition/adapters/ToneAdapter.ts test/unit/composition/adapters/ToneAdapter.test.ts
git commit -m "Block dynamic execution in Tone adapter" \
  -m "Salvage the Tone adapter sandboxing behavior from the redteam branch without replaying unrelated stale branch changes." \
  -m "Constraint: security/redteam-remediation-20260409 is broad and stale" \
  -m "Rejected: merge whole branch | mixes TUI/P5/lint changes into security work" \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: npx vitest run test/unit/composition/adapters/ToneAdapter.test.ts --reporter=dot --coverage.enabled=false"
```

## Task 3: Salvage Adapter Execution Guards

**Files:**
- Modify: `src/composition/adapters/HTMLAdapter.ts`
- Modify: `src/composition/adapters/HydraAdapter.ts`
- Modify: `src/composition/adapters/P5Adapter.ts`
- Modify: `src/composition/adapters/ThreeAdapter.ts`
- Test: `test/unit/composition/adapters/HTMLAdapter.security.test.ts`
- Test: `test/unit/composition/adapters/HydraAdapter.security.test.ts`
- Test: `test/unit/composition/adapters/P5Adapter.security.test.ts`
- Test: `test/unit/composition/adapters/ThreeAdapter.security.test.ts`

**Step 1: Inspect source diff by adapter**

Run:
```bash
git diff origin/main...security/redteam-remediation-20260409 -- src/composition/adapters/HTMLAdapter.ts
git diff origin/main...security/redteam-remediation-20260409 -- src/composition/adapters/HydraAdapter.ts
git diff origin/main...security/redteam-remediation-20260409 -- src/composition/adapters/P5Adapter.ts
git diff origin/main...security/redteam-remediation-20260409 -- src/composition/adapters/ThreeAdapter.ts
```

Expected:
- For each adapter, identify the untrusted-code surface and the proposed guard.

**Step 2: Apply one adapter at a time**

Recommended order:
1. HTML
2. P5
3. Three
4. Hydra

For each adapter:
- Copy only the guard behavior.
- Add only that adapter's security test.
- Run only that adapter's test.
- Commit.

Example command for HTML:
```bash
npx vitest run test/unit/composition/adapters/HTMLAdapter.security.test.ts --reporter=dot --coverage.enabled=false
```

Expected:
- Each adapter commit is independently reviewable.

**Step 3: Run combined adapter security tests**

Run:
```bash
npx vitest run \
  test/unit/composition/adapters/HTMLAdapter.security.test.ts \
  test/unit/composition/adapters/HydraAdapter.security.test.ts \
  test/unit/composition/adapters/P5Adapter.security.test.ts \
  test/unit/composition/adapters/ThreeAdapter.security.test.ts \
  test/unit/composition/adapters/ToneAdapter.test.ts \
  --reporter=dot --coverage.enabled=false
```

Expected:
- All adapter security tests pass.

## Task 4: Salvage CLI Command Injection Fix

**Files:**
- Modify: `bin/liminal`
- Test: identify or add focused CLI/unit test if existing test harness supports it.

**Step 1: Inspect source diff**

Run:
```bash
git diff origin/main...security/redteam-remediation-20260409 -- bin/liminal
```

Expected:
- Identify shell interpolation or unsafe command construction.

**Step 2: Decide whether current main is still vulnerable**

Run:
```bash
rg -n "exec\\(|spawn\\(|shell: true|\\$\\(|child_process|open " bin/liminal src scripts
```

Expected:
- If current `bin/liminal` no longer contains the vulnerable path, mark this slice `SUPERSEDED`.
- If vulnerable, apply the minimal quoting/argument-array fix.

**Step 3: Add or update a focused test**

If no test exists, create the smallest test that proves malicious input is passed as data, not shell:
- Prefer testing a helper function if one exists.
- If `bin/liminal` is not testable, extract a tiny parser/helper only if necessary.

**Step 4: Verify**

Run:
```bash
npm run build
npx vitest run <focused-cli-test> --reporter=dot --coverage.enabled=false
```

Expected:
- Build passes.
- New or existing command-injection test passes.

## Task 5: Salvage XSS Fixes

**Files:**
- Likely: adapter files from Task 3.
- Possibly: `src/render/HeadlessRenderer.ts`, `src/core/RalphLoop.ts`, or TUI view if diff proves relevance.

**Step 1: Identify XSS-specific changes**

Run:
```bash
git show --name-only --oneline 6dd020b9
git diff origin/main...security/redteam-remediation-20260409 -- src render test | rg -n "xss|script|onerror|innerHTML|sanitize|escape|iframe|srcdoc|CSP"
```

Expected:
- A short list of exact files where XSS behavior changes.

**Step 2: Apply only XSS-relevant changes**

Do not import:
- unrelated P5 color changes
- TUI streaming formatting
- lint-only churn

**Step 3: Verify**

Run focused tests from Task 3 plus any render/headless security tests touched.

Expected:
- Malicious script/event-handler inputs are blocked or escaped.

## Task 6: Reject or Archive Non-Security Commits

**Files:**
- Modify: `docs/THE_BIBLE.md`
- Modify: `docs/visual-bible.html` if dashboard status changes.

**Step 1: Record rejected non-security work**

Document:
- `70cf0307` P5 color fix: move to product-quality backlog.
- `86f4e039` TUI markdown/log fix: move to TUI backlog.
- `520bb557` lint fix: apply only if still needed after security commits.

**Step 2: Optional branch cleanup**

After security PR lands:
```bash
git branch -m security/redteam-remediation-20260409 archive/security-redteam-remediation-source-20260409
```

Expected:
- Source branch is clearly archive/reference, not an active merge lane.

## Task 7: Full Verification Gate

**Files:**
- No new files unless docs updated.

**Step 1: Run focused security tests**

Run:
```bash
npx vitest run \
  test/unit/composition/adapters/HTMLAdapter.security.test.ts \
  test/unit/composition/adapters/HydraAdapter.security.test.ts \
  test/unit/composition/adapters/P5Adapter.security.test.ts \
  test/unit/composition/adapters/ThreeAdapter.security.test.ts \
  test/unit/composition/adapters/ToneAdapter.test.ts \
  --reporter=dot --coverage.enabled=false
```

Expected:
- All pass.

**Step 2: Run broader impacted tests**

Run:
```bash
npm run build
npx vitest run test/unit/composition/adapters.test.ts test/unit/composition/LayerManager.test.ts --reporter=dot --coverage.enabled=false
node scripts/analysis/validate-version.js --quiet
node scripts/analysis/verify-file-refs.js --quiet
```

Expected:
- TypeScript build passes.
- Adapter/composition tests pass.
- Docs validation passes.

**Step 3: Avoid known mutating hook path**

Do not rely on broad `vitest --changed` as the only verification signal until the hook is fixed. It has previously launched mutation-heavy e2e/model-comparison flows that switched branches and left unrelated conflicts.

## Task 8: Open Draft PR

**Files:**
- No code changes.

**Step 1: Push branch**

Run:
```bash
git push -u origin security/redteam-salvage-20260415
```

**Step 2: Open draft PR**

Include:
- Summary by security boundary.
- Exact source commits salvaged.
- Exact source commits rejected and why.
- Verification commands and results.
- Known risks.

Expected:
- Draft PR is mergeable.
- CI starts.
- Reviewers can evaluate security changes without unrelated branch noise.

## Stop Conditions

Stop and split the work if any one slice:
- touches more than one trust boundary,
- requires dependency changes,
- modifies broad TUI or Bubble Tea code,
- causes unrelated adapter behavior changes,
- requires rewriting current `main` architecture.

## Success Criteria

- Security behavior from `security/redteam-remediation-20260409` is either merged, superseded, or explicitly rejected.
- No unrelated P5/TUI/lint changes are mixed into the security PR.
- All worktrees remain clean.
- `main` stays clean and synced.
- The old redteam branch is renamed or documented as archive/reference after salvage.
