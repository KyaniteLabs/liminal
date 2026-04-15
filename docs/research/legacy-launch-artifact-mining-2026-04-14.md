# Legacy Launch Artifact Mining — 2026-04-14

This is the first careful mining pass over the ignored/unregistered Claude launch artifacts preserved in:

- `docs/research/ignored-unregistered-artifact-preservation-2026-04-14.md`
- `docs/research/ignored-unregistered-artifacts-manifest-2026-04-14.json`
- local archive: `.omx/artifact-preservation/2026-04-14Tartifact-preservation/ignored-unregistered-artifacts-2026-04-14.tar.gz`

The goal is to extract reusable signal without copying old stale state blindly into active code.

## Refresh snapshot before mining

- Remote refreshed with `git fetch --all --prune`.
- GitHub open PRs: `0` from `gh pr list`.
- Recent GitHub state: PRs `#143` through `#161` are merged/closed rescue/harness/DF/revideo branches; no open PR is waiting for this lane.
- Active parallel local lane detected: `df1-app-dogfood` is running `scripts/dogfood/df2-minimal-fsm.ts --domains=p5,glsl,three,kinetic,html --preset=qwen-local` and has advanced to commit `df55af81 Add deterministic DF2 dogfood loop`.
- No-touch rule for this pass: do not edit `df1-app-dogfood` or any compatibility worktree while those lanes are active/dirty.

## Source artifacts read in this pass

From `.claude/worktrees/launch-plan/`:

- `DOGFOOD_READINESS_AUDIT_REPORT.md`
- `FORENSIC_AUDIT_REPORT.md`
- `INTEGRATION_AUDIT_REPORT.md`
- `ISSUE-REPORT.md`
- `USER_TESTING_READINESS_REPORT.md`
- `LAUNCH_PLAN.md`
- `PROJECT_RULES.md`

## High-signal findings worth carrying forward

### 1. Historical TUI failure was not merely UX; it was a trust-boundary failure

`ISSUE-REPORT.md` repeatedly identifies the old TUI as chat-first and capable of returning hallucinated tool/action text without executing anything. The useful durable lesson is not the exact old line numbers; it is the product invariant:

> Operator-facing agent surfaces must distinguish chat, planned action, actual tool execution, rollback, and completion evidence.

Current relevance:

- This aligns with the later runtime/bridge work on explicit tool telemetry, bounded completion, and verification-before-success.
- It should remain a DF2/DF3 acceptance criterion: any UI that displays an agent result must show whether tools actually ran and where the verification evidence lives.

Mining status: **KEEP AS CURRENT INVARIANT**.

### 2. Dogfood reports repeatedly conflate static validity, runtime success, and launch readiness

The readiness and launch-plan reports list high pass rates, but later DF1 work showed that static validation is not enough. Several artifacts could validate while still failing runtime, quality, or launch readiness.

Current relevance:

- DF1/DF2 summaries now need separate columns for static validation, runtime status, evaluator score, quality threshold, and launch readiness.
- The new model-role analysis already uses that distinction for GPT-5.4 Mini/Nano and GLM 4.5 Air.

Mining status: **ALREADY PARTLY INCORPORATED; KEEP REINFORCING**.

### 3. Localhost/private-network LLM access must be explicit, test-scoped, and auditable

`LAUNCH_PLAN.md` identified SSRF/private-IP checks blocking test/local LLM traffic. Later work used local/remote LM Studio endpoints such as `http://100.66.225.85:1234/v1`, and DF1 depends on intentional local model access.

Durable lesson:

- Never silently bypass SSRF protections globally.
- Local/private LLM access should be controlled by explicit environment/config flags and should be reflected in run metadata.

Current relevance:

- This is directly relevant to DF2, provider switching, and the model scout lane.
- If failures appear as “provider unavailable,” check whether a security gate blocked local/private endpoints before blaming the model.

Mining status: **KEEP AS PROVIDER/SECURITY INVARIANT**.

### 4. Historical `remotion`/video references are now a migration-risk pattern, not just stale labels

The preserved reports predate the Revideo cleanup and still mention Remotion as an active domain. The value is not the old Remotion plan; it is the migration warning:

- label drift can hide real artifact lookup/key compatibility assumptions;
- display labels and historical artifact keys may need different migration handling.

Current relevance:

- This matches the Revideo cleanup work already merged via PR #143.
- Future domain renames should include explicit compatibility-key tests and documentation updates.

Mining status: **LESSON INTEGRATED; USE FOR FUTURE RENAMES**.

### 5. Old readiness numbers are useful only as trend evidence, not as current truth

The old reports cite very different readiness/test numbers, for example high test pass rates, 9 domains, many providers, and launch readiness percentages. They are snapshots from older branches and should not be used as current status.

Current relevance:

- Use these artifacts to identify historical blind spots, not to make launch claims.
- Current claims should come from current branch tests, DF artifacts, and GitHub checks.

Mining status: **REFERENCE ONLY**.

## Candidate follow-up mining slices

### Slice A — TUI trust-boundary invariant audit

Question:

- Do all current TUI/Bubble Tea/bridge response paths expose whether actions were actually executed and verified?

Likely files:

- `src/tui/NaturalInterface.ts`
- `src/tui-bridge/TuiBridgeService.ts`
- `src/tui-bridge/TuiBridgeServer.ts`
- `bubbletea/internal/app/*`
- relevant TUI/bridge tests

Expected output:

- A small audit doc or narrow test additions, not broad refactor.

### Slice B — DF2 launch-readiness column contract

Question:

- Does `scripts/dogfood/df2-minimal-fsm.ts` preserve the DF1 distinction between static validation, runtime status, evaluator score, quality threshold, launch readiness, and repair attempt count?

No-touch note:

- The DF2 process is currently active in the parallel lane. Do not edit that worktree until it finishes or the owner hands off.

### Slice C — Provider security/local endpoint provenance

Question:

- Do DF1/DF2 artifacts clearly record when local/private endpoints are intentionally allowed?

Likely output:

- A small provenance field or doc/test if missing, but only after inspecting current DF2 artifacts.

## Decision from this mining pass

Only a docs synthesis was committed in this pass. No runtime code was changed because:

- the active DF2 lane is already running;
- compatibility/model worktrees are dirty/owned by other lanes;
- the mined launch-plan artifacts are historical and must not be blindly applied to current code.

## Current recommended next action

Wait for the active DF2 run to finish, then compare its artifact schema against the invariants above. If any invariant is missing, make the smallest possible atomic commit in the DF2 lane or a fresh isolated worktree.
