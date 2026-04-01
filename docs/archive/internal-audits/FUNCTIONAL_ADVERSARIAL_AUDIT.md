# Liminal — Functional Adversarial Audit Report

**Date:** 2026-03-30  
**Auditor:** Red Team (Functionality Focus)  
**Scope:** Functionality, Promises vs Reality, Documentation Accuracy, Code Quality, Output Quality  
**Version Audited:** 1.0.0  

---

## Executive Summary

| Category | Status | Score | Notes |
|----------|--------|-------|-------|
| **Test Suite** | ⚠️ DEGRADED | B+ | 2,487/2,502 passing (99.4%), but 14 failures in critical areas |
| **Documentation Accuracy** | ⚠️ OUTDATED | C+ | Multiple stale claims, inflated numbers |
| **Code Quality** | ✅ ACCEPTABLE | B | Well-structured but has lint errors, duplicates |
| **Dependency Integrity** | ❌ BROKEN | D | Missing required dependencies (meyda, pitchfinder) |
| **Feature Completeness** | ⚠️ PARTIAL | B- | Many features exist but aren't wired to core loop |
| **Output Quality** | ✅ GOOD | B+ | Solid evaluation engine, good code extraction |

**Overall Assessment:** The codebase is functional and well-architected but suffers from documentation drift, missing dependencies, and "vaporware" features that exist in code but aren't integrated into the main execution path.

---

## 1. Test Suite Analysis

### Current State
```
Test Files: 199 passed | 9 failed (208 total)
Tests:      2,487 passed | 14 failed | 1 skipped (2,502 total)
Duration:   125.23s
```

### Failed Test Breakdown

| Test File | Failure | Severity | Root Cause |
|-----------|---------|----------|------------|
| `preview-server-api.test.js` | 403 on `/api/sandbox/run` | **HIGH** | CSRF protection blocking test requests |
| `lint.test.ts` | ESLint error | **MEDIUM** | Control character regex in PathSanitizer.ts |
| `sandbox.test.ts` | Test timeout | **MEDIUM** | Test itself hangs on infinite loop check |
| `audio-analyzer.test.ts` | RMS = 0 | **HIGH** | `meyda` dependency not installed |
| `audio-extractor.test.ts` | RMS = 0 | **HIGH** | `meyda` dependency not installed |
| `pitch-extractor.test.ts` (×2) | null pitch | **HIGH** | `pitchfinder` dependency not installed |

### Audit Verdict: ⚠️ DEGRADED
- 99.4% pass rate sounds good, but failures are in **critical subsystems**
- Audio pipeline is completely non-functional due to missing dependencies
- Security middleware is working (hence 403) but tests weren't updated

---

## 2. Promises vs Reality

### 2.1 Documentation Claims Audit

| Claim | Location | Reality | Status |
|-------|----------|---------|--------|
| "2365 tests passing" | README.md Line 768 | 2,487 tests passing (outdated count) | ❌ STALE |
| "100+ techniques across p5, shader, three, music" | README.md Line 78 | ~108 techniques exist in knowledge base | ✅ ACCURATE |
| "7 Ollama personas" | README.md Line 209 | Only 5 personas defined (Kai, Nova, Rex, Sam, Max) | ❌ FALSE |
| "Live preview renders each iteration" | README.md Line 301 | Preview server exists but no live iteration preview | ⚠️ MISLEADING |
| "Hardware MIDI/OSC integration" | PRD.md Line 260 | Config placeholders only, no actual implementation | ❌ VAPORWARE |
| "LIR Integration" | README.md Phase 10 | Parser exists but integration is shallow | ⚠️ PARTIAL |

### 2.2 The "7 Persona" Swarm Deception

**README Claims:**
```
The 7 Personas:
| Kai (Architect) | lfm2.5-thinking:1.2b |
| Nova (Synthesizer) | gemma3:4b |
| Rex (Explorer) | phi4-mini |
| Sam (Muse) | qwen3.5:2b |
| Max (Distiller) | granite4:350m |
```

**Reality Check:**
```typescript
// src/swarm/personas.ts - Only 5 personas exist
export const DEFAULT_PERSONAS: SwarmPersona[] = [
  { id: 'kai', displayName: 'Kai (Architect)', model: 'lfm2.5-thinking:1.2b', ... },
  { id: 'nova', displayName: 'Nova (Synthesizer)', model: 'gemma3:4b', ... },
  { id: 'rex', displayName: 'Rex (Explorer)', model: 'phi4-mini', ... },
  { id: 'sam', displayName: 'Sam (Muse)', model: 'qwen3.5:2b', ... },
  { id: 'max', displayName: 'Max (Distiller)', model: 'granite4:350m', ... },
];
```

**Verdict:** Documentation claims 7 personas but only 5 exist. The table in README.md shows 5 entries but is introduced as "The 7 Personas".

### 2.3 Unwired "Library" Features

Several features exist as code but are explicitly marked as **not wired into RalphLoop**:

| Feature | File | Export Comment | Status |
|---------|------|----------------|--------|
| AestheticModel | src/index.ts:415 | "@library Public API — not wired into RalphLoop" | 🚧 ORPHANED |
| MetaMode | src/index.ts:418 | "@library Public API — not wired into RalphLoop" | 🚧 ORPHANED |
| ArchiveLearning | src/index.ts:578 | "@library Public API — not wired into RalphLoop" | 🚧 ORPHANED |
| DNAExtractor | src/index.ts:538 | "@library Public API — not wired into RalphLoop" | 🚧 ORPHANED |

These features can be imported and used programmatically, but the main `run()` function and CLI don't utilize them.

