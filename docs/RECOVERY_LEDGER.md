# Recovery Ledger — Liminal Crash Recovery (2026-04-06)

**Date:** 2026-04-06
**Status:** Atomic recovery COMPLETE. Broader integration work remains.
**Closeout branch:** `recovery/closeout-v2-20260406`

---

## Recovered Branches

### 1. `agent/kimicode/recover-landing-gallery-20260406` — LANDABLE
- **Commits:** 5 (b2c87669..e02a16f2)
- **Contents:** Landing page gallery rebuilt with real dogfood data, interactive ratings, deduped badge rendering, stable assets
- **Files:** ~152 changed, ~22929 insertions (large — includes test utils, vitest config fixes)
- **Landing priority:** HIGH — primary user-facing artifact
- **Risk:** Large diff. Recommend splitting or squash-merge.

### 2. `recovery/harness-readiness-v3-20260406` (alias `harness-readiness-v3`) — LANDABLE
- **Commits:** 2 unique above main (1d8d53fc, fac14a65)
- **Contents:** vi.hoisted() fixes for 4 test files, semantic guardrail quick-check alignment
- **Landing priority:** HIGH — fixes test infrastructure
- **Risk:** Low. Small, focused fixes.

### 3. `agent/kimicode/recover-tier-hydra-tests-20260406` — LANDABLE
- **Commits:** 2 unique above main (ac6de01e, 706f7f37)
- **Contents:** TierBasedGenerator + HydraGenerator test coverage, docs for recovered generator coverage
- **Landing priority:** MEDIUM — coverage improvement
- **Risk:** Low.

### 4. `agent/kimicode/recover-git-hygiene-safety-20260406` — LANDABLE
- **Commits:** 1 unique above main (74f49ce6)
- **Contents:** Worktree orphan preservation fix — prevents data loss when worktrees have local changes
- **Landing priority:** HIGH — prevents future data loss
- **Risk:** Low.

### 5. `agent/kimicode/recover-hermetic-test-home-20260406` — LANDABLE
- **Commits:** 1 unique above main (c5c9a2ed)
- **Contents:** Default vitest lane made hermetic (no HOME dependency leakage)
- **Landing priority:** MEDIUM — test reliability
- **Risk:** Low.

### 6. `agent/kimicode/recover-vitest-capability-lanes-20260406` — LANDABLE
- **Commits:** 1 unique above main (8cb16392)
- **Contents:** Capability-dependent vitest lanes gated (skip when capability unavailable)
- **Landing priority:** MEDIUM — test reliability
- **Risk:** Low.

### 7. `agent/kimicode/recover-liminal-paths-failure-logger-20260406` — LANDABLE
- **Commits:** 1 unique above main (09b15fca)
- **Contents:** Failure logger honors `liminal home` config path instead of hardcoded paths
- **Landing priority:** MEDIUM — config correctness
- **Risk:** Low.

### 8. `agent/kimicode/recover-liminal-paths-harness-memory-20260406` — LANDABLE
- **Commits:** 1 unique above main (629425cb)
- **Contents:** Harness memory honors `liminal home` config path
- **Landing priority:** MEDIUM — config correctness
- **Risk:** Low.

### 9. `agent/kimicode/recover-liminal-paths-reasoning-capture-20260406` — LANDABLE
- **Commits:** 1 unique above main (bba81488)
- **Contents:** Reasoning capture honors `liminal home` config path
- **Landing priority:** MEDIUM — config correctness
- **Risk:** Low.

### 10. `agent/kimicode/recover-liminal-paths-routing-data-20260406` — LANDABLE
- **Commits:** 1 unique above main (80be7d34)
- **Contents:** Routing data honors `liminal home` config path
- **Landing priority:** MEDIUM — config correctness
- **Risk:** Low.

### 11. `agent/kimicode/recover-liminal-paths-tool-telemetry-20260406` — LANDABLE
- **Commits:** 1 unique above main (5b9cce79)
- **Contents:** Tool telemetry honors `liminal home` config path
- **Landing priority:** MEDIUM — config correctness
- **Risk:** Low.

### 12. `worktree-agent-a4aebc90` — ALREADY CLEAN/LANDABLE
- **Commits:** 1 unique above main (9a1e5f00)
- **Contents:** GLSL shader scoring improvement with domain-specific patterns
- **Landing priority:** MEDIUM
- **Risk:** Low.

