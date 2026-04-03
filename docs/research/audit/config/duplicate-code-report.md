# Duplicate Configuration Code Analysis

## Executive Summary
- **3 identical env() helpers** found across codebase
- **12 repeated fallback chains** with hardcoded defaults
- **7 duplicated default values** (model names, providers, URLs)
- **Severity: HIGH** - Must consolidate before further fixes

---

## Detailed Findings

### 1. env() Helper Duplicates

| Location | Line | Usage Count | Consolidation Priority |
|----------|------|-------------|----------------------|
| `src/config/ConfigLoader.ts` | 162 | 9 | **HIGH** - Most usage |
| `src/llm/LLMClient.ts` | 96 | 6 | **MEDIUM** - Core LLM component |
| `src/core/RalphLoop.ts` | 62 | 1 | **LOW** - Move to shared |

**Issue:** All three implement the identical one-liner:
```typescript
function env(key: string): string | undefined {
  return process.env[`LIMINAL_${key}`];
}
```

**Impact:**
- Fix in one location doesn't fix others
- Inconsistent behavior possible if implementations diverge
- Maintenance burden - must update in 3 places
- Violates DRY principle

**Recommendation:** Extract to `src/utils/env.ts` and import everywhere

---

### 2. Repeated Fallback Chains

#### 2.1 Model Default Fallbacks

| Fallback Pattern | Occurrences | Locations |
|------------------|-------------|-----------|
| `env('LLM_MODEL') \|\| 'qwen2.5-coder-7b-instruct'` | 4 | LLMClient.ts:122, ConfigLoader.ts:288, ConfigLoader.ts:315, tui/index.tsx:177 |

**Issue:** Magic string `'qwen2.5-coder-7b-instruct'` hardcoded in 4 locations

**Impact:** Changing default model requires finding all occurrences

---

#### 2.2 Provider Default Fallbacks

| Fallback Pattern | Occurrences | Locations |
|------------------|-------------|-----------|
| `env('LLM_PROVIDER') \|\| 'lmstudio'` | 4 | ConfigLoader.ts:267, ConfigLoader.ts:280, RalphLoop.ts:96, tui/InteractiveMode.ts:85 |

**Issue:** Magic string `'lmstudio'` hardcoded in 4 locations

**Impact:** Changing default provider requires finding all occurrences

---

#### 2.3 URL Default Fallbacks

| Fallback Pattern | Occurrences | Locations |
|------------------|-------------|-----------|
| `http://localhost:1234/v1` | 4 | constants.ts:11, compost/defaults.ts:46, compost/defaults.ts:51, harness/MultiProviderConfig.ts:48 |
| `http://localhost:11434` | 2 | constants.ts:13, harness/MultiProviderConfig.ts:58 |

**Issue:** URLs duplicated even though `SERVICE_DEFAULTS` exists with these values

**Impact:** URL changes must be made in multiple places; some use constants, others don't

---

#### 2.4 Complete Fallback Chain List

| # | Pattern | Files Affected | Priority |
|---|---------|----------------|----------|
| 1 | `LLM_MODEL` → `'qwen2.5-coder-7b-instruct'` | 4 | HIGH |
| 2 | `LLM_PROVIDER` → `'lmstudio'` | 4 | HIGH |
| 3 | `LLM_BASE_URL` → `'http://localhost:1234/v1'` | 4 | HIGH |
| 4 | `temperature` → `0.7` | 11 | MEDIUM |
| 5 | `maxTokens` → `4096` | 9 | MEDIUM |
| 6 | `domain` → `'p5'` | 12 | MEDIUM |
| 7 | `OLLAMA_URL` → `'http://localhost:11434'` | 2 | LOW |
| 8 | `routingMode` → `'cascade'` | 2 | LOW |
| 9 | `swarmMode` → `'hybrid'` | 2 | LOW |
| 10 | `LLM_TIMEOUT` → `300000` (5 min) | 3 | LOW |
| 11 | `OLLAMA_TIMEOUT` → `120000` (2 min) | 2 | LOW |
| 12 | `OPERATION_TIMEOUT` → `30000` (30 sec) | 9 | LOW |

