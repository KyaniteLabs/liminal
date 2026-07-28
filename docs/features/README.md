# Sinter Features

This directory documents the unique, innovative features of Sinter.

---

## Core Innovations

### 1. [Thinking-Trace Feedback Loop](./thinking-trace-feedback-loop.md) ⭐ PRIMARY INNOVATION

**What it does**: Captures LLM reasoning traces, analyzes them with two questions ("WHERE DID IT GO WRONG?" / "HOW CAN I COMMUNICATE BETTER?"), and records improvement insights for future prompt and routing work.

**Status**: ✅ **WIRED THROUGH THE ACTIVE GENERATOR PIPELINE**

Generator coverage follows the active default branch. Forgejo main and the GitHub mirror are different code generations, so this document states the shared invariant instead of a branch-specific generator total.

**Unique Aspects**:
- Generator thinking and harness thinking are **kept separate**
- Harness **actively analyzes** generator reasoning with LLM
- Answers two critical questions for every failure
- Applied to **entire app** (CLI, TUI, API, all domains)

**Real Impact**: Minimax M2.7 went from 0% to 67% success by detecting `code_in_thinking` pattern

---

### 2. [Compost Mill](../plans/2026-03-20-compost-mill-design.md)

**What it does**: Digests previous generations into nutrient-rich seeds for evolutionary search.

**Status**: ✅ **FULLY IMPLEMENTED**

**Synergy with Thinking-Trace**:
- Compost = "What to generate?"
- Thinking-Trace = "How to communicate?"

---

## Architecture Philosophy

Both features embody:

> **"Nothing is waste. Everything is signal."**

| Input Type | Traditional Systems | Sinter |
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
| Generator pipeline | ✅ Wired through the active generator registry |
| Thinking extraction | ✅ `LLMClient.ts` |
| Code recovery | ✅ `TierBasedGenerator.ts` |
| Generator thinking storage | ✅ `ThinkingSeparation.ts` |
| Harness thinking storage | ✅ `ThinkingSeparation.ts` |
| Harness analysis | ✅ `MetaHarnessIntegration.ts` |
| Pattern detection | ✅ `PatternDetector.ts` |
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

- [Generator architecture](../GENERATOR_ARCHITECTURE_V2.md) - Model-aware prompting and routing
- [Meta-Harness self-evaluation](../META_HARNESS_SELF_EVALUATION.md) - Improvement insights and outer-loop evaluation
- [Runtime validation](../launch/launch-candidate-2026-04-30.md) - Headless browser launch evidence

---

## For Developers

These features are integrated into the runtime; provider-backed analysis requires a configured LLM:

```typescript
// Thinking-Trace automatically captures from all generators
const response = await llm.generate(prompt);
// response.thinking is extracted and analyzed

// Compost automatically digests gallery entries
await compostMill.digest('./gallery');
```

No additional feature flag is needed; analysis and persistence require a configured LLM provider.
