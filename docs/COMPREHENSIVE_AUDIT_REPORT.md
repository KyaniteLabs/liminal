# Comprehensive Audit Report: Everything Wrong

**Worktree:** `agent-comprehensive-audit-1775573255`  
**Date:** 2026-04-07  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

| Metric | Result | Status |
|--------|--------|--------|
| Build | Clean | ✅ |
| TypeCheck | Clean | ✅ |
| Lint | 34 warnings | ⚠️ |
| Tests | 36 failed, 21 errors | 🔴 |
| Unhandled Rejections | 21 | 🔴 |

**Critical Finding:** Tests are attempting real LLM calls despite test setup clearing env vars. Multiple integration issues blocking correct functionality.

---

## 🔴 CRITICAL ISSUES (Blocking Functionality)

### 1. Tests Using Real LLM Despite Setup Clearing Env Vars

**Problem:** Test setup clears LLM env vars, but tests still attempt real LLM calls and fail.

**Affected Files:**
- `test/integration/generator-renderer.test.js` (21 tests fail)
- `test/unit/generators/p5-generator-llm.test.ts` (no mocks)
- `test/unit/ralph-loop.test.ts` (triggers fallback to P5GeneratorLLM)

**Error:**
```
GenerationError: [P5Generator] Using LLM-based generation. 
Ensure LIMINAL_LLM_API_KEY or OPENAI_API_KEY is set.
```

**Root Cause:** Tests instantiate P5GeneratorLLM directly without mocking LLMClient.

**Fix Required:** Add `vi.mock('../../../src/llm/LLMClient.js')` to all affected test files.

---

### 2. 21 Unhandled Promise Rejections

**Problem:** Tests throw unhandled rejections from P5GeneratorLLM.

**Impact:** False positive test results, unstable test suite.

**Fix Required:** Wrap generator calls in try/catch or ensure proper mocking.

---

### 3. ToneGenerator Not Stripping Thinking Tags

**File:** `test/unit/generators/ToneGenerator.test.ts`

**Test:** `generate strips thinking tags from output`

**Error:**
```
AssertionError: expected '<think hmm</think>\nconst t = new Ton…' not to contain '<think'
```

**Problem:** ToneGenerator not properly stripping `<think>...</think>` tags from LLM output.

**Fix Required:** Update thinking tag regex in ToneGenerator or base class.

---

### 4. TextGenerativeGenerator Validation Too Strict

**File:** `test/unit/generators/TextGenerativeGenerator.test.ts`

**Failures:** 7 tests fail

**Error:**
```
GenerationError: TextGenerativeGenerator: Output appears to be code, not text art
```

**Problem:** Validator incorrectly rejects valid text art that contains code-like characters.

---

### 5. Gallery Tests Missing Directories

**Files:** 
- `test/integration/evaluator-gallery.test.js`
- Multiple gallery-related tests

**Error:**
```
ENOENT: no such file or directory, scandir 'test-gallery-temp'
```

**Problem:** Tests reference directories that don't exist. Missing setup to create test directories.

---

### 6. GitIntegration Fails Due to .gitignore

**File:** `test/e2e/model-comparison.test.ts`

**Error:**
```
[GitIntegration] Failed to commit iteration: The following paths are ignored by one of your .gitignore files:
gallery
```

**Problem:** Tests try to commit to gallery/ which is gitignored.

**Fix Required:** Use force flag (`-f`) or test in non-gitignored directory.

---

### 7. GitIntegration Outside Repository

**File:** `test/integration/ralph-loop-collab.test.ts`

**Error:**
```
[GitIntegration] Failed to commit iteration: ...is outside repository at '/Users/.../agent-comprehensive-audit-1775573255'
```

**Problem:** Temp directories outside git repo can't be committed.

---

### 8. SupplyChainGuardrail Log Spam

**File:** `src/guardrails/compliance/SupplyChainGuardrail.ts`

**Error:**
```
[SupplyChainGuardrail] Failed to read package.json while finding project root:
ENOENT: no such file or directory, open '.../src/guardrails/compliance/package.json'
```

**Problem:** Function logs warnings for every directory it checks. Creates noise in test output.

**Fix Required:** Reduce log level or only log at final failure.

---

### 9. Model Comparison Tests Failing

**File:** `test/e2e/model-comparison.test.ts`

**Failures:** 5 tests fail