**Total: 12 repeated fallback chain patterns**

---

### 3. Duplicated Default Values

| Value | Type | Occurrences | Files | Priority |
|-------|------|-------------|-------|----------|
| `qwen2.5-coder-7b-instruct` | model | 4 | LLMClient.ts, ConfigLoader.ts (×2), tui/index.tsx | HIGH |
| `lmstudio` | provider | 4 | ConfigLoader.ts (×2), RalphLoop.ts, InteractiveMode.ts | HIGH |
| `p5` | domain | 12 | LoopConfig.ts, RalphLoop.ts (×8), GenerationOrchestrator.ts (×3), EvolutionIntegration.ts | HIGH |
| `http://localhost:1234/v1` | URL | 4 | constants.ts, compost/defaults.ts (×2), MultiProviderConfig.ts | HIGH |
| `0.7` | temperature | 11 | MultiProviderConfig.ts (×6), ConfigLoader.ts, swarm/personas.ts, SwarmOrchestrator.ts, chat.ts | MEDIUM |
| `4096` | maxTokens | 9 | LLMClient.ts, MultiProviderConfig.ts (×8) | MEDIUM |
| `http://localhost:11434` | URL | 2 | constants.ts, MultiProviderConfig.ts | LOW |

**Total: 7 distinct duplicated default values**

---

### 4. Validation Logic Duplication

While not exact duplicates, similar validation patterns exist across files:

| Pattern | Locations | Issue |
|---------|-----------|-------|
| `isConfigured()` check | LLMClient.ts, TierBasedGenerator.ts, P5GeneratorLLM.ts, tui/commands.ts, music/generateMusic.ts, generateVisuals.ts, improvement/requestImprovement.ts | Centralized check function exists but validation logic scattered |
| `process.env.NODE_ENV !== 'test'` | index.ts:289, RalphLoop.ts:201,516,545, PreviewServer.ts:126 | Same check pattern in 5 locations |
| `process.env.HOME` access | RoutingData.ts:37, RalphLoop.ts:123,128,564,573, QualityArchive.ts:93, ArchiveLearning.ts:80 | No fallback - may break on Windows |

---

## Consolidation Priority Matrix

| Duplicate | Risk Level | Effort | Files Affected | Recommended Action |
|-----------|------------|--------|----------------|-------------------|
| env() helpers | **HIGH** | Low | 3 | Extract to shared utility |
| Model defaults (`qwen2.5-coder-7b-instruct`) | **HIGH** | Low | 4 | Add to SERVICE_DEFAULTS |
| Provider defaults (`lmstudio`) | **HIGH** | Low | 4 | Add to SERVICE_DEFAULTS |
| Local LLM URL | **HIGH** | Low | 4 | Use SERVICE_DEFAULTS consistently |
| Domain defaults (`p5`) | **MEDIUM** | Medium | 12 | Create DEFAULT_COLLAB_DOMAIN |
| Temperature (0.7) | **MEDIUM** | Medium | 11 | Add DEFAULT_TEMPERATURE |
| maxTokens (4096) | **MEDIUM** | Medium | 9 | Use HARNESS_DEFAULTS consistently |
| Timeout values | **LOW** | Medium | 14 | Create TIMEOUT constants per context |
| NODE_ENV checks | **LOW** | Low | 5 | Create isTestEnvironment() helper |
| HOME path access | **MEDIUM** | Low | 7 | Create getHomeDir() with Windows support |

---

## Risk Assessment

### HIGH Risk (Fix First)
1. **env() helpers** - Code duplication leads to maintenance issues and potential divergence
2. **Model/Provider defaults** - Hardcoded strings make configuration changes error-prone
3. **URL duplication** - Inconsistent use of SERVICE_DEFAULTS creates drift

