# Silent Failures & Swallowed Errors Audit

**Audit Date:** 2026-03-30  
**Scope:** All catch blocks, optional chains, and silent degradations  

---

## Critical Silent Failures (Must Fix)

### SF1: Audio Pipeline Silent Degradation
**Location:** `src/audio/AudioExtractor.ts` Lines 16-28  
```typescript
function getMeydaSync(): any {
  if (meydaLoaded) return MeydaSync;
  try {
    const { createRequire } = require('module') as any;
    const req = createRequire(import.meta.url);
    const mod = req('meyda');  // FAILS SILENTLY - not installed
    // ...
  } catch {
    return null;  // ← SILENT RETURN NULL
  }
}
```
**Impact:** All audio features return zeros without warning  
**Fix:** Add console.warn at minimum, prefer throwing with helpful message  

---

### SF2: Pitch Detection Silent Failure
**Location:** `src/audio/PitchExtractor.ts` (implied pattern)  
```typescript
// Similar pattern to AudioExtractor - pitchfinder not installed
// Returns null instead of throwing
```
**Impact:** Pitch detection silently fails  
**Fix:** Same as SF1  

---

### SF3: Routing Outcome Recording Fails Silently
**Location:** `src/core/RalphLoop.ts` Lines 383-390  
```typescript
recordRoutingOutcome({
  domain: (normalizedOptions.collabDomain || 'p5') as 'ascii' | 'music' | 'code' | 'visual' | 'remotion',
  model: normalizedOptions.useSwarm ? 'hybrid' : 'local',
  qualityScore: evaluation.score,
  timestamp: new Date().toISOString(),
}).catch((err) => {
  Logger.warn('RalphLoop', 'Failed to record routing outcome:', err instanceof Error ? err.message : err);
  // ← SILENT - only logged, not reported to user
});
```
**Impact:** Analytics lost without user knowledge  
**Fix:** Add to error telemetry, non-fatal but tracked  

---

### SF4: Aesthetic Model Save Fails Silently
**Location:** `src/core/RalphLoop.ts` Lines 492-497  
```typescript
if (aestheticModel) {
  const aestheticPath = `${process.env.HOME}/.liminal/aesthetic_model.json`;
  await aestheticModel.save(aestheticPath).catch((err) => {
    Logger.warn('RalphLoop', 'Failed to save aesthetic model:', err instanceof Error ? err.message : err);
    // ← SILENT - model state lost
  });
}
```
**Impact:** User loses trained aesthetic model  
**Fix:** Report to user via onProgress callback  

---

### SF5: MAP-Elites Save Fails Silently
**Location:** `src/core/RalphLoop.ts` Lines 483-491  
```typescript
if (normalizedOptions.useMapElites) {
  // ...
  if (mapElites) {
    await mapElites.save(mapElitesPath).catch((err) => {
      Logger.warn('RalphLoop', 'Failed to save MAP-Elites archive:', err instanceof Error ? err.message : err);
      // ← SILENT - archive lost
    });
  }
}
```
**Impact:** Evolutionary progress lost  
**Fix:** Report to user, suggest disk space check  

---

### SF6: Quality Archive Save Fails Silently
**Location:** `src/core/RalphLoop.ts` Lines 478-480  
```typescript
if (qualityArchive) {
  await qualityArchive.save();  // No catch!
  // ← UNHANDLED PROMISE - may crash or fail silently
}
```
**Impact:** Archive data lost  
**Fix:** Add try-catch with user notification  

---

### SF7: Auto-Compost Fails Silently
**Location:** `src/core/RalphLoop.ts` Lines 335-360  
```typescript
if (normalizedOptions.autoCompost && evaluation.score >= 0.7 && normalizedOptions.project) {
  try {
    // ... compost operations
  } catch (err) {
    console.warn('Auto-compost failed:', err);  // ← console.warn only
  }
}
```
**Impact:** User thinks compost is working but it's not  
**Fix:** Use Logger, report via event bus  

