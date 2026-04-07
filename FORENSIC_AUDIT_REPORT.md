# Liminal Codebase - Full Forensic Red Team Audit Report

**Audit Date:** 2026-04-07  
**Auditor:** Multi-Agent Red Team Analysis  
**Scope:** Complete codebase analysis including architecture, security, error handling, async flows, type safety, and test coverage  
**Risk Level:** 🔴 **CRITICAL - DO NOT LAUNCH WITHOUT FIXES**

---

## Executive Summary

This forensic audit has identified **200+ distinct failure modes** across 7 major categories. The most critical finding is a **100% dogfood test failure rate** caused by a chain of silent failures in the generation pipeline. The codebase has significant reliability, security, and maintainability issues that must be addressed before launch.

### Key Statistics

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Architecture | 3 | 6 | 8 | 6 | 23 |
| LLM Providers | 4 | 6 | 8 | 7 | 25 |
| Generators | 4 | 6 | 4 | 0 | 14 |
| Harness/Meta-Harness | 1 | 2 | 10 | 4 | 17 |
| Validation/Guardrails | 5 | 10 | 8 | 0 | 23 |
| Security | 2 | 2 | 4 | 3 | 11 |
| Async/Resource Leaks | 3 | 5 | 10 | 2 | 20 |
| Test Coverage | 0 | 8 | 12 | 15 | 35 |
| TypeScript/Types | 3 | 12 | 18 | 15 | 48 |
| Error Handling | 6 | 12 | 12 | 8 | 38 |
| Configuration | 1 | 2 | 4 | 3 | 10 |
| **TOTAL** | **32** | **71** | **98** | **63** | **264** |

---

## 🔴 CRITICAL FINDINGS (Launch Blockers)

### 1. Self-Improvement Loop Completely Non-Functional
**File:** `src/harness/HarnessUpdater.ts`  
**Severity:** 🔴 CRITICAL  
**Impact:** The entire meta-harness self-improvement system is a no-op

**Evidence:**
```typescript
// Lines 58-76 - Only creates a description, never actually changes anything
private applyQwenSimplification(pattern: Pattern): HarnessAdaptation {
  const description = 'Qwen models: keep prompts simple...';
  const adaptation: HarnessAdaptation = {
    patternId: pattern.id,
    action: 'simplifiedPromptsForQwen',
    description,  // ← Only creates a description
    applied: true,  // ← Claims it was applied
    success: true,  // ← Claims success
    // ... no actual file/prompt modification
  };
  this.adaptations.push(adaptation);  // ← Only logs to array
  return adaptation;
}
```

**Why This Blocks Launch:** The system claims to self-improve but does nothing. This is false advertising and wasted complexity.

---

### 2. 100% Dogfood Test Failure - Empty Code Returns
**Files:** Multiple in generation pipeline  
**Severity:** 🔴 CRITICAL  
**Impact:** No code generation works in production

**Evidence from dogfood-report.json:**
```json
{
  "total": 54,
  "success": 0,
  "failed": 54,
  "results": [
    {
      "domain": "p5",
      "model": "minimax-m27",
      "success": false,
      "error": "LLM returned empty code"
    }
  ]
}
```

**Root Causes:**
1. `LLMClient.ts:608-612` - Returns error message as comment string instead of throwing
2. `TierBasedGenerator.ts:164-166` - Throws but error lacks context
3. `RalphLoop.ts:311-315` - All candidates fail → continues with comment instead of error
4. Sanitization strips all content when LLM returns only narrative text

---

### 3. Circuit Breaker Is Dead Code
**File:** `src/llm/CircuitBreaker.ts` (full implementation), `src/llm/LLMClient.ts` (never used)  
**Severity:** 🔴 CRITICAL  
**Impact:** No protection against cascading failures

**Evidence:**
```typescript
// CircuitBreaker.ts has complete implementation (232 lines)
// LLMClient.ts NEVER imports or uses CircuitBreaker
```

---