### MEDIUM Risk (Fix Second)
1. **Domain defaults** - 12 occurrences of `'p5'` makes domain changes difficult
2. **Temperature/Token defaults** - 11 and 9 occurrences respectively
3. **HOME path access** - No Windows fallback could cause runtime errors

### LOW Risk (Fix Last)
1. **Timeout values** - Different contexts may need different values
2. **NODE_ENV checks** - Pattern is simple and unlikely to change

---

## Recommended Fix Order

### Phase 1: Core Utilities (Wave 3)
1. **Create `src/utils/env.ts`**
   - Extract shared `env()` helper
   - Add `getEnvWithFallback()` utility
   - Add `isTestEnvironment()` helper
   - Add `getHomeDir()` with cross-platform support

2. **Update `src/constants.ts`**
   - Add `DEFAULT_MODEL = 'qwen2.5-coder-7b-instruct'`
   - Add `DEFAULT_PROVIDER = 'lmstudio'`
   - Add `DEFAULT_COLLAB_DOMAIN = 'p5'`
   - Add `DEFAULT_TEMPERATURE = 0.7`
   - Ensure all URLs reference SERVICE_DEFAULTS

### Phase 2: Replace Duplicates (Wave 4)
3. **Refactor env() usage**
   - Replace 3 duplicate helpers with import from `src/utils/env.ts`
   - Update all imports in affected files

4. **Refactor fallback chains**
   - Replace hardcoded model defaults with `SERVICE_DEFAULTS.DEFAULT_MODEL`
   - Replace hardcoded provider defaults with `SERVICE_DEFAULTS.DEFAULT_PROVIDER`
   - Replace hardcoded URLs with `SERVICE_DEFAULTS.LOCAL_LLM_URL`

### Phase 3: Validation & Prevention (Wave 5)
5. **Add lint rules**
   - ESLint rule to prevent duplicate env() definitions
   - ESLint rule to enforce use of constants for magic strings
   - Pre-commit hook to detect new duplications

6. **Add verification tests**
   - Test that all env access goes through shared utility
   - Test that no new hardcoded defaults are introduced

---

## Files to Modify (for Wave 3)

### New Files
- `src/utils/env.ts` - Shared environment utility

### Files to Update (remove duplicate env())
- `src/config/ConfigLoader.ts` - Remove lines 162-164, update imports
- `src/llm/LLMClient.ts` - Remove lines 96-98, update imports
- `src/core/RalphLoop.ts` - Remove lines 62-64, update imports

### Files to Update (use constants)
- `src/constants.ts` - Add new default constants
- `src/tui/index.tsx` - Use DEFAULT_MODEL constant
- `src/tui/InteractiveMode.ts` - Use DEFAULT_PROVIDER constant
- `src/compost/defaults.ts` - Use SERVICE_DEFAULTS.LOCAL_LLM_URL
- `src/harness/MultiProviderConfig.ts` - Use SERVICE_DEFAULTS consistently
- `src/swarm/personas.ts` - Use DEFAULT_TEMPERATURE
- `src/prompts/specialized/chat.ts` - Use DEFAULT_TEMPERATURE

### Configuration Updates
- `.eslintrc.cjs` - Add rules to prevent duplication

---

## Impact Summary

| Metric | Before | After (Target) |
|--------|--------|----------------|
| env() helper implementations | 3 | 1 |
| Hardcoded model defaults | 4 | 0 |
| Hardcoded provider defaults | 4 | 0 |
| Hardcoded URL strings | 6 | 0 |
| Files importing shared env | 0 | 15+ |

---

## Notes

- The `env()` helper duplicates are the highest priority because they represent actual code duplication, not just data duplication
- SERVICE_DEFAULTS already exists and is used correctly in some places - expand this pattern
- HARNESS_DEFAULTS in MultiProviderConfig.ts shows good organization - replicate for other defaults
- The `||` vs `??` operator inconsistency should be addressed during consolidation

---

*Generated from Wave 1 discovery reports*
*Audit Date: 2026-04-02*
