# Broken Examples Analysis - Liminal Improvement Insights

**Analysis Date:** 2026-03-31
**Analyst:** Liminal Self-Analysis
**Scope:** DO NOT fix examples manually - only extract insights for Liminal harness improvements

---

## Summary of Broken Examples

| Domain | Count | Root Cause | Liminal Fix Needed |
|--------|-------|------------|-------------------|
| HTML | 6/6 | LLM 404 Not Found | Generator needs LLM-less fallback |
| ASCII | 6/6 | LLM 404 Not Found | Generator needs LLM-less fallback |
| GLSL | 1/6 | **Truncated output** | Partial generation detection |
| Three.js | 1/6 | Timeout | Timeout handling & partial results |
| Strudel | 1/6 | **Syntax evolution** | Validator outdated (pipe syntax) |

---

## Detailed Findings

### F1: Partial Generation (GLSL - glsl-minimax-m25.html)

**Evidence:**
```glsl
for(int i = 0; i`;  // <-- CODE CUTS OFF MID-LINE

// Missing: rest of fbm(), main(), gl_FragColor
```

**Root Cause:** LLM output truncated but Liminal accepted it as complete.

**Liminal Harness Fix Needed:**
- Add completion detection for GLSL (must end with `}` and contain `gl_FragColor`)
- Detect truncated loops/functions
- Auto-retry with "complete the code" prompt

---

### F2: Syntax Evolution (Strudel - strudel-minimax-m25.html)

**Evidence:**
```javascript
// OLD SYNTAX (what validator expects):
stack(s("bd*4"), note("c4"))

// NEW SYNTAX (what was generated):
sound("bd*4") |> gain(1.2) |> shape(0.3)
```

**Root Cause:** Strudel v2 introduced pipe operator `|>`. Liminal's validator doesn't recognize it.

**Liminal Harness Fix Needed:**
- Update Strudel pattern detection: add `|>` operator
- Update prompt templates to mention both syntaxes
- Add syntax version detection

---

### F3: Timeout Without Partial Result (Three.js - three-qwen35.html)

**Evidence:**
```html
<script>// LLM generation failed: The operation was aborted due to timeout</script>
```

**Root Cause:** LLMClient timeout aborts entire operation, no partial result saved.

**Liminal Harness Fix Needed:**
- Stream partial results during generation
- On timeout: return what we have + mark as incomplete
- Retry strategy for timeouts (shorter chunks)

---

### F4: LLM Dependency When Not Available (HTML/ASCII)

**Evidence:**
```
LLM generation failed: LLM API error: 404 Not Found
```

**Root Cause:** HTMLWebGenerator and ASCIIArtGenerator require LLM with no graceful degradation.

**Liminal Harness Fix Needed:**
- Pre-flight check: LLM availability
- Template-based fallbacks that work without LLM
- Circuit breaker pattern for 404s

---

## Required Liminal Improvements

### I1: Truncation Detection System

**Files to modify:**
- `src/core/CodeValidator.ts` - add `isTruncated()` method
- `src/generators/glsl/ShaderGenerator.ts` - check completeness

**Logic:**
```typescript
// Detect incomplete code patterns:
- Ends mid-line (no newline at end)
- Unclosed braces/parens
- Missing required elements for domain
- Ends with `...` or comment about "continue"
```

### I2: Strudel Syntax v2 Support

**Files to modify:**
- `src/utils/htmlWrapper.ts` - update detection
- `test/unit/generation/HTMLWrapper.test.ts` - add pipe syntax test
- `src/generators/strudel/StrudelGenerator.ts` - update prompt

**Changes:**
- Detect `|>` as valid Strudel syntax
- Detect `sound()` not just `s()` and `stack()`
- Detect `struct()` patterns

### I3: Timeout Recovery

**Files to modify:**
- `src/llm/LLMClient.ts` - stream handling
- `src/core/RalphLoop.ts` - handle partial results

**Strategy:**
- Stream tokens, save incrementally
- On timeout: emit what we have
- Mark iteration as "incomplete - needs retry"

### I4: LLM-Less Fallbacks

**Files to modify:**
- `src/generators/html/HTMLWebGenerator.ts` - expand templates
- `src/generators/ascii/ASCIIArtGenerator.ts` - expand templates

**Requirement:**
- Must generate valid output WITHOUT LLM call
- Template selection based on prompt keywords
- Same interface, works offline

### I5: Circuit Breaker for 404

**Files to modify:**
- `src/llm/CircuitBreaker.ts` - add 404 detection
- `src/generators/*/index.ts` - check before calling LLM

**Logic:**
- After 3x 404 errors: open circuit
- Use fallbacks exclusively
- Periodically retry (half-open)

---

## Implementation Priority

| Fix | Impact | Effort | Phase |
|-----|--------|--------|-------|
| I4: LLM-Less Fallbacks | HIGH (fixes 12/15 broken) | Medium | 1 |
| I2: Strudel Syntax v2 | MEDIUM | Low | 2 |
| I1: Truncation Detection | MEDIUM | Medium | 3 |
| I3: Timeout Recovery | LOW | High | 4 |
| I5: Circuit Breaker | LOW | Medium | 5 |

---

## Verification Plan

After each fix, regenerate examples through Liminal:
1. Regenerate HTML examples → should have 0 LLM errors
2. Regenerate ASCII examples → should have 0 LLM errors
3. Regenerate GLSL examples → should be complete (no truncation)
4. Regenerate Strudel examples → should pass validator
5. Regenerate Three.js with timeout handling → should have partial results

---

**DO NOT HAND-FIX EXAMPLES**
**ALL FIXES GO INTO LIMAL HARNESS**
**ALL EXAMPLE REGENERATION THROUGH LIMINAL PIPELINE**
