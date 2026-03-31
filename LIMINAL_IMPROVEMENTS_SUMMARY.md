# LIMINAL Improvements Summary

## Overview
This document summarizes the infrastructure improvements made to LIMINAL based on the 48-example dogfood audit. All changes are to LIMINAL core code (prompts, validators, routing), NOT to generated outputs.

---

## Files Created/Modified

### 1. **AUDIT_FINDINGS.md** (NEW)
Comprehensive analysis of the 48-example audit:
- Domain-by-domain performance breakdown
- Model performance ranking (speed, quality, reliability)
- Critical issues requiring fixes
- Telemetry data (time, size) for each example

**Key Findings:**
| Domain | Success Rate | Issues |
|--------|--------------|--------|
| p5.js | 100% | None |
| GLSL | 100% | M2.5 too simple (715b) |
| Three.js | 83% | Qwen35 FAILED (66b) |
| Hydra | 50% | 4 models too small |
| Strudel | 100% | Audio blocked in iframes |
| Remotion | 100% | Needs build step |
| HTML/ASCII | 100% | Template fallback |

---

### 2. **src/prompts/three.ts** (MODIFIED)
**Problem:** Generated code uses ES modules (`import * as THREE`) but CDN wrappers use global `THREE`.

**Fixes:**
- Changed from ES module imports to global THREE
- Added explicit CDN loading instructions
- Added minimum object count (5 objects) requirement
- Added color harmony requirements
- Added quality checklist

**Before:**
```typescript
// Use Three.js via CDN importmap (ES modules)
<script type="importmap">...</script>
<script type="module">
  import * as THREE from 'three';
```

**After:**
```typescript
// Use global THREE from CDN (NOT ES modules)
<script src="https://cdn.jsdelivr.net/npm/three@.../three.min.js"></script>
<script>
  const scene = new THREE.Scene();
```

---

### 3. **src/prompts/hydra.ts** (MODIFIED)
**Problem:** 50% failure rate - models don't understand Hydra API.

**Fixes:**
- Added comprehensive API reference with ALL valid methods
- Added explicit INVALID method list (colorShift, feedback, sin, cos)
- Added 5 working code examples
- Added minimum size requirement (200 chars)
- Added chain pattern examples

**New Content:**
```typescript
VALID HYDRA API REFERENCE:
SOURCE FUNCTIONS: osc(), noise(), shape(), gradient(), solid(), src()
TRANSFORMATION METHODS: .rotate(), .scale(), .modulate(), .out()

INVALID (don't use):
- colorShift (doesn't exist)
- feedback (doesn't exist, use src(o0))
- .sin() (doesn't exist)

VALID CODE EXAMPLES:
- osc(60).kaleid(4).out()
- src(o0).scale(1.1).out()
```

---

### 4. **src/prompts/glsl.ts** (MODIFIED)
**Problem:** M2.5 produces simple shaders (715b) - taking shortcuts.

**Fixes:**
- Added minimum size requirement (1000 chars)
- Added complexity requirements:
  - MUST use noise function
  - MUST use color transformation
  - MUST animate with u_time
  - MUST NOT be simple gradient
- Added valid noise function examples

---

### 5. **src/core/CodeValidator.ts** (MODIFIED)
**Problem:** Qwen35 "successfully" generated 66b and 74b outputs that failed.

**New Features:**

#### Size Validation
```typescript
const MIN_SIZE_REQUIREMENTS = {
  'p5': 500,
  'shader': 800,
  'three': 800,
  'hydra': 150,
  'strudel': 100,
  // ...
};
```

#### Domain-Specific Validation
- **Hydra:** Checks for invalid methods (colorShift, feedback)
- **Strudel:** Checks for non-ASCII contamination
- **GLSL:** Checks for noise functions and animation
- **Three.js:** Checks for module/global consistency

#### Quality Checks
```typescript
function validateQuality(code: string, domain: Domain): string[] {
  // GLSL: must have noise or multiple colors
  // Three.js: must not mix import styles
  // Hydra: must end with .out()
}
```

---

### 6. **src/config/model-routing.ts** (NEW)
Data-driven model selection based on audit results.

**Features:**
- Preferred model lists per domain
- Models to avoid per domain
- Minimum size requirements
- Quality scores (speed + quality + reliability)
- Prompt hints per domain

**Example Routing:**
```typescript
'three': {
  preferred: ['minimax-m2.7', 'minimax-m2.5', 'kimi', 'gemma', 'qwen-coder'],
  avoid: ['qwen3.5-9b'],  // ❌ FAILED in audit
  minSize: 1000,
  rankings: [...]
}
```