### 4. Command Injection via verifyCommand
**File:** `src/harness/agent/HarnessAgent.ts:352-365`  
**Severity:** 🔴 CRITICAL  
**Impact:** Arbitrary code execution via task JSON

**Evidence:**
```typescript
private async runVerification(command: string): Promise<...> {
  await execFileAsync('sh', ['-c', command], { timeout: 30000 });  // VULNERABLE
}
```

---

### 5. Path Traversal Bypass in ValidationGuard
**File:** `src/harness/tools/ValidationGuard.ts:56, 179-181`  
**Severity:** 🔴 CRITICAL  
**Impact:** File system escape, potential data exfiltration

**Evidence:**
```typescript
const isAllowed = prefixes.some(prefix => resolved.startsWith(prefix));
// Bypass: "src/subdir/../../../etc/passwd" when cwd is shallow
```

---

### 6. No Import/Require Validation
**File:** All validators  
**Severity:** 🔴 CRITICAL  
**Impact:** Code can import arbitrary modules including fs, child_process

**Missing Checks:**
- `require('fs')`
- `require('child_process')`
- `fetch()` to external domains
- Dynamic imports

---

### 7. eval() Used for Dynamic Import
**File:** `src/composition/ProjectSerializer.ts:188-189, 226-227`  
**Severity:** 🔴 CRITICAL  
**Impact:** Code injection vulnerability

**Evidence:**
```typescript
const JSZip: any = await eval("import('jszip')").then(...)
```

---

### 8. SSRF Protection Bypass via DNS Rebinding
**File:** `src/security/UrlValidator.ts:51-111`  
**Severity:** 🔴 CRITICAL  
**Impact:** Cloud metadata endpoint access

**Evidence:**
```typescript
// Only checks parsed.hostname, not resolved IP
// Bypass: metadata.evil.com → 169.254.169.254
```

---

### 9. Hardcoded CSRF Secret
**File:** `src/render/PreviewServer.ts:131`  
**Severity:** 🔴 CRITICAL  
**Impact:** CSRF protection ineffective

**Evidence:**
```typescript
getSecret: () => process.env.CSRF_SECRET || 'liminal-csrf-secret-change-in-production'
```

---

### 10. Browser Resource Leaks (Playwright)
**File:** `src/core/RalphLoop.ts:543-598`, `src/render/HeadlessRenderer.ts:209-220`  
**Severity:** 🔴 CRITICAL  
**Impact:** Accumulating zombie browser processes

**Evidence:**
```typescript
try {
  const pipeline = new RenderAndScorePipeline(...);
  const renderResult = await pipeline.process(currentCode);
  await pipeline.close(); // Only on success path
} catch (renderError) {
  // pipeline.close() NEVER CALLED - resource leak!
}
```

---

### 11. All RalphLoop Candidates Fail → Silent Continue
**File:** `src/core/RalphLoop.ts:311-315`  
**Severity:** 🔴 CRITICAL  
**Impact:** User gets comment string instead of error

**Evidence:**
```typescript
if (candidates.length === 0) {
  Logger.warn('RalphLoop', `All ${numCandidates} candidates failed validation`);
  currentCode = '// All candidates failed validation';  // ← Returns comment as "code"
  finalScore = 0;
}
```

---

### 12. HTML Script Injection via Event Handlers
**File:** `src/core/validators/HTMLValidator.ts:106-131`  
**Severity:** 🔴 CRITICAL  
**Impact:** XSS vulnerabilities

**Missing Checks:**
- `javascript:` URLs
- `onclick`, `onload`, `onerror` handlers
- Data URLs with scripts

---

## 🟠 HIGH SEVERITY FINDINGS

### Error Handling Issues (12 high severity)

| Issue | File | Line | Evidence |
|-------|------|------|----------|
| Stack traces lost | `CompostParser.ts` | 82-100 | Creates new error without `{ cause }` |
| Generic Error usage | `Exporter.ts` | 71, 78, 105 | 6 instances of generic Error |
| Internal details exposed | `PreviewServer.ts` | 193, 207, 283 | API exposes raw error messages |
| Errors swallowed | `CompostSoup.ts` | 167 | `.catch(() => { /* aborted */ })` |
| User-facing tech details | `tui/index.tsx` | 267 | Raw error shown to user |

