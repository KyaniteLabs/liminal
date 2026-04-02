# Liminal Features

This directory documents the unique, innovative features of Liminal that distinguish it from other creative coding tools.

---

## Core Innovations

### 1. [Compost Mill](./compost-mill.md)

**Concept**: Evolutionary search through code fragments

The Compost Mill treats code generation as an evolutionary process:
- **Input**: Previous generations (working and broken)
- **Process**: Digestion, collision, selection
- **Output**: Seeds/nuggets for new generations

**ML Technique**: Genetic programming + neural guidance

---

### 2. [Thinking-Trace Feedback Loop](./thinking-trace-feedback-loop.md)

**Concept**: Meta-learning from LLM reasoning traces

> **Unique Innovation**: Unlike any other creative coding tool, Liminal captures and learns from the model's *reasoning process*, not just its output.

The Thinking-Trace Loop treats model reasoning as first-class telemetry:
- **Input**: LLM reasoning traces (`<think>` tags, reasoning fields)
- **Process**: Pattern detection, meta-learning, adaptation
- **Output**: Prompt fixes, model-specific optimizations

**ML Techniques**: 
- Reasoning distillation
- Adversarial failure mining
- Meta-learning from reasoning

**Key Insight**: Failed generations with rich thinking are more valuable than successful generations without reasoning data.

---

## How These Features Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE LIMINAL LOOP                              │
│                                                                  │
│  Generation                                                      │
│      ↓                                                           │
│  Capture Code ────────► Compost Mill ────────► Seeds/Nuggets    │
│      ↓                              (long-term nutrient)         │
│  Capture Thinking ───► Pattern Detection ────► Adaptations      │
│      ↓                              (real-time learning)         │
│  Next Generation (improved)                                      │
│      ↓                                                           │
│  [Repeat]                                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Compost Mill** answers: *"What should I generate?"*
**Thinking-Trace Loop** answers: *"How should I prompt for it?"*

---

## Feature Comparison

| Aspect | Compost Mill | Thinking-Trace Loop |
|--------|--------------|---------------------|
| **What it learns from** | Code fragments | Reasoning traces |
| **Time scale** | Hours/days | Real-time |
| **ML paradigm** | Evolutionary search | Meta-learning |
| **Value per input** | High | Very High |
| **Output type** | Content (seeds) | Strategy (adaptations) |
| **When it helps** | Future generations | Next generation |

---

## The Philosophy

Both features embody the same core philosophy:

> **"Nothing is waste. Everything is signal."**

Traditional systems:
- Broken code → Trash
- Failed attempts → Logs (maybe)
- Model thinking → Ignored

Liminal:
- Broken code → Compost nutrients
- Failed attempts → Pattern data
- Model thinking → Richest training signal

---

## Other Features

- [Model Tiers](../architecture/model-tiers.md) - Automatic prompt adaptation based on model capability
- [Meta-Harness](../architecture/meta-harness.md) - Self-improving outer loop
- [Runtime Validation](../architecture/runtime-validation.md) - Actual code execution in headless browser

---

## For Developers

These features are not just documentation—they're implemented and active:

- `src/compost/` - Compost Mill implementation
- `src/llm/LLMClient.ts` - Thinking extraction
- `src/emergent/ModelBehaviorPatterns.ts` - Pattern detection
- `src/harness/ThinkingAnalyzer.ts` - Meta-learning engine
