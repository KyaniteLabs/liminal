# Git/Compost Silent Failures — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Entire `src/` codebase (133 instances across 16 modules)
**Approach:** Hybrid Result + Throw

---

## Problem

The codebase has 133 instances of the "catch-and-return-null" anti-pattern across 16 modules. When operations fail (git commits, LLM calls, file reads, state persistence), callers receive `null`, `[]`, `''`, or a neutral fallback value. They treat these as "disabled" or "empty" rather than "broken," so failures propagate silently.

### Impact Clusters

**Cluster 1 — LLM Call Chain (Highest Risk):**
LLMClient fallback pattern silently continues through provider failures. When ALL providers fail, the final catch returns `{ content: '', success: false }`. Callers like RalphLoop, ScoringEngine, FragmentScorer, and CompostSoup each independently swallow this empty response. A complete LLM outage manifests as neutral scores, empty content, or synthetic data with no error propagation to the user.

**Cluster 2 — State Persistence (High Risk):**
`HarnessMemory.save()` catches write failures silently (returns `void`). `TelemetryCollector.persistTelemetry()` loses data silently. `ContextAccumulation.loadLoopState()` returns `null`, so loop restarts from scratch.

**Cluster 3 — Filesystem Discovery (Medium Risk):**
ThinkingSeparation, listBackups, listProjects, loadRecords, walkDir, getUnifiedTimeline all return `[]` on read failures. Missing directories are indistinguishable from empty ones. DNAExtractor has 10+ file-read catch blocks that each `continue`, producing empty DNA profiles with no indication of incomplete extraction.

---

## Architecture

### Two Primitives

#### A. `Result<T, E>` for expected failures

Use `neverthrow` library. Expected failures are situations where the caller should decide what to do — retry, fall back, or escalate.

```typescript
import { Result, ok, err } from 'neverthrow';

// Before (silent):
async status(): Promise<GitStatusResult | null> {
  try { return await this.git.status(); }
  catch { return null; }
}

// After (explicit):
async status(): Promise<Result<GitStatusResult, GitError>> {
  try { return ok(await this.git.status()); }
  catch (e) { return err(new GitError('status failed', e)); }
}
```

Callers must explicitly handle both paths:

```typescript
const result = await git.status();
if (result.isErr()) {
  // Caller decides: log, retry, or escalate
  return;
}
const status = result.value;
```

#### B. Typed throws for exceptional states

Exceptional states are invariant violations or corrupt state where continuing is dangerous.

```typescript
// Truly exceptional — invariant violation
if (!configModel) throw new LLMConfigError('No model configured');
```

### Classification Rules

| Failure type | Pattern | Examples |
|-------------|---------|----------|
| Expected failure | `Result<T, E>` | File not found, LLM empty response, network timeout, stash conflict |
| Exceptional state | `throw TypedError` | Config missing required field, serialization corrupt, invariant violated |
| Already correct | Leave as-is | `{ success: false, error }` returns from harness tools |

---

## Error Hierarchy

```
LiminalError (base, extends Error)
├── GitError
│   ├── GitRepoError        — not a repo, permissions
│   ├── GitCommitError      — add/commit failed
│   ├── GitPushError        — push rejected, auth
│   └── GitStashError       — stash pop/push failed
├── CompostError
│   ├── CompostDigestError  — digest cycle failed
│   ├── CompostSoupError    — soup evolution failed
│   └── CompostStoreError   — EventStore read/write failed
├── LLMProviderError        — already exists as LLMError
├── PersistenceError        — state file, config, telemetry writes
└── FileDiscoveryError      — directory scan, DNA extraction incomplete
```

All error classes include:
- `message: string` — human-readable description
- `cause?: Error` — original error for chaining
- `context?: Record<string, unknown>` — module-specific metadata
- `retryable: boolean` — whether the operation can be retried

---

## Priority Tiers

### Tier 1 — Fix First (12 instances, highest impact)

These are the failures that silently lose user data or produce incorrect results:

