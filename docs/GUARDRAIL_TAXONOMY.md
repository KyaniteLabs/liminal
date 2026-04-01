# Guardrail Taxonomy - Five Types of Quality Gates

**Date:** 2026-04-01

---

## Overview

There are **FIVE distinct types** of guardrails in Liminal. Each catches different failure modes. Missing any creates quality holes.

---

## The Five Types

### 1. 🔧 CODE QUALITY (Universal)
**Applies to:** ALL generators

Checks structural validity:
- Balanced braces, parens, brackets
- Required functions exist (setup, draw for p5)
- Valid syntax
- Domain detection (p5 vs GLSL vs Three)
- Size limits

**Implementation:** `src/core/CodeValidator.ts`
**Status:** ✅ Exists

---

### 2. 👻 ANTI-HALLUCINATION (API Validation)
**Applies to:** ALL generators with library APIs

Checks that APIs actually exist:
- p5.js functions are real
- Tone.js classes/methods exist
- Three.js APIs are valid
- No made-up parameters
- Correct method names

**Examples of hallucinations:**
```javascript
// ❌ FAKE - Tone.MegaSynth doesn't exist
const synth = new Tone.MegaSynth();

// ❌ FAKE - setPixelColor doesn't exist in p5
setPixelColor(10, 10, 255);

// ✅ REAL - Actual APIs
const synth = new Tone.PolySynth(Tone.Synth);
set(10, 10, color(255));
```

**Implementation:** `src/core/CodeValidator.ts` (validateToneJS, etc.)
**Status:** ⚠️ Partial - M1 task fixes Tone.js validation

---

### 3. 🗑️ ANTI-SLOP (Creativity Minimum)
**Applies to:** ALL generators

Rejects low-effort, generic output:
- "Blue circle on gray background"
- Random particle soup
- Copy-paste noise
- No clear concept
- Student-project quality

**Slop indicators:**
- < 50 lines of code
- No animation
- Basic shapes only
- No color variation
- Generic patterns

**Implementation:** `src/core/CreativeEvaluator.ts` (emergence, interestingness)
**Status:** ⚠️ Partial - needs explicit slop detection

---

### 4. 🎨 AESTHETIC QUALITY (Domain-Specific)
**Applies to:** Per generator type

Domain-specific beauty evaluation:

**Visual (p5/Shader/Three):**
- Color harmony
- Composition balance
- Visual complexity
- Motion quality
- Professional polish

**Audio (Tone/Strudel):**
- Frequency balance
- Musical structure
- Sound design quality
- Timbre quality
- No clipping

**Implementation:** `src/core/CreativeEvaluator.ts` + per-generator aesthetic modules
**Status:** ✅ Visual exists, ⚠️ Audio needs work

---

### 5. 🔒 SAFETY (Security & Resources)
**Applies to:** ALL generators

Security and resource protection:
- No eval() or new Function()
- No child_process
- No malicious fetch
- Infinite loop detection
- Memory/CPU limits
- Canvas size limits

**Implementation:** `src/core/SafetyGuardrails.ts` + `src/security/`
**Status:** ✅ Exists

---

## Pipeline Flow

```
Generation
    ↓
1. CODE QUALITY GATE
   ↓ Fail: Report to harness → Fix validation rules
    ↓
2. ANTI-HALLUCINATION GATE
   ↓ Fail: Report to harness → Fix API validation (M1!)
    ↓
3. ANTI-SLOP GATE
   ↓ Fail: Report to harness → Improve prompts
    ↓
4. AESTHETIC QUALITY GATE
   ↓ Fail: Report to harness → Adjust thresholds
    ↓
5. SAFETY GATE
   ↓ Fail: Report to harness → Block patterns
    ↓
✅ OUTPUT APPROVED
```

---

## Current Gaps

| Type | Status | Gap |
|------|--------|-----|
| Code Quality | ✅ | Good coverage |
| Anti-Hallucination | ⚠️ | Tone.js only checks 'unknown' domain (M1 fixes) |
| Anti-Slop | ⚠️ | Weak - no explicit slop rejection |
| Aesthetic | ⚠️ | Visual good, audio minimal |
| Safety | ✅ | Good coverage |

---

## How Harness Improves Each

When any gate fails, harness:

1. **Logs failure** via `onGenerationComplete()`
2. **Detects pattern** in FailureLogger
3. **Creates task** in harness-tasks/
4. **Applies fix** via HarnessAgent
5. **Validates** fix works

**Example (M1):**
- **Problem:** Tone.js validation only on 'unknown' domain
- **Detected:** Music domain Tone.js outputs failing
- **Fix:** M1 task expands validation to 'music' domain
- **Result:** Better hallucination catching for ToneGenerator

---

## Visual Diagrams

- **Full Architecture:** `docs/architecture-v2.html`
- **Guardrail Details:** `docs/architecture-guardrails.html`
- **Quick Reference:** `docs/ARCHITECTURE_QUICKREF.md`

---

## Key Principle

> Generators don't self-improve, but they ARE improved by the harness via fixes to:
> - Validation rules (all 5 guardrail types)
> - Prompts
> - Quality thresholds
> - Routing logic
> - Any other system component