**Helper Functions:**
```typescript
getBestModel('three') → 'minimax-m2.7'
shouldAvoidModel('three', 'qwen3.5-9b') → true
getMinSizeForDomain('glsl') → 800
```

---

### 7. **src/core/TelemetryAggregator.ts** (NEW)
Continuous quality tracking system.

**Features:**
- Records every generation with metadata
- Tracks model performance over time
- Generates quality alerts for regressions
- Exports data for analysis

**Usage:**
```typescript
const telemetry = new TelemetryAggregator();
telemetry.record({
  domain: 'three',
  modelId: 'minimax-m2.7',
  generationTimeMs: 36600,
  outputSizeBytes: 6753,
  success: true,
});

const stats = telemetry.getDomainStats('three');
const alerts = telemetry.checkForIssues();
```

**Alert Types:**
- `size_regression` - Output size dropped below threshold
- `failure_spike` - Success rate dropped below 80%
- `quality_drop` - Quality score declining
- `slow_generation` - Taking > 2 minutes

---

### 8. **src/config/telemetry-seed.ts** (NEW)
Baseline telemetry from the 48-example audit.

**Contains:**
- All 48 generation records
- Success/failure status
- Validation errors
- Timing and size data

**Summary:**
```typescript
SEED_SUMMARY = {
  totalExamples: 48,
  successfulGenerations: 46,
  failedGenerations: 2,
  overallSuccessRate: 0.96,
  modelsToAvoid: {
    'three': ['qwen3.5-9b'],
    'hydra': ['qwen3.5-9b', 'minimax-m2.5', ...]
  }
};
```

---

## Impact Assessment

### Before Improvements
- **Three.js:** 83% success (1/6 failed)
- **Hydra:** 50% success (2/4 too small)
- **No validation** of output size
- **No model routing** - random selection
- **No telemetry** tracking

### After Improvements
- **Three.js:** Expected 100% with routing
- **Hydra:** Expected 80%+ with new prompts
- **Size validation** rejects < 500b outputs
- **Smart routing** avoids known bad model/domain pairs
- **Telemetry** tracks quality over time

---

## Integration Guide

### Step 1: Import Telemetry Seed
```typescript
import { globalTelemetry } from './core/TelemetryAggregator.js';
import { SEED_TELEMETRY } from './config/telemetry-seed.js';

globalTelemetry.loadData({ generations: SEED_TELEMETRY });
```

### Step 2: Use Model Routing
```typescript
import { getBestModel, shouldAvoidModel } from './config/model-routing.js';

const modelId = getBestModel('three');  // → 'minimax-m2.7'

if (shouldAvoidModel('hydra', 'qwen3.5-9b')) {
  // Pick different model
}
```

### Step 3: Record Telemetry
```typescript
globalTelemetry.record({
  id: generateId(),
  timestamp: new Date(),
  domain: 'p5',
  modelId: 'minimax-m2.7',
  prompt: userPrompt,
  generationTimeMs: elapsed,
  outputSizeBytes: code.length,
  validationPassed: validation.valid,
  validationErrors: validation.errors,
  success: validation.valid && code.length > minSize,
});
```

### Step 4: Check for Issues
```typescript
const alerts = globalTelemetry.checkForIssues();
for (const alert of alerts) {
  if (alert.severity === 'critical') {
    console.error(`🚨 ${alert.message}`);
    console.log(`💡 ${alert.suggestedAction}`);
  }
}
```

---

## Next Steps

1. **Test the improvements:** Run new generations with updated prompts
2. **Monitor telemetry:** Watch for quality regressions
3. **Update routing:** As more data comes in, update model rankings
4. **Expand validation:** Add more domain-specific checks
5. **Add retry logic:** If validation fails, retry with different model

---

## Files Summary

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `AUDIT_FINDINGS.md` | NEW | 334 | Complete audit analysis |
| `src/prompts/three.ts` | MODIFIED | 62 | Global THREE (not modules) |
| `src/prompts/hydra.ts` | MODIFIED | 112 | Complete API reference |
| `src/prompts/glsl.ts` | MODIFIED | 70 | Complexity requirements |
| `src/core/CodeValidator.ts` | MODIFIED | 562 | Size + quality validation |
| `src/config/model-routing.ts` | NEW | 398 | Data-driven model selection |
| `src/core/TelemetryAggregator.ts` | NEW | 355 | Continuous quality tracking |
| `src/config/telemetry-seed.ts` | NEW | 474 | Audit data as baseline |

**Total:** 2,367 lines of new/improved infrastructure code