**Error:** *(Historical — Remotion was replaced by Revideo in PR #391)*
```
[RalphLoop] Candidate 0 generation failed: RalphLoop: RemotionGenerator: 
Generated code does not appear to be a valid Remotion component
```

**Problem:** Generators producing invalid code for the domain.

---

### 10. ParticleSystem Test Fails

**File:** `test/unit/generators/ParticleSystem.test.ts`

**Failures:** 1 test fails

**Problem:** Test expectations don't match actual output.

---

### 11. Preview Server Test Fails

**File:** `test/integration/preview-server.test.js`

**Failures:** 1 test fails

**Problem:** Port conflict or timing issue.

---

## ⚠️ HIGH PRIORITY ISSUES (Code Quality)

### 12. Console.log Instead of Logger

**Files:**
- `src/git/GitCLI.ts` (28 console statements)
- `src/composition/adapters/ShaderAdapter.ts` (3 console.error)
- `src/music/StructureTemplates.ts` (examples use console.log)

**Problem:** Direct console.log usage instead of Logger utility.

**Fix Required:** Replace with `Logger.info()`, `Logger.error()`, etc.

---

### 13. Async Functions Without Await

**Files:**
- `src/git/CompostBridge.ts` (lines 31, 52)
- `src/intuition/IntuitionStrategy.ts` (line 113)

**Lint Error:**
```
Async method 'onCommit' has no 'await' expression
```

**Fix Required:** Remove async keyword or add await.

---

### 14. nodeprompt Module Has Broken Imports

**Files:** Multiple in `src/nodeprompt/`

**Problem:** Imports reference `.js` files that don't exist:
```typescript
import type { Vec3 } from '../types/index.js';  // File is index.ts, not index.js
```

**Impact:** TypeScript handles this, but inconsistent naming.

---

## 📋 MEDIUM PRIORITY (Test/Config Issues)

### 15. No .env File Present

**Problem:** No local environment configuration.

**Impact:** Tests requiring LLM fail, developers need to create manually.

**Fix Required:** Add `.env` to .gitignore and provide `.env.example` documentation.

---

### 16. Test Files Missing Mocks

**Files:**
- `test/integration/generator-renderer.test.js` - No LLM mocks
- `test/unit/generators/p5-generator-llm.test.ts` - No LLM mocks

**Problem:** Tests call real LLM when env vars cleared.

---

### 17. Fire-and-Forget Patterns Without Error Handling

**Files:** Multiple (see fire-and-forget list in audit)

**Pattern:**
```typescript
someAsyncOp().catch(() => {});  // Silently swallows errors
```

**Problem:** Errors silently ignored.

---

## 📊 COMPLETE FAILURE BREAKDOWN

### Failed Test Files (6)

| File | Failed Tests | Issue |
|------|--------------|-------|
| `test/integration/generator-renderer.test.js` | 21 | No LLM mocks |
| `test/unit/generators/TextGenerativeGenerator.test.ts` | 7 | Validation too strict |
| `test/e2e/model-comparison.test.ts` | 5 | Invalid code generation |
| `test/unit/generators/ParticleSystem.test.ts` | 1 | Test expectation mismatch |
| `test/integration/preview-server.test.js` | 1 | Port/timing issue |
| `test/unit/generators/ToneGenerator.test.ts` | 1 | Thinking tags not stripped |

### Error Categories

| Category | Count | Severity |
|----------|-------|----------|
| Unhandled Rejections | 21 | 🔴 Critical |
| ENOENT (missing files) | 8 | 🔴 Critical |
| Generation Errors | 15 | 🔴 Critical |
| Git Integration | 5 | ⚠️ High |
| Validation Errors | 7 | ⚠️ High |

---

## 🔧 REQUIRED FIXES (Priority Order)

### Immediate (Blocking CI/CD)

1. **Add LLM Mocks to Tests**
   ```typescript
   // Add to top of failing test files
   vi.mock('../../../src/llm/LLMClient.js', () => ({
     LLMClient: vi.fn(() => ({
       generate: vi.fn().mockResolvedValue({ code: '...', success: true })
     }))
   }));
   ```

2. **Fix ToneGenerator Thinking Tag Stripping**
   - Update regex in `src/generators/tone/ToneGenerator.ts`

3. **Fix TextGenerativeGenerator Validation**
   - Relax validation in `src/generators/textgen/TextGenerativeGenerator.ts`

4. **Fix Gallery Test Setup**
   - Add directory creation in test setup

### Short Term (This Week)

5. **Fix GitIntegration .gitignore Issue**
   - Use `git add -f` or change test directory

6. **Reduce SupplyChainGuardrail Log Spam**
   - Only log final failure, not each attempt

7. **Fix Console.log Usage**
   - Replace with Logger in GitCLI.ts

8. **Fix Async Without Await**
   - Remove async or add await

### Medium Term (Next Sprint)

9. **Fix nodeprompt Imports**
   - Standardize on .js extensions

10. **Add Missing Test Mocks**
    - Audit all test files for missing mocks

11. **Fix Fire-and-Forget Error Handling**
    - Add proper error logging

---

## 📁 FILES REQUIRING CHANGES

### Source Files (9)

1. `src/generators/tone/ToneGenerator.ts` - Thinking tag stripping
2. `src/generators/textgen/TextGenerativeGenerator.ts` - Validation logic
3. `src/guardrails/compliance/SupplyChainGuardrail.ts` - Logging
4. `src/git/GitCLI.ts` - Console.log → Logger
5. `src/git/CompostBridge.ts` - Async/await
6. `src/intuition/IntuitionStrategy.ts` - Async/await
7. `src/core/GitIntegration.ts` - .gitignore handling
8. `src/composition/adapters/ShaderAdapter.ts` - Console.error
9. `src/nodeprompt/*/index.ts` - Import extensions

### Test Files (8)

1. `test/integration/generator-renderer.test.js` - Add LLM mocks
2. `test/unit/generators/p5-generator-llm.test.ts` - Add LLM mocks
3. `test/unit/generators/TextGenerativeGenerator.test.ts` - Fix expectations
4. `test/unit/generators/ToneGenerator.test.ts` - Fix expectations
5. `test/integration/evaluator-gallery.test.js` - Add setup
6. `test/e2e/model-comparison.test.ts` - Fix git integration
7. `test/integration/ralph-loop-collab.test.ts` - Fix temp directory
8. `test/unit/generators/ParticleSystem.test.ts` - Fix expectations

---

## 🎯 VERIFICATION CHECKLIST

After fixes, verify:

- [ ] `npm test -- --run` passes with 0 failures
- [ ] `npm run lint` shows 0 warnings
- [ ] No unhandled rejections in test output
- [ ] All 21 subsystems functional
- [ ] TUI commands work
- [ ] Dogfood pipeline runs

---

## CONCLUSION

**Current State:** 🔴 NOT PRODUCTION READY

**Primary Blockers:**
1. 21 unhandled rejections from LLM tests
2. 36 failing tests
3. Missing LLM mocks in integration tests

**Recommendation:** Fix critical issues before merging to main. Estimated fix time: 2-3 days.

---

*Audit completed in worktree: agent-comprehensive-audit-1775573255*