### Async/Resource Issues (5 high severity)

| Issue | File | Line | Evidence |
|-------|------|------|----------|
| Unhandled promise | `RalphLoop.ts` | 737-739 | Fire-and-forget with only catch |
| Missing timeout | `RenderAndScorePipeline.ts` | 98-178 | No overall timeout enforcement |
| Race condition | `BatchProcessor.ts` | 206-225 | Promise.race cleanup race |
| Process leak | `RalphLoop.ts` | 122-154 | ffmpeg child process zombies |
| Git lock leaks | `RalphLoop.ts` | 119, 864 | Cleanup may not execute |

### TypeScript Issues (12 high severity)

| Issue | File | Count | Evidence |
|-------|------|-------|----------|
| Non-null assertions | `CollisionEngine.ts` | 9 | `byDomain.get(dom)!.push()` |
| `as any` casts | Multiple | 25+ | Type safety bypasses |
| `as unknown as` | `EventBus.ts` | 3 | No runtime validation |
| JSON.parse() no validation | `PromptHistory.ts` | 3 | Direct cast after parse |
| TUI props as `any` | `tui/index.tsx` | 9 | No type checking |

### Test Coverage Issues (8 high severity)

| Issue | Files | Count | Evidence |
|-------|-------|-------|----------|
| No unit tests | `TierBasedGenerator.ts` | 1 | Core component untested |
| Excessive mocking | `HarnessAgent.test.ts` | 1 | All dependencies mocked |
| Silent skips | `guardrails-e2e.test.ts` | 12 | Returns instead of failing |
| Tests don't test code | `generateMusicToVisual.test.ts` | 1 | Only checks existence |

---

## 📊 DETAILED FINDINGS BY CATEGORY

### Category 1: Architecture & Core Loop (23 issues)

**Key Files Audited:**
- `src/core/RalphLoop.ts`
- `src/core/CodeValidator.ts`
- `src/generators/TierBasedGenerator.ts`
- `src/llm/LLMClient.ts`
- `src/llm/StreamParser.ts`

**Critical Patterns:**
```typescript
// Pattern 1: Silent candidate failure (RalphLoop.ts:260)
const generationResult = await generator.generate(...);
const { code, thinking, model } = generationResult;  // No null check

// Pattern 2: Error-as-code return (LLMClient.ts:608-612)
return {
  code: `// LLM generation failed: ${errMsg}`,  // Looks like valid code
  success: false,  // Caller may not check this
};

// Pattern 3: Validation skip on all fail (RalphLoop.ts:266-281)
if (!validation.valid) {
  continue;  // Silently skips
}
```

### Category 2: LLM Provider System (25 issues)

**Key Findings:**
1. **CircuitBreaker exists but is never used**
2. **Stream parse errors swallowed** with debug-only logging
3. **Timeout errors not proper type** - appear as generic "aborted" messages
4. **Fallback failures not aggregated** - only primary error surfaced
5. **Ollama loses error response body** - no `.text()` call

**Evidence:**
```typescript
// StreamParser.ts:66-68 - Errors swallowed
} catch (err) {
  Logger.debug('StreamParser', 'Failed to parse JSON chunk:', err);
}

