# Liminal Local Runtime Workflow + Targeted Fix Plan

Date: 2026-04-11
Status: approved working model
Purpose: give Liminal a local-only autonomous lane plus a prioritized queue of high-leverage, low-risk fixes

---

## 1. Local-only runtime lane

### Objective
Give Liminal a safe local branch/worktree where it can:
- checkpoint often
- preserve intermediate work
- avoid losing verified progress
- avoid polluting GitHub with half-finished PR branches
- promote only selected fixes to remote-facing branches

### Model
Use two lanes:

#### A. Local-only runtime lane
For autonomous work, experiments, intermediate commits, and checkpoint history.

Suggested branch names:
- `local/liminal-runtime`
- `local/liminal-scratch`
- `local/checkpoints/*`

#### B. Promotion lane
For cherry-picked, verified, human-reviewable work.

Suggested branch names:
- `fix/liminal-promote`
- `fix/<specific-topic>`

### Recommended worktree layout
From repo root:

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal

git fetch origin

git worktree add .worktrees/liminal-runtime -b local/liminal-runtime origin/main
git worktree add .worktrees/liminal-promote -b fix/liminal-promote origin/main
```

### Rules
- Liminal autonomous work happens in `.worktrees/liminal-runtime`
- frequent local commits are encouraged
- no automatic push from runtime lane
- only promoted commits/diffs go to `fix/*`
- promotion happens intentionally after verification

### Promotion workflow
In runtime lane:

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal/.worktrees/liminal-runtime
git log --oneline -n 20
```

In promotion lane:

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal/.worktrees/liminal-promote
git cherry-pick <runtime-commit-sha>
npm run build
# run focused tests
git push -u origin fix/liminal-promote
```

### Why this is the right first version
This gives most of the value of an "internal local git" without inventing a second repository or custom VCS layer.

Benefits:
- safe local history
- easier rollback
- less branch spam on GitHub
- explicit promotion step
- preserves autonomous momentum

---

## 2. Targeted high-leverage / low-risk fix queue

This is the queue Liminal should work through in priority order.

### Priority 1 — language-aware verification selection

#### Problem
The harness currently uses `runTests` in cases where the touched code is Go, which routes through the wrong verifier (`npm test` / vitest-oriented path).

#### Goal
Choose verification tools based on changed file language/path.

#### Acceptable implementations
- add a `runGoTest` tool
- add a safe command tool with allowlisted Go test/build invocations
- or add a routing layer that maps:
  - `bubbletea/**`, `*.go` → Go verification
  - TS/JS files → current `runTests` / build flow

#### Why this is high ROI
Improves every future mutation run by reducing false failures and wasted steps.

#### Why this is low risk
Small additive tool/routing change with clear boundaries.

---

### Priority 2 — search fallback / search context quality

#### Problem
When `rg` is unavailable, search quality drops and the agent wastes steps on inspection.

#### Goal
Make `search` resilient and useful even without ripgrep.

#### Improvements
- reliable grep fallback
- return more useful context around matches
- integrate better with paged `readFile`
- improve file/path filtering

#### Why this is high ROI
Reduces wasted investigative steps across many runs.

#### Why this is low risk
Contained tooling improvement.

---

### Priority 3 — no-change-success semantics consistency

#### Problem
Inspection-only runs still need to be treated consistently as success, not generic failure.

#### Goal
Normalize control-flow semantics for:
- inspection-only no-change success
- mutation + incomplete verification failure
- parse-failure handling in safe read-only scenarios

#### Why this is high ROI
Prevents false negatives and increases operator trust.

#### Why this is low risk
Primarily status/control semantics.

---

### Priority 4 — verifier selection guidance in the planning prompt

#### Problem
Even if tools exist, the model can still choose the wrong verifier.

#### Goal
Improve the self-improvement prompt / routing guidance so the model prefers the correct verification path by file type.

#### Why this is high ROI
Improves many future runs without changing large code paths.

#### Why this is low risk
Prompt/routing guidance only.

---

### Priority 5 — richer per-run artifact capture

#### Problem
Operators need better postmortem visibility into exactly what happened in each run.

#### Goal
Persist:
- task id
- tools used
- files changed
- verification commands
- final status reason
- final report summary

#### Why this is high ROI
Helps debug and promote fixes safely.

#### Why this is low risk
Artifact/logging enhancement.

---

### Priority 6 — runtime-to-promotion helper

#### Problem
Local runtime workflow is useful, but promotion is still manual and error-prone.

#### Goal
Add a helper script such as:

```text
scripts/git/promote-runtime-fix.mjs
```

that:
- lists recent runtime commits
- helps cherry-pick into a promotion branch
- runs a verification checklist
- prints next commands

#### Why this is high ROI
Makes the local-runtime model operational, not just conceptual.

#### Why this is low risk
Standalone workflow helper.

---

## 3. Delegate-ready prompt for Liminal runtime lane

Use this exact prompt with Liminal in the local-only runtime worktree:

```text
You are working in the local-only Liminal runtime lane.

Mission:
Focus only on the highest-leverage, lowest-risk control-plane fixes for the Meta-Harness and Bubble Tea operator surface.

Working model:
- Treat this branch/worktree as local-only runtime history.
- Commit often locally.
- Do not push.
- Only pursue fixes that improve future self-improvement runs.

Priority order:
1. language-aware verification selection
2. search fallback / search context quality
3. no-change-success completion semantics
4. prompt/tool-routing improvements for verifier choice
5. richer per-run artifacts
6. promotion helper for local runtime -> publishable branch

Rules:
- prefer one small fix at a time
- verify every mutation
- do not do broad refactors
- do not chase cosmetic polish unless it improves operator trust
- optimize for reliability, observability, and verifier correctness
- create atomic local commits after each verified fix

For each fix:
1. identify the root cause
2. explain why it is high leverage and low risk
3. patch minimally
4. run the smallest relevant verification
5. commit locally with a structured commit message
6. report:
   - issue fixed
   - files changed
   - tests run
   - why this improves future runs
   - whether it is worth promoting to a remote PR branch

Start with Priority 1 unless current evidence shows a different blocker is more urgent.
```

---

## 4. Recommended commands

### Create runtime lane
```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
git fetch origin
git worktree add .worktrees/liminal-runtime -b local/liminal-runtime origin/main
```

### Run Liminal there
```bash
cd /Users/simongonzalezdecruz/workspaces/liminal/.worktrees/liminal-runtime
pnpm tui
```

### Promote later
```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
git worktree add .worktrees/liminal-promote -b fix/liminal-promote origin/main
cd .worktrees/liminal-promote
git cherry-pick <good-runtime-commit>
```

---

## 5. Success condition

This workflow is successful when:
- Liminal can autonomously make local commits without losing work
- only good verified fixes are promoted to remote PR branches
- branch/PR noise is reduced
- targeted control-plane quality improves steadily

