# Deep Telemetry Analysis - Dogfood QA Run

## Run Configuration

| Setting | Value |
|---------|-------|
| **Provider** | lmstudio (local) |
| **Model** | qwen3-coder-next-reap-40b-a3b-i1 (40B params) |
| **Base URL** | http://localhost:1234/v1 |
| **Harness** | Meta-Harness (same LLM) |
| **Max Iterations** | 1 (forced stop) |
| **Min Quality Score** | 0.7 (default) |

---

## Generation Details

### Test 1: Blue Particle System (P5.js)
```json
{
  "model": "local",
  "domain": "p5",
  "prompt": "Blue particle system",
  "duration_ms": 12919,
  "score": 0.758,
  "error": "max iterations reached (1)",
  "errorType": "generation",
  "contains": ["createCanvas", "Particle class", "alpha animation"]
}
```

**Why it stopped:** `maxIterations: 1` forced stop after first generation.
**Quality:** GOOD (0.758 > 0.7 threshold)

---

### Test 2: Landing Page Hero (HTML)
```json
{
  "model": "local", 
  "domain": "p5",  // <-- BUG: Domain detected as p5, not html!
  "prompt": "Landing page hero",
  "duration_ms": 49560,
  "score": 0.183,
  "error": "max iterations reached (1)",
  "errorType": "generation"
}
```

**Why it stopped:** `maxIterations: 1` forced stop.
**Quality:** LOW (0.183 < 0.7 threshold)
**Root Cause:** Domain detected as "p5" not "html" - scoring used p5.js criteria on HTML!

---

### Test 3: Calming Blue Particles (P5.js)
```json
{
  "model": "local",
  "domain": "p5",
  "prompt": "Create a calming blue particle system with flowing movement",
  "duration_ms": 23834,
  "score": 0.76,
  "error": "max iterations reached (1)",
  "features": ["Perlin noise flow field", "HSL color", "150 particles"]
}
```

**Why it stopped:** `maxIterations: 1` forced stop.
**Quality:** GOOD (0.76 > 0.7 threshold)

---

### Test 4: Landing Page with CTA (HTML)
```json
{
  "model": "local",
  "domain": "p5",  // <-- BUG: Wrong domain again!
  "prompt": "Create a landing page with hero section and call to action",
  "duration_ms": 45358,
  "score": 0.183,
  "error": "max iterations reached (1)"
}
```

**Why it stopped:** `maxIterations: 1` forced stop.
**Quality:** LOW (0.183 < 0.7 threshold)
**Root Cause:** Domain "p5" used instead of "html" for evaluation.

---

### Test 5: Portfolio Website (HTML)
```json
{
  "model": "local",
  "domain": "p5",  // <-- BUG: Still wrong!
  "prompt": "Personal portfolio website with navigation",
  "duration_ms": 134951,
  "score": 0.18,
  "error": "max iterations reached (1)"
}
```

**Why it stopped:** `maxIterations: 1` forced stop.
**Quality:** LOW (0.18 < 0.7 threshold)
**Duration:** 135s (3x longer than others - complex prompt)

---

## Critical Findings

### 1. Domain Detection Bug
**All HTML tests show `"domain": "p5"` in telemetry!**

The scoring system evaluated HTML pages using **p5.js criteria**:
- Checking for `setup()` / `draw()` functions
- Checking for `createCanvas()`
- Looking for p5.js animation patterns

HTML pages got low scores because they lack these p5-specific features.

**Fix needed:** Update `detectDomain()` in RalphLoop.ts lines 334-341 to properly detect HTML from prompt keywords.

### 2. Forced Single Iteration
Every test stopped with error: `"max iterations reached (1)"`

This is because the test suite used:
```javascript
run(prompt, { maxIterations: 1, ... })
```

**Impact:** No chance to improve low-scoring generations.

### 3. Reasoning Traces Found

From earlier failures (different session):
```json
{
  "model": "qwen3.5:14b",
  "thinking": "<thinking>\nI need to create a particle system in p5.js. Let me think about this carefully...\nA particle system typically involves:\n1. A Particle class with position, velocity, acceleration\n2. An array to store particles\n3. Update and display methods\n4. Lifecycle management\n\nLet me write the code step by step...\n\nFirst, I'll create the Particle class...\nThen I'll set up the array...\nThen I'll handle the draw loop...\n\nActually, let me reconsider the architecture...\nMaybe I should use a more functional approach...\nOr perhaps an object-oriented approach would be better?\n\nLet me think about performance...\nIf we have too many particles, we might need spatial hashing...\nBut for a simple sketch, that's probably overkill...\n\nWait, I should also consider the color scheme...\nAnd the interaction model...\nAnd whether to use webgl or canvas2d...\n\nActually, let me think about this more...\nLet me reconsider the design patterns again...\nShould I use factory pattern for particle creation?\nOr maybe a builder pattern would be better?\nWhat about object pooling to avoid garbage collection?\nAnd how should I handle the rendering optimization?\nShould particles be rendered offscreen first?\nOr maybe use a spatial hash grid for collision detection?\nActually, for a simple sketch, that's probably overkill...\nBut wait, what if the user wants thousands of particles?\nThen performance would definitely matter...\nLet me think about the color palette too...\nShould I use HSB or RGB color mode?\nAnd what about the background - static or dynamic?\nThese are important architectural decisions...\n",
  "duration": 30000,
  "error": "Request timed out after 30000ms"
}
```

**Pattern:** Model got stuck in "thinking mode" - recursive overthinking without generating code.

---

## Scoring Breakdown

### P5.js Scoring (Working Correctly)
- Technical: Has `setup()`, `draw()`, `createCanvas()` ✅
- Creative: Uses classes, arrays, animation ✅
- Score: 0.76 (passed 0.7 threshold)

### HTML Scoring (Broken)
- Technical: Missing p5.js functions ❌
- Creative: Evaluated as "no animation" ❌
- Score: 0.18 (failed 0.7 threshold)

---

## Architecture Issue: Single Model

Current state (WRONG):
```
┌─────────────────────────────────────────────┐
│            Meta-Harness                     │
│  (same LLMClient as generators)             │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│           LLMClient                         │
│  Model: qwen3-coder-40b @ localhost:1234    │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   P5Generator   HTMLGenerator   HarnessAgent
```

**Missing feature:** Separate model configuration for harness vs generation.

---

## Action Items

### P0: Fix Domain Detection for HTML
File: `src/core/RalphLoop.ts` lines 334-341
Add: `else if (promptLower.includes('html') || promptLower.includes('landing') || promptLower.includes('website')) domain = 'html';`

### P1: Add Separate Harness Model Config
Need: `LIMINAL_HARNESS_MODEL` vs `LIMINAL_GENERATION_MODEL`

### P2: Domain-Specific Quality Thresholds
HTML/web should have different scoring criteria than p5.js

### P3: Don't Stop at Low Scores
Currently: `maxIterations: 1` forces stop
Should: Continue iterating until quality threshold OR max iterations