// RetryManager.ts:32-36 - Only retries specific types
if (!(error instanceof LLMTimeoutError) && !(error instanceof LLMRateLimitError)) {
  throw error;  // Network errors not retried!
}
```

### Category 3: Generators (14 issues)

**Empty Code Return Paths:**
1. `TierBasedGenerator.generate()` - delegates without validation
2. `StrudelGenerator.sanitizeCode()` - can filter to empty
3. `HydraGenerator.sanitizeCode()` - can filter to empty
4. `ToneGenerator.sanitizeCode()` - no length check
5. `LLMClient.generate()` - returns error-as-code comment

**Error Swallowing:**
- `TierBasedGenerator.generateLayer()` - hardcoded `validation: { passed: true }`
- HTMLWebGenerator throws but error type inconsistent

### Category 4: Harness/Meta-Harness (17 issues)

**The Big One:** Self-improvement is completely broken - all `apply*()` methods are no-ops that only log.

**Other Issues:**
- Pattern detection uses string literals instead of Domain constants
- Rollback failures not reported
- JSON parsing without try-catch in FailureLogger
- RateLimiter history grows unbounded

### Category 5: Validation & Guardrails (23 issues)

**Critical Security Gaps:**
1. Path traversal check happens AFTER path.resolve()
2. No import/require validation
3. No network request validation
4. HTML event handlers not checked
5. Prototype pollution not prevented

**False Positives/Negatives:**
- GLSLValidator captures variable declarations as "functions"
- P5Validator doesn't detect arrow functions
- ToneValidator class list incomplete
- HydraValidator has string-match false positives

### Category 6: Security (11 issues)

See CRITICAL findings above plus:
- Weak CSRF secret fallback
- Path traversal in backup restoration
- Plugin loading without signature verification
- No authentication/authorization system

### Category 7: Async/Resource Leaks (20 issues)

**Resource Leaks:**
1. Playwright browser instances accumulate
2. Event listeners never removed from pages
3. Git locks may not be cleaned up
4. Child processes (ffmpeg) may become zombies
5. AbortSignal not propagated to fallbacks

**Race Conditions:**
- BatchProcessor concurrency control has race condition
- Circuit breaker state transition not atomic

### Category 8: Test Coverage (35 issues)

**Major Gaps:**
- `TierBasedGenerator.ts` - zero unit tests
- `HarnessAgent.test.ts` - mocks everything, tests nothing real
- 25+ tests silently skip instead of failing
- 45+ files with excessive mocking
- Environment-dependent tests (80+ cases)

### Category 9: TypeScript/Types (48 issues)

**Critical:**
- `eval()` usage in ProjectSerializer.ts
- Multiple `any` types in AudioExtractor.ts
- Core config types use `any` for guidanceEngine

**High:**
- 9 non-null assertions in CollisionEngine.ts
- 25+ `as any` casts
- 3 `as unknown as` patterns
- JSON.parse without validation

### Category 10: Error Handling (38 issues)

**Stack Trace Loss:**
- 15 instances where new errors don't preserve `{ cause }`
- Error messages converted to strings, losing context

**Generic Error Usage:**
- 35+ instances of `throw new Error()` instead of specific types

**Silent Failures:**
- 12 instances of errors being swallowed
- 8 errors not being logged at all

### Category 11: Configuration (10 issues)

**Critical:**
- Hardcoded CSRF secret

**High:**
- API key potential logging in TUI debug

**Medium:**
- Missing required env var validation
- SSRF allowlist bypass
- Silent config loading failures

---

## 🎯 REMEDIATION PLAN

### Phase 1: Launch Blockers (Must Fix Before Launch)

**Week 1-2: Critical Fixes**

1. **Fix empty code issue**
   - Change `LLMClient.ts:608-612` to throw instead of return comment
   - Add proper error propagation in `RalphLoop.ts:311-315`
   - Fix sanitization to preserve code blocks

2. **Remove or fix harness self-improvement**
   - Either implement actual adaptations in `HarnessUpdater.ts`
   - Or remove the feature entirely

3. **Fix command injection**
   - Sanitize `verifyCommand` in `HarnessAgent.ts`
   - Use allowlist approach

4. **Fix path traversal**
   - Check traversal BEFORE path.resolve()
   - Add proper path normalization

5. **Fix resource leaks**
   - Add try-finally in `RalphLoop.ts:543-598`
   - Ensure Playwright pages are closed

6. **Fix security issues**
   - Remove hardcoded CSRF secret
   - Remove eval() usage
   - Add import validation

### Phase 2: High Priority (Fix Within 1 Month)

**Week 3-4: Error Handling**
- Add `{ cause: error }` to all error wrapping
- Replace generic Error with specific types
- Sanitize user-facing error messages

**Week 5-6: Type Safety**
- Replace `any` types with proper types
- Remove non-null assertions
- Add runtime validation for JSON.parse()

**Week 7-8: Testing**
- Add unit tests for `TierBasedGenerator.ts`
- Fix silent skips in E2E tests
- Reduce mocking in HarnessAgent tests

### Phase 3: Medium Priority (Fix Within 3 Months)

- Implement CircuitBreaker usage in LLMClient
- Add SSRF DNS rebinding protection
- Fix async race conditions
- Add import/require validation to all validators
- Complete ToneValidator class list

### Phase 4: Low Priority (Ongoing)

- Standardize error message formats
- Add more edge case tests
- Improve TUI type definitions
- Add jitter to retry backoff
- Document type conventions

---

## 📈 SUCCESS METRICS

Before fixes:
- Dogfood pass rate: 0%
- Test coverage (real): ~30%
- Silent failure rate: Unknown (not tracked)

After Phase 1 fixes (target):
- Dogfood pass rate: >80%
- Zero silent failures in critical paths
- All launch blockers resolved

After Phase 2 fixes (target):
- Dogfood pass rate: >90%
- Test coverage (real): >60%
- Type safety: Zero `any` in core files

---

## 📁 FILES REQUIRING IMMEDIATE ATTENTION

| Priority | File | Issues | Primary Problem |
|----------|------|--------|-----------------|
| 🔴 | `src/harness/HarnessUpdater.ts` | 1 | Self-improvement no-op |
| 🔴 | `src/core/RalphLoop.ts` | 8 | Empty code handling |
| 🔴 | `src/llm/LLMClient.ts` | 6 | Error-as-code |
| 🔴 | `src/harness/agent/HarnessAgent.ts` | 2 | Command injection |
| 🔴 | `src/harness/tools/ValidationGuard.ts` | 2 | Path traversal |
| 🔴 | `src/render/PreviewServer.ts` | 2 | CSRF secret, error exposure |
| 🔴 | `src/composition/ProjectSerializer.ts` | 2 | eval() usage |
| 🟠 | `src/core/RalphLoop.ts` | 5 | Resource leaks |
| 🟠 | `src/render/HeadlessRenderer.ts` | 3 | Event listener leaks |
| 🟠 | `src/llm/CircuitBreaker.ts` | 1 | Dead code |
| 🟠 | `src/llm/RetryManager.ts` | 2 | Retry logic gaps |
| 🟠 | `src/core/BatchProcessor.ts` | 2 | Race conditions |

---

## 🔍 AUDIT METHODOLOGY

This audit was conducted using:
1. **Static code analysis** across 439+ source files
2. **Pattern matching** for known failure modes
3. **Test artifact analysis** (dogfood reports, logs)
4. **Subagent parallel analysis** of specific domains
5. **Security-focused code review** for injection vectors

**Tools Used:**
- Grep for pattern detection
- File reading for detailed analysis
- Dogfood report JSON analysis
- Test file examination

---

## ✅ POSITIVE FINDINGS

Despite the issues, the codebase has several strengths:

1. **Good error type hierarchy** - LLMError, LiminalError, etc. are well-defined
2. **SSR protection exists** - Just needs DNS rebinding fix
3. **Rate limiting configured** - Properly implemented
4. **CSP headers** - Strict policy in place
5. **Path sanitization** - Good foundation, needs hardening
6. **Secret redaction** - API keys redacted in logs
7. **Strict TypeScript** - Strict mode enabled
8. **No ts-ignore** - Clean codebase without suppressions

---

## 📝 CONCLUSION

**DO NOT LAUNCH** in the current state. The combination of:
- 100% dogfood test failure
- Critical security vulnerabilities
- Completely broken self-improvement
- Resource leaks
- Silent failure modes

...makes this codebase unsuitable for production deployment.

**Estimated time to production-ready:** 4-6 weeks with dedicated effort on Phase 1 and Phase 2 items.

---

**Report Generated:** 2026-04-07  
**Next Review:** After Phase 1 fixes implemented  
**Distribution:** Internal Development Team Only