### 13. `agent/kimicode/forensic-recovery-20260406` — REFERENCE ONLY
- **Commits:** 2 unique (916d92ca, fdca2825)
- **Contents:** Forensic documentation — crash snapshot, thread prioritization. Not code to land.
- **Landing priority:** N/A — documentation reference
- **Risk:** None.

---

## Superseded / Not Worth Replaying

| Item | Reason |
|------|--------|
| `stash@{31}` | Already landed to main |
| `stash@{17}` | Obsolete — predates crash |
| `liminal/strudel-test-1775514832388` branch | Polluted test branch — good commit already salvaged into landing-gallery recovery |
| Stashes 0-16, 18-30 | Agent session auto-stashes from iterative test loops — no unique content worth preserving |

---

## Recommended Landing Order

1. **`harness-readiness-v3`** — vi.hoisted + guardrail fixes (test infra, blocks others)
2. **`recover-hermetic-test-home`** — hermetic vitest (test reliability)
3. **`recover-vitest-capability-lanes`** — capability gating (test reliability)
4. **`recover-git-hygiene-safety`** — worktree orphan fix (data loss prevention)
5. **`recover-liminal-paths-*`** (all 5 branches) — liminal home config fixes (can be batched)
6. **`recover-tier-hydra-tests`** — generator coverage
7. **`recover-landing-gallery`** — landing page (largest, land last after infra is stable)
8. **`worktree-agent-a4aebc90`** — shader scoring (independent, any time)

---

## Remaining Non-Atomic / Broader Work

These items were identified during recovery but are too broad for atomic slices. They represent integration or reconstruction work:

### 1. Landing Gallery Integration
The landing gallery branch is large (~22K insertions). After landing infra fixes, it needs careful merge review to avoid pulling in unrelated test changes.

### 2. Test Coverage to 70%
Current coverage is ~68% across metrics. The ratchet enforces non-regression but reaching 70% requires new tests in `src/music/`, `src/plugins/`, `src/config/`, `src/generators/`.

### 3. Stash Cleanup
34 stashes from agent sessions. Most are auto-stashes with no unique value. A cleanup pass should drop the obsolete ones (potentially reclaiming ~20 stash slots).

### 4. Stale Branch Cleanup
Many `liminal/*-test-*` branches from automated agent iterations. These should be deleted after verifying no unique content.

### 5. Worktree Hygiene
9 worktrees currently active. After recovery closeout, idle worktrees from completed recovery tasks should be removed per git hygiene rules.

### 6. Emergent Language / Creative Vocabulary
The `zazzy-drifting-acorn` worktree had a plan for symbolic creative language + scaffold compression. This is architectural work, not a recovery item — tracked separately in project memory.

---

## Active Worktrees (as of 2026-04-06)

| Path | Branch | Status |
|------|--------|--------|
| `.claude/worktrees/frontface-polish` | `worktree-frontface-polish` | Active |
| `.worktrees/agent-recover-liminal-paths-failure-logger-*` | `recover-liminal-paths-failure-logger-*` | Preserved |
| `.worktrees/agent-recover-liminal-paths-harness-memory-*` | `recover-liminal-paths-harness-memory-*` | Preserved |
| `.worktrees/agent-recover-liminal-paths-reasoning-capture-*` | `recover-liminal-paths-reasoning-capture-*` | Preserved |
| `.worktrees/agent-recover-liminal-paths-routing-data-*` | `recover-liminal-paths-routing-data-*` | Preserved |
| `.worktrees/agent-recover-liminal-paths-tool-telemetry-*` | `recover-liminal-paths-tool-telemetry-*` | Preserved |
| `.worktrees/agent-recover-vitest-capability-lanes-*` | `recover-vitest-capability-lanes-*` | Preserved |
| `.worktrees/redteam-tui-gui-audit-20260406` | `liminal/meta-test-3-*` | Active (audit) |
| `.worktrees/recovery-closeout-v2-20260406` | `recovery/closeout-v2-20260406` | This work |

---

*Ledger generated by crash recovery closeout. Update this file when branches are landed or worktrees cleaned.*
