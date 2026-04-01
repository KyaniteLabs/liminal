# Pre-Existing Issues Log

**Date Discovered:** 2026-03-31  
**Context:** Dogfood QA Campaign - Liminal Harness Improvements  
**Rule:** These issues EXISTED BEFORE any changes made today. Documented for tracking.

---

## Type/Compilation Issues

### T1: dom-webcodecs Type Conflicts
**Location:** `node_modules/@types/dom-webcodecs/` vs `typescript/lib/lib.dom.d.ts`  
**Errors:**
- TS2717: Property 'data' type mismatch (BufferSource vs AllowSharedBufferSource)
- TS2374: Duplicate index signature for type 'number'
- TS2300: Duplicate identifier 'ImageBufferSource'

**Impact:** Build noise, doesn't affect runtime  
**Status:** Pre-existing, dependency issue

### T2: PromptLibrary.ts ES2021 Features
**Location:** `src/prompts/PromptLibrary.ts:57` and `:123`  
**Errors:**
- TS2550: Property 'replaceAll' doesn't exist (needs ES2021+)
- TS2802: Map iteration needs downlevelIteration or ES2015+ target

**Impact:** TypeScript compilation fails with strict settings  
**Status:** Pre-existing, tsconfig target issue

---

## Generator/Harness Issues (Now Fixed)

### G1: HTML Generator No LLM Fallback ➜ FIXED
**Location:** `src/generators/html/HTMLWebGenerator.ts`  
**Issue:** Required LLM, threw 404 errors when LLM unavailable  
**Fix Applied:** Added `isLLMAvailable()` check + template fallbacks

### G2: ASCII Generator No LLM Fallback ➜ FIXED  
**Location:** `src/generators/ascii/ASCIIArtGenerator.ts`  
**Issue:** Required LLM, threw 404 errors when LLM unavailable  
**Fix Applied:** Added `isLLMAvailable()` check + template fallbacks

---

## Validation/Syntax Issues

### V1: Strudel Validator Outdated
**Location:** `src/utils/htmlWrapper.ts`, validator script  
**Issue:** Doesn't recognize Strudel v2 `|>` pipe syntax  
**Evidence:** `strudel-minimax-m25.html` uses `sound("bd") |> gain(1.2)`  
**Status:** PENDING FIX

### V2: GLSL Truncation Detection Missing
**Location:** `src/core/CodeValidator.ts` (doesn't exist yet)  
**Issue:** `glsl-minimax-m25.html` has incomplete code (cuts off at `for(int i = 0; i`)  
**Status:** PENDING FIX

---

## Error Handling Issues

### E1: Timeout Doesn't Save Partial Results
**Location:** `src/llm/LLMClient.ts`  
**Issue:** `three-qwen35.html` shows timeout error but no partial output  
**Evidence:** `<script>// LLM generation failed: The operation was aborted due to timeout</script>`  
**Status:** PENDING FIX

### E2: 404 Errors Not Circuit-Broken
**Location:** All generators using LLM  
**Issue:** Continuous 404 errors don't trigger fallback mode  
**Status:** PENDING FIX

---

## Test Infrastructure Issues

### I1: Landing Page No Automated Validation
**Location:** No existing test suite for landing page examples  
**Issue:** 15/48 examples broken, no CI detection  
**Status:** PENDING FIX (in progress)

### I2: No Visual Regression
**Location:** Test suite  
**Issue:** No screenshot comparison to detect rendering failures  
**Status:** PENDING FIX

---

## Documentation Issues

### D1: Test Count Mismatch
**Location:** README.md claims specific test counts  
**Issue:** May not match actual `npm test` output  
**Status:** NEEDS VERIFICATION

### D2: Persona Count Documentation
**Location:** README.md mentions "7 personas"  
**Issue:** Actual count is 5  
**Status:** Documented in ATOMIC_TASKS.md P1.1

---

## Runtime Issues

### R1: Audio Dependencies Missing
**Location:** `package.json` dependencies vs optionalDependencies  
**Issue:** meyda, pitchfinder referenced but may not be installed  
**Status:** Documented in ATOMIC_TASKS.md P0.1

### R2: ESLint Control Character Warning
**Location:** `src/security/PathSanitizer.ts:19`  
**Issue:** Regex `/[\x00-\x1f]/g` triggers eslint/no-control-regex  
**Status:** Documented in ATOMIC_TASKS.md P0.2

---

## Fix Status Summary

| Category | Total | Fixed | Pending |
|----------|-------|-------|---------|
| Type/Compilation | 2 | 0 | 2 |
| Generator/Harness | 2 | 2 | 0 |
| Validation/Syntax | 2 | 0 | 2 |
| Error Handling | 2 | 0 | 2 |
| Test Infrastructure | 2 | 0 | 2 |
| Documentation | 2 | 0 | 2 |
| Runtime | 2 | 0 | 2 |
| **TOTAL** | **14** | **2** | **12** |

---

## Notes

- All "PENDING" issues require user decision on priority
- Generator fixes (G1, G2) complete - HTML/ASCII now have LLM-less fallbacks
- Next priority: V1 (Strudel syntax), V2 (GLSL truncation) - both affect validation accuracy
- Type issues (T1, T2) may require tsconfig.json changes or dependency updates