---

### SF8: Gallery Save Errors Swallowed
**Location:** `src/index.ts` Lines 253-268  
```typescript
} catch (error) {
  // If gallery loading fails, create simple ZIP
  const simpleProject: Project = {
    // ...
  };
  // ← ERROR SILENTLY HANDLED, user doesn't know gallery failed
}
```
**Impact:** User loses iteration history without warning  
**Fix:** Log warning, include in result metadata  

---

## High Priority Silent Failures

### SF9: Swarm Session Save Best-Effort
**Location:** `src/swarm/SwarmOrchestrator.ts` Lines 500-551  
```typescript
private async saveSession(result: SwarmResult): Promise<void> {
  try {
    // ... save logic
  } catch (err) {
    // Session saving is best-effort
    Logger.warn('SwarmOrchestrator', `Failed to save swarm session: ${err instanceof Error ? err.message : err}`);
    // ← SILENT - session lost
  }
}
```
**Impact:** Swarm evolution data lost  
**Fix:** Add to result object so caller knows  

---

### SF10: DNA Extraction Failures
**Location:** `src/scavenger/DNAExtractor.ts` (multiple locations)  
```typescript
// Lines 105-118: scanForCarcasses
catch (err) {
  console.warn('DNAExtractor.scanForCarcasses failed:', err);
  // ... continues with empty array
}

// Lines 127-134: loadDNAForDomain
catch (err) {
  console.warn('DNAExtractor.loadDNAForDomain failed:', err);
  return null;
}

// Lines 139-163: detectDomain
catch (err) {
  console.warn('DNAExtractor.detectDomain (package.json) failed:', err);
  // Falls through to next method
}
```
**Impact:** Multiple silent failures in DNA extraction  
**Fix:** Aggregate errors, report summary  

---

### SF11: Compost Heap Operations
**Location:** `src/compost/CompostHeap.ts` (multiple)  
```typescript
// Pattern repeated: catch { return default; }
```
**Impact:** Compost appears to work but silently fails  
**Fix:** Each operation should report success/failure  

---

### SF12: LLM Cache Stats May Fail
**Location:** `src/llm/LLMClient.ts` Lines 127-132  
```typescript
getCacheStats(): { size: number; enabled: boolean } {
  return {
    size: (this.cache as any).cache?.size ?? 0,  // ← Optional chain hides errors
    enabled: (this.cache as any).options?.enabled ?? true
  };
}
```
**Impact:** Returns default values if cache structure wrong  
**Fix:** Validate cache structure, throw if invalid  

---

## Medium Priority Silent Failures

### SF13: Prompt History Add Fails Silently
**Location:** `src/config/PromptHistory.ts`  
```typescript
// async add() - no error propagation to caller
```
**Impact:** Prompt not saved, user doesn't know  
**Fix:** Return success boolean  

---

### SF14: Config Save May Fail
**Location:** `src/config/ConfigLoader.ts`  
```typescript
// saveConfig - errors logged but not thrown
```
**Impact:** Configuration changes lost  
**Fix:** Return promise, allow caller to handle  

---

### SF15: LIR Parsing Failure Silently Falls Back
**Location:** `src/core/RalphLoop.ts` Lines 216-231  
```typescript
if (normalizedOptions.lirEnabled) {
  try {
    const genParser = new GeneratedCodeParser();
    const lirTokens = genParser.parse(currentCode);
    // ...
  } catch {
    // LIR parsing failed — regex fallback will be used
    // ← SILENT FALLBACK
  }
}
```
**Impact:** LIR features silently disabled  
**Fix:** Log at info level that fallback is being used  

---

### SF16: Aesthetic Guardrails Failure Silent
**Location:** `src/core/RalphLoop.ts` Lines 244-280  
```typescript
if (normalizedOptions.useAestheticGuardrails) {
  try {
    // ... aesthetic analysis
  } catch (e) {
    // Aesthetic analysis failed gracefully — don't block generation
    normalizedOptions.onThought?.(`Aesthetic analysis skipped: ${e instanceof Error ? e.message : 'unknown error'}`);
    // ← Only shown in chat mode
  }
}
```
**Impact:** Non-chat users don't know guardrails failed  
**Fix:** Also emit to event bus  

