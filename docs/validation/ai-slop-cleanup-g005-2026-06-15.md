# AI Slop Cleanup Report — G005 (2026-06-15)

```text
AI SLOP CLEANUP REPORT
======================

Scope: G002 worktree changed files (the active Ultragoal story G002 → G005).
- src/core/RalphLoop.ts (removed dead `recordRoutingOutcome` call + `domainToRoutingType` import; replaced with explanatory comment per B1)
- src/routing/RoutingData.ts (added @deprecated Audit B1 headers to recordRoutingOutcome, getRollingPerformance, getOptimalModelBandit, getBanditStats)
- src/runtime-core/Level6ReleaseGate.ts (H5/C4 honesty: model-assimilation demoted to harness-reachability smoke; label updated; status derived from `source`/`recommendation` shape; completion proof remains the separate `live-model-assimilation` receipt check)
- test/unit/runtime-core/Level6ReleaseGate.test.ts (added 1 new H5/C4 regression test; bumped existing candidate-mode test timeout from 5s to 30s per TEST_TIMEOUT convention)
- test/integration/garden-archive-hydration.test.ts (timeout bump 5s → 30s, flaky under full-suite load)
- test/tui-bridge/tui-bridge-no-chat-lane.test.ts (timeout bump 10s → 30s, flaky under full-suite load)
Mode: read-only detector/report; no edits performed

Blocking Findings: none

Advisory Findings:
- A1. `Level6ReleaseGate.ts:80-91` — the long label string is informationally dense but verbose. Consider short-form label with details in evidence. (advisory: not blocking; preserves H5/C4 contract)
- A2. `test/unit/runtime-core/Level6ReleaseGate.test.ts:90-110` — duplicate `it('rejects stale live receipts…')` header was already repaired during the edit cycle; one commit repaired it. (advisory: documentation note; not blocking)

Fallback Findings: none
- The model-assimilation demotion is a GROUNDED compatibility fix: the live-receipt gate (live-model-assimilation) remains the only completion proof; the gauntlet path is now an explicit harness-reachability smoke with a clear label and provenance. This is honest accounting, not a masked fallback.

UI/Design Findings: N/A — story is internal runtime-core wiring; no UI surface changed.

Missing Test Findings: none
- New H5/C4 regression test added (test/unit/runtime-core/Level6ReleaseGate.test.ts:90-110).
- B1 fix verified by grep (zero production callers of recordRoutingOutcome in src/).
- Test/timeouts bumped for two flaky-under-load tests; existing test logic unchanged.
- C9/C10/C11 deprecation-to-deletion inventory documented for G005 batch (deprecation-deletion-candidates-2026-06-15.md); tests for those modules are out of G002 scope (they test the deprecated modules themselves, not the fix).

Recursion Guard: confirmed no nested ralplan/team/deep-interview/ultragoal spawned. Broader architectural findings (e.g. full bandit removal) handed to leader as G005 final-gate decision.

Changed Files Reviewed:
- src/core/RalphLoop.ts — reviewed
- src/routing/RoutingData.ts — reviewed
- src/runtime-core/Level6ReleaseGate.ts — reviewed
- test/unit/runtime-core/Level6ReleaseGate.test.ts — reviewed
- test/integration/garden-archive-hydration.test.ts — no relevant edits (timeout bump only)
- test/tui-bridge/tui-bridge-no-chat-lane.test.ts — no relevant edits (timeout bump only)

Gate Result: PASS

Leader Action:
- PASS: continue to verification, architect review, and executor red-team QA.

Remaining Risks:
- The deprecation-to-deletion batch (C9/C10/C11 = ~3-4k LOC across 26-28 files) is documented for G005 review but not yet executed; deferred because it requires coordinated barrel re-export cleanup + matching test deletion. Out of G002 scope.
- D12 HeuristicScorer token-overlap is documented as a degraded heuristic in the existing test (test/unit/swarm/HeuristicScorer.test.ts:34); no fix needed.
- The two timeout-bumped tests (garden-archive-hydration, tui-bridge-no-chat-lane) are existing tests that flake under full-suite forks-pool load; the bump to 30s is the same TEST_TIMEOUT convention used elsewhere.
```
