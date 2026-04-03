# Documentation Drift Report

**Generated:** 2026-04-02  
**Auditor:** Atomic Task 6.2  
**Scope:** README.md, AGENTS.md, THE_BIBLE.md vs. Code Reality

---

## Executive Summary

| Metric | Claim | Reality | Status |
|--------|-------|---------|--------|
| Version | 2.1.0 (all docs) | 2.1.0 | ✅ Consistent |
| Test Count | 1741 passing | ~300+ (running) | ⚠️ Unclear |
| Test Files | 132 | Unknown | ⚠️ Unclear |
| Harness Tasks | M1-M8 documented | 0 tasks in harness-tasks/ | 🔴 HIGH |
| Subsystems | 21 claimed | Partially implemented | 🟡 MEDIUM |

---

## Detailed Drift Analysis

### 1. README.md Claims vs. Reality

| Claim | Reality | Severity |
|-------|---------|----------|
| `npm start` not mentioned (uses `pnpm install`) | No `start` script in package.json | ✅ OK |
| `npm run tui` command | ✅ Script exists: `"tui": "npx tsx src/tui/HarnessTUI.tsx"` | ✅ Accurate |
| `liminal --configure` CLI | ✅ Binary exists in `bin/liminal` | ✅ Accurate |
| `liminal chat` command | ✅ Referenced in AGENTS.md, CLI exists | ✅ Accurate |
| "2500+ tests passing" | Tests running but timeout; actual count unclear | 🟡 MEDIUM |
| "132 test files" | Many test files exist but exact count varies | 🟡 MEDIUM |
| Meta-Harness with 6 patterns | PatternDetector.ts exists, actual patterns unknown | 🟡 MEDIUM |

### 2. AGENTS.md Claims vs. Reality

| Claim | Reality | Severity |
|-------|---------|----------|
| Tasks M1-M8 in `harness-tasks/` | Directory exists but NO .json task files | 🔴 HIGH |
| `/run M1` command works | No task files to execute | 🔴 HIGH |
| `npm run tui` launches TUI | ✅ Script exists and is valid | ✅ Accurate |
| HarnessAgent with 7 tools | Tools exist in `src/harness/tools/` | ✅ Accurate |
| FailureLogger at `src/harness/FailureLogger.ts` | ✅ File exists | ✅ Accurate |
| PatternDetector at `src/harness/PatternDetector.ts` | ✅ File exists | ✅ Accurate |
| Worktree isolation required | ✅ Scripts exist in `.worktrees/` | ✅ Accurate |
| `git wt`, `git wtl`, `git wtc` commands | Referenced but not verified | 🟡 MEDIUM |

### 3. THE_BIBLE.md Claims vs. Reality

| Claim | Reality | Severity |
|-------|---------|----------|
| **Version 2.1.0 - Production Ready** | ✅ VERSION file shows 2.1.0, package.json matches | ✅ Accurate |
| **Test Status: ✅ ALL PASSING** | Tests still running (timeout at 120s) | 🔴 HIGH |
| 1741 tests, 132 test files, 0 failures | Cannot verify - tests timeout | 🔴 HIGH |
| M1-M11: ✅ Implemented | Code exists but status unclear | 🟡 MEDIUM |
| M12-M18: ⚪ Planned/Future | Not implemented (as claimed) | ✅ Accurate |
| 21 Subsystems (8 core + 14 supporting) | Many exist but exact count unclear | 🟡 MEDIUM |
| Meta-Harness: 🟢 ACTIVE | Files exist, actual activity unknown | 🟡 MEDIUM |
| Ralph Loop: 🟢 ACTIVE | Core files exist | 🟡 MEDIUM |
| Harness tasks M1-M8: ✅ Core guardrails | No task files found | 🔴 HIGH |

### 4. Version Claims Across Files