---

## 3. Code Quality Issues

### 3.1 Critical Code Defects

#### Issue: Duplicate Promise Detection Logic
**Location:** `src/core/RalphLoop.ts` Lines 421-450

```typescript
// Lines 421-428: First check
const promiseDetected = PromiseDetector.detect(currentCode);
normalizedOptions.onProgress?.({...});

// Lines 439-443: Second check (identical)
if (promiseDetected) {
  completed = true;
  reason = 'promise detected in generated code';
  break;
}

// Lines 446-450: THIRD check (still identical)
if (promiseDetected) {
  completed = true;
  reason = 'promise detected in generated code';
  break;
}
```

**Impact:** No functional impact, but reveals lack of code review.

#### Issue: ESLint Error in Production Code
**Location:** `src/security/PathSanitizer.ts` Line 19

```typescript
const CONTROL_CHAR_REGEX = /[\x00-\x1f]/g;  // ESLint: no-control-regex error
```

**Impact:** Lint test fails. Potential security review concern.

### 3.2 Missing Dependencies

#### Audio Pipeline Dependencies
```json
// package.json dependencies - THESE ARE MISSING:
"meyda": "^5.6.3"        // For audio feature extraction
"pitchfinder": "^3.0.1"  // For pitch detection
```

The audio subsystem gracefully degrades to defaults when these aren't found, but **tests fail** and functionality is essentially stubbed.

**Evidence from AudioExtractor.ts:**
```typescript
function getMeydaSync(): any {
  try {
    const { createRequire } = require('module') as any;
    const req = createRequire(import.meta.url);
    const mod = req('meyda');  // Will always fail - not installed
    // ...
  } catch {
    return null;  // Falls back to zeroed defaults
  }
}
```

### 3.3 Architecture Observations

#### Strengths
- Clean separation of concerns (generators, evaluators, loops)
- Good TypeScript typing throughout
- Comprehensive event bus for monitoring
- Well-designed prompt library system

#### Weaknesses
- RalphLoop.ts is 555 lines and does too much (though partially mitigated by extraction)
- Heavy use of optional chaining (`?.`) may hide undefined behavior
- Some modules have circular import risks

---

## 4. Output Quality Assessment

### 4.1 CreativeEvaluator — STRONG

The evaluation engine is surprisingly sophisticated:

**Dimensions Evaluated:**
- Technical score (syntax, structure, completeness)
- Creative score (animation, color, interactivity)
- Emergence score (particle systems, CA, noise, flocking)
- Interestingness score (variance, richness, dynamics)
- Sound score (audio API detection)

**LIR Integration:**
- LIR (Liminal Intermediate Representation) tokens overlay regex-based scoring
- Provides more precise metrics (cyclomatic complexity, nesting depth)
- Feature-flagged with cold fallback

### 4.2 Code Extraction — STRONG

Multi-pass code extraction from LLM responses is well-implemented:

```typescript
// LLMClient.ts Lines 207-317
// Pass 1: Extract from markdown fences
// Pass 2: Find code keywords (let, const, function, etc.)
// Pass 3: Skip reasoning patterns
// Final cleanup: Remove leading non-code lines
```

### 4.3 Prompt Library — EXCELLENT

Comprehensive prompt templates with context injection:
- Domain-specific prompts (p5, glsl, three, strudel, hydra)
- Persona prompts for swarm
- Specialized prompts (chat, evaluation, design)

---

## 5. Security Findings (Non-Functional Scope)

While this audit focuses on functionality, note:
- CSRF protection is **active and working** (causing test 403s)
- SSRF protection on LLM URLs is implemented
- Path sanitization has control character issues (see 3.1)

---

## 6. Recommendations

### Immediate (P0)

1. **Fix Missing Dependencies**
   ```bash
   npm install meyda pitchfinder
   ```
   Or remove audio features from public API.

2. **Fix ESLint Error**
   - Escape control characters properly in PathSanitizer.ts
   - Or add eslint-disable with security justification

3. **Update Test for CSRF**
   - Preview server tests need to handle CSRF tokens

4. **Remove Duplicate Code**
   - Clean up RalphLoop.ts promise detection (lines 446-450)

### Short-term (P1)

5. **Update Documentation**
   - Fix "7 personas" claim (change to 5)
   - Update test count (2487 not 2365)
   - Clarify which features are "library only" vs "wired"

6. **Decide on Orphaned Features**
   - Either wire AestheticModel, MetaMode, etc. into RalphLoop
   - Or move to separate packages
   - Or document as "experimental/unwired"

### Long-term (P2)

7. **Reduce Module Size**
   - RalphLoop.ts should be <300 lines
   - Extract more orchestration logic

8. **Add Integration Tests**
   - End-to-end tests that verify full loop execution
   - Currently most tests are unit tests

---

## 7. Conclusion

Liminal is a **functional and architecturally sound** creative coding agent with:

- ✅ Solid evaluation engine with multi-dimensional scoring
- ✅ Well-designed prompt system
- ✅ Good TypeScript architecture
- ⚠️ Documentation that has drifted from reality
- ❌ Missing critical dependencies for audio features
- ❌ Several "vaporware" features that exist but aren't wired

**Recommendation:** Before public release:
1. Fix the 14 failing tests
2. Install missing dependencies or remove audio features
3. Update documentation to match reality
4. Either integrate or remove orphaned features

The core Ralph-Wiggum Loop works as advertised. The issues are primarily around polish, documentation accuracy, and completeness.

---

**Audit Signature:** Red Team Functional Audit  
**Next Review:** After P0 items addressed