---

## Optional Chain Blindspots

These may hide undefined behavior:

### OB1: Gallery History Access
**Location:** `src/index.ts` Line 235  
```typescript
const code = 'code' in iter && iter.code != null
  ? iter.code
  : JSON.stringify({...});
// iter could be undefined if history is malformed
```

### OB2: Event Bus Payload Access
**Location:** Multiple files  
```typescript
normalizedOptions.onProgress?.({...});  // If onProgress undefined, silently skips
```

### OB3: Signal Check
**Location:** `src/core/RalphLoop.ts` Line 146  
```typescript
if (normalizedOptions.signal?.aborted) {
  // If signal is undefined, this is fine
  // But if signal is a non-AbortSignal object, behavior undefined
}
```

---

## Error Swallowing Patterns to Avoid

### Anti-Pattern 1: Empty Catch
```typescript
// BAD
try {
  doSomething();
} catch {
  // Nothing
}

// GOOD
try {
  doSomething();
} catch (err) {
  Logger.error('Context', 'Operation failed:', err);
  throw new Error('User-friendly message', { cause: err });
}
```

### Anti-Pattern 2: Console Only
```typescript
// BAD
catch (err) {
  console.warn('Failed:', err);
}

// GOOD
catch (err) {
  Logger.warn('Context', 'Failed:', err);
  eventBus.emit(EventTypes.ERROR_OCCURRED, { context: 'Context', error: err });
}
```

### Anti-Pattern 3: Silent Default
```typescript
// BAD
catch {
  return { rms: 0, energy: 0 };  // Silent zeros
}

// GOOD
catch (err) {
  Logger.warn('Audio', 'Feature extraction failed, returning defaults:', err);
  return { rms: 0, energy: 0, _failed: true };
}
```

---

## Suggested Error Handling Architecture

### Event Types to Add
```typescript
// src/core/EventBus.ts
EventTypes.ERROR_OCCURRED = 'error:occurred';
EventTypes.FEATURE_DEGRADED = 'feature:degraded';
EventTypes.PERSISTENCE_FAILED = 'persistence:failed';
```

### Logger Enhancement
```typescript
// All catch blocks should use Logger, not console
Logger.error(component, message, error);  // For fatal-ish
Logger.warn(component, message, error);   // For degradation
Logger.info(component, message);          // For fallbacks
```

### Result Metadata
All operations should return:
```typescript
interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  warnings?: string[];
}
```

---

## Quick Fix Priority

| ID | File | Line | Effort | Impact |
|----|------|------|--------|--------|
| SF1 | AudioExtractor.ts | 16-28 | Low | High |
| SF6 | RalphLoop.ts | 478-480 | Low | High |
| SF7 | RalphLoop.ts | 335-360 | Low | Medium |
| SF3 | RalphLoop.ts | 383-390 | Low | Medium |
| SF4 | RalphLoop.ts | 492-497 | Low | Medium |
| SF9 | SwarmOrchestrator.ts | 500-551 | Low | Medium |
| SF10 | DNAExtractor.ts | Multiple | Medium | Medium |
| SF15 | RalphLoop.ts | 216-231 | Low | Low |

---

## Verification

After fixing, grep for remaining silent failures:
```bash
# Find empty catch blocks
grep -r "catch\s*{" src/ --include="*.ts" | grep -v "catch\s*("

# Find console.warn in catch
grep -r "console\." src/ --include="*.ts" | grep -A1 "catch"

# Find return null in catch
grep -r "return\s*null" src/ --include="*.ts" -B2 | grep -A2 "catch"

# Find optional chains on critical paths
grep -r "\.?\." src/core/RalphLoop.ts
```