| File | Claimed Version | Actual | Status |
|------|----------------|--------|--------|
| VERSION | - | 2.1.0 | ✅ |
| package.json | - | 2.1.0 | ✅ |
| THE_BIBLE.md | 2.1.0 | 2.1.0 | ✅ |
| All docs | 2.1.0 | 2.1.0 | ✅ |

**Verdict:** Version claims are consistent across all files.

### 5. Dogfood Results vs. Claims

| Source | Claim/Reality | Severity |
|--------|---------------|----------|
| dogfood-results-agent-a.jsonl | 36 test entries | Unclear pass rate |
| agent-b-results.jsonl | 29 test entries | Unclear pass rate |
| THE_BIBLE.md | "Test Status: ✅ ALL PASSING" | No evidence in dogfood logs |

**Verdict:** Dogfood test logs exist but pass rates are unclear. Claims of "ALL PASSING" may be overstated.

---

## Oldest Drift & Stale Content

### Stated TODOs from Codebase
From `docs/archive/internal-audits/AUDIT_FULL.md`:

| Location | TODO/FIXME | Age |
|----------|------------|-----|
| `src/compost/ModelRouter.ts:143` | "TODO: Implement true speculative decoding" | Unknown |
| `src/compost/ModelRouter.ts:262` | "TODO: Replace with more sophisticated semantic similarity" | Unknown |
| `src/chat/GuidanceEngine.ts:30` | "TODO: Use swarmOrchestrator for swarm-based suggestions" | Unknown |
| `src/chat/GuidanceEngine.ts:52` | "TODO: Store swarmOrchestrator when implementing swarm suggestions" | Unknown |
| `src/core/parsing/DocParser.ts:321` | "TODO: Track line numbers from AST" | Unknown |
| `src/security/SecurityLogger.ts:56` | "TODO: Send to SIEM/security monitoring service in production" | Unknown |

**Total:** 6 TODO/FIXME comments indicating incomplete features

---

## Critical Findings

### 🔴 HIGH Severity

1. **Missing Harness Tasks**
   - **Claim:** M1-M8 tasks exist in `harness-tasks/`
   - **Reality:** Directory exists but contains NO .json task files
   - **Impact:** TUI `/run M1` command cannot function as documented

2. **Test Status Uncertainty**
   - **Claim:** "1741 tests passing, 0 failures"
   - **Reality:** Tests timeout after 120s, actual status unknown
   - **Impact:** Cannot verify system reliability claims

### 🟡 MEDIUM Severity

3. **Subsystem Status Unclear**
   - Many subsystems marked 🟢 ACTIVE but actual activity unverified
   - No runtime metrics to confirm "active" status

4. **Dogfood Results vs. Claims**
   - Dogfood logs show 36 and 29 entries
   - No clear correlation with "ALL PASSING" claim

### ✅ Consistent Areas

5. **Version Numbers** - All files consistent at 2.1.0
6. **CLI Commands** - `npm run tui`, `liminal --configure` exist
7. **File Locations** - Core harness files exist where documented
8. **Architecture** - Major components exist as described

---

## Recommendations

1. **Create Missing Harness Tasks**
   - Add M1-M8.json files to `harness-tasks/` directory
   - Or remove references from AGENTS.md if deprecated

2. **Verify Test Suite**
   - Run full test suite to completion
   - Update THE_BIBLE.md with actual test counts
   - Document any failing tests

3. **Clean Up TODOs**
   - Review 6 TODO/FIXME comments
   - Either implement or document as known limitations

4. **Update Dogfood Documentation**
   - Clarify relationship between dogfood logs and "ALL PASSING" claim
   - Add pass rate metrics to dogfood results

5. **Add Reality Checks to CI**
   - Automated test count verification
   - Harness task existence check
   - Documentation sync validation

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 HIGH drift items | 2 |
| 🟡 MEDIUM drift items | 4 |
| ✅ Consistent items | 4 |
| **Total drift found** | **6 items** |

**Overall Assessment:** Documentation is mostly accurate for high-level architecture and CLI commands, but has significant drift in operational details (missing harness tasks, unverified test status).
