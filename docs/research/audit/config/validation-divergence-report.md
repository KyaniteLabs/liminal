# Validation/Usage Divergence Analysis

## Executive Summary

This report analyzes mismatches between validation logic (`isConfigured()`, `isXxx()` functions) and actual usage patterns in the Liminal codebase. The core anti-pattern found is **"Check Early, Initialize Late"** - validation happens at call sites with different logic than constructors use for initialization.

---

## The LLMClient Pattern (Fixed)

The LLMClient bug (M4) exemplifies this divergence pattern:

| Aspect | Before Fix | After Fix |
|--------|------------|-----------|
| `isConfigured()` checked | `env('LLM_BASE_URL')`, `OPENAI_API_KEY`, `env('LLM_API_KEY')` | + `SERVICE_DEFAULTS.LOCAL_LLM_URL` |
| Constructor used | `env('LLM_BASE_URL')`, `env('LLM_API_KEY')`, `OPENAI_API_KEY`, `SERVICE_DEFAULTS.LOCAL_LLM_URL` | Same |
| Result | **False negative** - isConfigured() returned false when constructor would succeed | **Aligned** - both check same sources |

### The Fix (Line 580 in LLMClient.ts)
```typescript
// Before:
return !!(env('LLM_BASE_URL') || process.env.OPENAI_API_KEY || env('LLM_API_KEY'));

// After:
return !!(env('LLM_BASE_URL') || process.env.OPENAI_API_KEY || env('LLM_API_KEY') || SERVICE_DEFAULTS.LOCAL_LLM_URL);
```

---

## Similar Patterns Found

### 1. Provider Configuration Divergence

**Validation:** `isProviderConfigured()` in `MultiProviderConfig.ts` (line 169)
- Checks: API keys for cloud providers (MINIMAX_API_KEY, GLM_API_KEY, OPENROUTER_API_KEY)
- Ignores: `SERVICE_DEFAULTS` fallbacks, LIMINAL_LLM_BASE_URL overrides
- **Risk:** MEDIUM - Different use case but same pattern

**Constructor:** `getProviderConfig()` (line 99)
- Uses: `process.env.LIMINAL_LLM_BASE_URL` as override
- Uses: `process.env.LIMINAL_LLM_MODEL` as override
- Uses: Template defaults as fallbacks

**Divergence:**
```typescript
// isProviderConfigured() returns true if apiKey exists
// But getProviderConfig() can succeed without apiKey for local providers
// AND can use different baseUrl than template via env override
```

---

### 2. Error Message Mismatches

| Error Message | File | Lists | Validation Checks | Missing |
|--------------|------|-------|-------------------|---------|
| "Set LIMINAL_LLM_BASE_URL or OPENAI_API_KEY" | `tui/commands.ts:129` | 2 sources | 4 sources | `LIMINAL_LLM_API_KEY`, `SERVICE_DEFAULTS.LOCAL_LLM_URL` (localhost:1234) |
| "Set LLM_API_KEY or configure a local model" | `P5GeneratorLLM.ts:21` | 1 source (wrong name) | 4 sources | `LIMINAL_LLM_BASE_URL`, `OPENAI_API_KEY`, `LIMINAL_LLM_API_KEY` (correct name) |
| "No LLM configured" | `TierBasedGenerator.ts:43` | 0 sources | 4 sources | **All configuration options** |
| "LLM not configured" | `requestImprovement.ts:46` | 0 sources | 4 sources | **All configuration options** |

**Severity: MEDIUM** - Misleading error messages waste debugging time and lead to incorrect fixes

**Specific Issues:**
1. `P5GeneratorLLM.ts` uses `LLM_API_KEY` instead of `LIMINAL_LLM_API_KEY` - **HIGH severity** because users will set the wrong variable
2. `tui/commands.ts` omits the localhost default which works out-of-the-box
3. `TierBasedGenerator` and `requestImprovement` give no guidance at all

---

### 3. Silent Degradation Patterns

```typescript
// generateVisuals.ts:46-54
if (LLMClient.isConfigured()) {
  try {
    const code = await generateVisualsLLM(...);
    if (code) return { code };
  } catch (err) {
    console.warn('[generateVisuals] LLM generation failed, falling back to template:', err);
  }
}
// Silently falls through to template fallback
```

**Files with silent fallbacks:**

| File | Silent Behavior | Returns | Risk |
|------|-----------------|---------|------|
| `generateVisuals.ts:46` | Falls back to template | Generated template code | **LOW** - Template is valid |
| `generateMusic.ts:98` | Falls back to template | Generated template code | **LOW** - Template is valid |
| `requestImprovement.ts:46` | Returns fallback + error flag | Template code + `improved: false` | **MEDIUM** - Caller may not check flag |

**The Problem:**
- Users don't know LLM was skipped unless they check logs
- Template fallbacks may not match the requested prompt at all
- No explicit "LLM not used" indication in output

**AGENTS.md Violation:**
> "Design Rule: No Template Fallbacks - All generators route through the LLM. Template fallbacks are not used because they mask real problems."

Both `generateVisuals.ts` and `generateMusic.ts` violate this rule with template fallbacks.

---

### 4. Validation Chain Breakdown

```
TierBasedGenerator.generate()
  ↓ calls LLMClient.isConfigured() at line 42
     ↓ checks env vars + defaults
        ↓ if false, throws "No LLM configured"
           ↓ But constructor at line 35 already created LLMClient!
              ↓ The check happens AFTER instantiation
```