| # | File | Function | Current | Fix |
|---|------|----------|---------|-----|
| 1 | `LLMClient.ts:585` | `generate()` final catch | Returns `{ code: '', success: false }` | Return `Result<LLMResponse, LLMError>` |
| 2 | `LLMClient.ts:754` | `complete()` final catch | Returns `{ text: '', success: false }` | Return `Result<{text,success}, LLMError>` |
| 3 | `GitIntegration.ts:101` | `startRun()` | Returns `null` | Return `Result<string, GitError>` |
| 4 | `GitIntegration.ts:145` | `commitIteration()` | Returns `null` | Return `Result<CommitInfo, GitError>` |
| 5 | `CompostBridge.ts:43` | `onCommit()` | Returns `null` | Return `Result<CompostEvent, CompostError>` |
| 6 | `CompostBridge.ts:62` | `onBranch()` | Returns `null` | Return `Result<CompostEvent, CompostError>` |
| 7 | `HarnessMemory.ts:204` | `save()` | Returns `void` | Return `Result<void, PersistenceError>` |
| 8 | `ScoringEngine.ts:370` | `evaluateWithLLM()` | Returns `{ score: 0.5 }` | Return `Result<ScoreResult, LLMError>` |
| 9 | `FragmentScorer.ts:62` | `scoreFragment()` | Returns `5` (neutral) | Return `Result<number, LLMError>` |
| 10 | `MiniMaxProvider.ts:213/307` | `generate()` | Returns `{ content: '' }` | Return `Result<ProviderResponse, LLMError>` |
| 11 | `ConfigLoader.ts:265` | `loadConfig()` | Returns `null` | Return `Result<Config, PersistenceError>` |
| 12 | `ContextAccumulation.ts:116` | `loadLoopState()` | Returns `null` | Return `Result<LoopState, PersistenceError>` |

### Tier 2 — Fix Second (~40 instances, medium impact)

RalphLoop catch blocks, CompostSoup/Mill, SandboxRunner, ThinkingSeparation, DNAExtractor, SemanticExtractor, PromptBuilder, StreamParser, RoutingData.

These should be converted to Result returns in a second pass. Each module's catch blocks should be audited individually — some may be acceptable graceful degradation.

### Tier 3 — Acceptable Graceful Degradation (~80 instances)

File discovery returning `[]`, optional feature fallbacks (Meyda, pitchfinder imports), telemetry persistence. These should get a `warn` metric counter but don't need Result types. The fix here is adding structured logging with a failure counter, not changing the return type.

---

## Implementation Rules

1. **Never catch-and-return-null.** If a function can fail, it returns `Result<T, E>`. If failure is truly exceptional, it throws.

2. **Never swallow errors silently.** Every catch block must either:
   - Return `err(new TypedError(...))` (Result pattern)
   - Re-throw with additional context
   - Explicitly log with a structured failure counter AND return an appropriate Result

3. **Callers decide escalation.** The function that detects the failure does NOT decide whether it's fatal. The caller does. This reverses the current pattern where the deepest function swallows the error.

4. **Backward compatibility via `.unwrapOr()` and `.match()`.** neverthrow provides ergonomic helpers:
   ```typescript
   // Quick fallback with explicit acknowledgment
   const status = (await git.status()).unwrapOr(null);
   
   // Full handling
   return (await git.status()).match(
     (s) => formatStatus(s),
     (e) => { Logger.warn('git', e.message); return 'status unavailable'; }
   );
   ```

5. **Existing `{ success: false, error }` pattern is acceptable.** The harness tools already use this correctly — they return structured error objects that callers can inspect. No changes needed.

---

## Dependency

- Add `neverthrow` as a production dependency
- No other new dependencies required

---

## Testing Strategy

1. For each Tier 1 conversion, add tests that:
   - Verify `ok` path returns expected data
   - Verify `err` path returns the correct typed error
   - Verify `err.isErr()` is true for error cases
   - Verify error context/metadata is present

2. For callers updated to handle Result types:
   - Test that callers handle `ok` and `err` branches
   - Test that errors propagate correctly when callers don't handle them

3. No changes to existing test infrastructure — vitest works with both patterns.

---

## Scope Boundaries

**In scope:** All 133 silent failure instances in `src/`
**Out of scope:** Test files, landing page files, build config
**Not changing:** The ~18 harness tool `{ success, error }` returns — these are already explicit
