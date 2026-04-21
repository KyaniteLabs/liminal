# Liminal Features

This directory documents the unique, innovative features of Liminal.

---

## Core Innovations

### 1. [Thinking-Trace Feedback Loop](./thinking-trace-feedback-loop.md) ⭐ PRIMARY INNOVATION

**What it does**: Captures LLM reasoning traces, analyzes them with two questions ("WHERE DID IT GO WRONG?" / "HOW CAN I COMMUNICATE BETTER?"), and adapts the system.

**Status**: ✅ **FULLY IMPLEMENTED** - All 11 generators use this

**Unique Aspects**:
- Generator thinking and harness thinking are **kept separate**
- Harness **actively analyzes** generator reasoning with LLM
- Answers two critical questions for every failure
- Applied to **entire app** (CLI, TUI, API, all domains)

**Real Impact**: Minimax M2.7 went from 0% to 67% success by detecting `code_in_thinking` pattern

---

### 2. [Compost Mill](./compost-mill.md)

**What it does**: Digests previous generations into nutrient-rich seeds for evolutionary search.

**Status**: ✅ **FULLY IMPLEMENTED**

**Synergy with Thinking-Trace**:
- Compost = "What to generate?"
- Thinking-Trace = "How to communicate?"

---

## Architecture Philosophy

Both features embody:

> **"Nothing is waste. Everything is signal."**

| Input Type | Traditional Systems | Liminal |
|------------|-------------------|---------|
| Broken code | Trash | Compost nutrients |
| Failed attempts | Logs (maybe) | Pattern data + harness analysis |
| Model thinking | Ignored | **Richest training data** |
| Harness analysis | N/A | **System improvement engine** |

---

## Implementation Coverage

### Thinking-Trace Loop

| Component | Status |
|-----------|--------|
| All 11 generators | ✅ Wired |
| Thinking extraction | ✅ `LLMClient.ts` |
| Code recovery | ✅ `TierBasedGenerator.ts` |
| Generator thinking storage | ✅ `ThinkingSeparation.ts` |
| Harness thinking storage | ✅ `ThinkingSeparation.ts` |
| Harness analysis | ✅ `MetaHarnessIntegration.ts` |
| Emergent patterns | ✅ `ModelBehaviorPatterns.ts` |
| "Where wrong?" analysis | ✅ Implemented |
| "How communicate?" analysis | ✅ Implemented |

### Compost Mill

| Component | Status |
|-----------|--------|
| Digestion | ✅ |
| Collision engine | ✅ |
| Seed promotion | ✅ |
| Soup loop | ✅ |

---

## Feature Comparison

| Aspect | Compost Mill | Thinking-Trace Loop |
|--------|--------------|---------------------|
| **Learns from** | Code fragments | Reasoning traces |
| **Answers** | "What to generate?" | "How to communicate?" |
| **Analyzes** | Content | Intent & confusion |
| **Time scale** | Hours/days | Real-time |
| **ML paradigm** | Evolutionary | Meta-learning |
| **Key question** | "What works?" | "WHERE DID IT GO WRONG?" |

---

## Other Features

- [Model Tiers](../architecture/model-tiers.md) - Automatic prompt adaptation
- [Meta-Harness](../architecture/meta-harness.md) - Self-improving outer loop
- [Runtime Validation](../architecture/runtime-validation.md) - Headless browser testing

---

## For Developers

These features are **production-ready** and **always active**:

```typescript
// Thinking-Trace automatically captures from all generators
const response = await llm.generate(prompt);
// response.thinking is extracted and analyzed

// Compost automatically digests gallery entries
await compostMill.digest('./gallery');
```

No configuration needed. The system learns continuously.