**Sequence Problem:**
```typescript
// TierBasedGenerator.ts:28-39
constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
  this.llm = llmOrConfig instanceof LLMClient 
    ? llmOrConfig 
    : new LLMClient(llmOrConfig);  // ← Constructor runs FIRST
  // ...
}

async generate(prompt: string): Promise<string> {
  if (!LLMClient.isConfigured()) {  // ← Validation happens SECOND
    throw new Error(`${this.constructor.name}: No LLM configured`);
  }
  // ...
}
```

**Same Pattern in:**
- `P5GeneratorLLM.ts:15-24` - Constructor creates LLM, then generate() checks isConfigured()

**Impact:**
- Constructor may succeed (using defaults) but generate() throws
- Wasted instantiation if check fails
- Confusing error timing

---

## Severity Classification

| Issue | Severity | Impact | Fix Complexity |
|-------|----------|--------|----------------|
| Wrong env var name in P5GeneratorLLM error | **HIGH** | Users set wrong variable, still broken | Low |
| Error messages don't match validation | **MEDIUM** | User confusion, wasted debugging time | Low |
| Silent degradation (if branches) | **MEDIUM** | Undefined behavior, hidden failures | Medium |
| Validation chain order | **LOW** | Confusing error timing | Low |
| Provider config divergence | **LOW** | Different use case, less critical | Medium |

---

## Root Cause Pattern

### "Check Early, Initialize Late"

```typescript
// ANTI-PATTERN:
class MyService {
  constructor() {
    // Initialize with fallbacks
    this.url = env('URL') || DEFAULTS.URL;
  }
  
  static isConfigured(): boolean {
    // Check WITHOUT fallbacks
    return !!env('URL');  // ← Missing DEFAULTS.URL!
  }
}

// USAGE:
if (!MyService.isConfigured()) {  // ← Returns false
  throw new Error("Not configured");  // ← Even though constructor would work!
}
const service = new MyService();  // ← Never reached
```

**Why This Happens:**
1. Validation added after constructor was written
2. Different authors for validation vs initialization
3. Defaults added later, validation not updated
4. Copy-paste errors in error messages

---

## Prevention Strategy

### Rule: Validation Must Check Superset of Initialization Fallbacks

```typescript
// CORRECT:
class LLMClient {
  static isConfigured(): boolean {
    // Check EVERYTHING constructor might use
    return !!(env('URL') || DEFAULTS.URL || ALTERNATIVE);
  }

  constructor() {
    // Use SUBSET of isConfigured checks (in priority order)
    this.url = env('URL') || DEFAULTS.URL;
  }
}
```

### Checklist for Future Changes:

1. **When adding a fallback to constructor:**
   - [ ] Update `isConfigured()` to check for it
   - [ ] Update error messages to mention it

2. **When adding a validation check:**
   - [ ] Verify constructor actually uses that source
   - [ ] Document in comments why it's checked

3. **When changing env var names:**
   - [ ] Update ALL error messages (grep for old name)
   - [ ] Update documentation
   - [ ] Add to migration guide

---

## Files Requiring Fixes

### HIGH Priority
1. **`src/generators/p5/P5GeneratorLLM.ts:21`**
   - Change `LLM_API_KEY` to `LIMINAL_LLM_API_KEY`
   - Add `LIMINAL_LLM_BASE_URL` and `OPENAI_API_KEY` to message

### MEDIUM Priority
2. **`src/tui/commands.ts:129`**
   - Add `LIMINAL_LLM_API_KEY` to error message
   - Mention localhost default works out-of-box

3. **`src/generators/TierBasedGenerator.ts:43`**
   - Add configuration guidance to error

4. **`src/improvement/requestImprovement.ts:46`**
   - Add configuration guidance to error

5. **`src/generateVisuals.ts:46`**, **`src/music/generateMusic.ts:98`**
   - Remove template fallbacks (per AGENTS.md) OR add explicit "LLM not available" warning

### LOW Priority
6. **`src/harness/MultiProviderConfig.ts:169`**
   - Document that `isProviderConfigured()` has different semantics than `getProviderConfig()`

---

## Recommendation: Shared Validation Helper

Create a single source of truth for LLM configuration validation:

```typescript
// src/llm/LLMConfig.ts
export const LLM_CONFIG_SOURCES = {
  envVars: ['LIMINAL_LLM_BASE_URL', 'LIMINAL_LLM_API_KEY', 'OPENAI_API_KEY'],
  defaults: { baseUrl: SERVICE_DEFAULTS.LOCAL_LLM_URL }
};

export function getLLMConfigurationError(): string | null {
  if (LLMClient.isConfigured()) return null;
  return 
    'No LLM configured. Set one of:\n' +
    '  - LIMINAL_LLM_BASE_URL (e.g., http://localhost:1234/v1)\n' +
    '  - LIMINAL_LLM_API_KEY\n' +
    '  - OPENAI_API_KEY\n' +
    'Or run LM Studio / Ollama on localhost:1234/11434';
}
```

Then update all call sites to use this helper instead of hardcoded messages.

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Error message mismatches | 4 | Medium |
| Silent degradation sites | 3 | Medium |
| Validation chain issues | 2 | Low |
| Provider config divergence | 1 | Low |

**Most Critical:** The wrong env var name (`LLM_API_KEY` vs `LIMINAL_LLM_API_KEY`) in P5GeneratorLLM will cause users to set the wrong variable and still have failures.

**Prevention:** Use the shared validation helper pattern and maintain the rule: *validation checks must be a superset of initialization fallbacks.*
