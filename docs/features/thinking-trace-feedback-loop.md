# Thinking-Trace Feedback Loop

## Overview

The **Thinking-Trace Feedback Loop** is Liminal's mechanism for capturing, analyzing, and learning from LLM reasoning traces—turning every generation attempt (success or failure) into training signal for system improvement.

> **Core Innovation**: Unlike traditional systems that discard "failed" outputs, Liminal treats the model's reasoning process as first-class telemetry, extracting insights from *how* the model thinks, not just *what* it produces.

> **Unique Architecture**: Generator thinking and harness thinking are kept completely separate and analyzed differently. The harness asks two critical questions: **"WHERE DID IT GO WRONG?"** and **"HOW CAN I COMMUNICATE BETTER?"**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GENERATION PHASE                             │
│                                                                  │
│  User Prompt → ANY of 9 Generators → LLM Call                   │
│                                              ↓                  │
│                                    ┌──────────────────┐         │
│                                    │ Raw Response     │         │
│                                    │ ├─ code          │         │
│                                    │ ├─ thinking      │ ←───────┼── KEY
│                                    │ └─ metrics       │         │
│                                    └────────┬─────────┘         │
│                                             ↓                   │
│                              ┌──────────────────────┐          │
│                              │ Thinking Recovery    │          │
│                              │ (if code empty)      │          │
│                              └──────────┬───────────┘          │
└─────────────────────────────────────────┼──────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     REPORTING PHASE                              │
│                                                                  │
│  TierBasedGenerator calls:                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 1. Emergent Patterns (long-term trends)                     │ │
│  │    → modelBehaviorPatterns.recordObservation()              │ │
│  │                                                             │ │
│  │ 2. Meta-Harness (immediate analysis)                        │ │
│  │    → metaHarness.onGenerationComplete({thinking})          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────┬───────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                     HARNESS ANALYSIS PHASE                       │
│                                                                  │
│  MetaHarness.analyzeGeneratorThinking():                         │
│                                                                  │
│  Prompts harness LLM with:                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ PROMPT GIVEN TO GENERATOR: [original prompt]                │ │
│  │ SUCCESS: [true/false]                                       │ │
│  │                                                             │ │
│  │ GENERATOR'S THINKING:                                       │ │
│  │ [full thinking trace]                                       │ │
│  │                                                             │ │
│  │ YOUR TASK:                                                  │ │
│  │ 1. WHERE DID IT GO WRONG?                                   │ │
│  │ 2. HOW CAN I COMMUNICATE BETTER?                            │ │
│  │ 3. SYSTEM IMPROVEMENT SUGGESTIONS                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│                    ┌──────────────────┐                         │
│                    │ Harness LLM      │                         │
│                    │ analyzes         │                         │
│                    └────────┬─────────┘                         │
│                             ↓                                    │
│                    ┌──────────────────┐                         │
│                    │ Insights stored  │                         │
│                    │ in harnessMemory │                         │
│                    └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Separation of Concerns

### Generator Thinking
- **Location**: `~/.liminal/thinking-traces/generator/`
- **Question**: "How do I create this code?"
- **Content**: Creative reasoning, domain confusion, code attempts
- **Mined For**:
  - `code_in_thinking` - Code embedded in `<think>` tags
  - `confusion` - Unclear on requirements
  - `over_engineering` - Premature optimization
  - `wrong_domain` - Thinking about wrong technology

### Harness Thinking  
- **Location**: `~/.liminal/thinking-traces/harness/`
- **Question**: "How do I fix this system?"
- **Content**: Meta-reasoning about architecture, tools, prompts
- **Mined For**:
  - Tool suggestions
  - Architectural insights
  - Validation gaps
  - Prompt engineering improvements

**CRITICAL**: These are NEVER mixed. They serve different purposes.

---

## Implementation Status

### ✅ Fully Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Thinking extraction | ✅ | `src/llm/LLMClient.ts` |
| Code recovery | ✅ | `src/generators/TierBasedGenerator.ts` |
| Generator thinking storage | ✅ | `src/harness/ThinkingSeparation.ts` |
| Harness thinking storage | ✅ | `src/harness/ThinkingSeparation.ts` |
| Harness analysis | ✅ | `src/harness/MetaHarnessIntegration.ts` |
| Emergent patterns | ✅ | `src/emergent/ModelBehaviorPatterns.ts` |
| All 9 generators wired | ✅ | All extend `TierBasedGenerator` |

### All 9 Generators Use This Architecture

1. **P5GeneratorV2** - p5.js visual sketches
2. **ThreeGenerator** - Three.js 3D graphics
3. **ShaderGenerator** - GLSL shaders
4. **StrudelGenerator** - Strudel music patterns
5. **HydraGenerator** - Hydra video synthesis
6. **ToneGenerator** - Tone.js audio
7. **RevideoGenerator** - Revideo motion graphics
8. **HTMLWebGenerator** - HTML/CSS
9. **ASCIIArtGenerator** - ASCII art

---

## Machine Learning Concepts

### 1. Reasoning Distillation

Traditional systems treat the model as a black box. Liminal extracts the reasoning trace:

```
Input → [Model] → {Thinking} → {Output}
                 ↓              ↓
            Reasoning      Generated
            Trace          Code
                 ↓              ↓
            Pattern        Success/
            Detection      Failure
                 ↓              ↓
            Meta-Learning ←───┘
```

### 2. Adversarial Failure Mining

When a model produces empty code but rich thinking:

| Traditional | Thinking-Trace Loop |
|-------------|---------------------|
| "Empty output = discard" | "Empty output + thinking = pattern detection" |
| Generic error logs | "WHERE DID IT GO WRONG?" analysis |
| Reactive fixing | "HOW CAN I COMMUNICATE BETTER?" adaptation |

### 3. Meta-Learning from Reasoning

The harness doesn't just see *what* failed—it sees *why* the generator thought it would work:

```
Generator Thinking:
"I'll create a particle system using object pooling 
for performance..."

Harness Analysis:
→ WHERE DID IT GO WRONG?
  Pattern: over_engineering detected
  
→ HOW CAN I COMMUNICATE BETTER?  
  Suggestion: Add "keep it simple" constraint
  
→ SYSTEM IMPROVEMENT
  Adaptation: Apply to future prompts
```

---

## Real-World Example: Minimax M2.7

### The Problem
Minimax M2.7 appeared broken—returning empty code for 8/9 domains.

### Traditional Diagnosis
"Model doesn't work. Don't use it."

### Thinking-Trace Diagnosis

**Captured thinking**:
```
<think>
The user wants a particle system. I need to create a p5.js 
sketch with setup() and draw() functions.

```javascript
function setup() {
  createCanvas(400, 400);
}
function draw() {
  background(0);
}
```

This should work well...
</think>
```

**Harness Analysis**:
- **WHERE DID IT GO WRONG?**: Model outputs code inside `<think>` tags
- **HOW CAN I COMMUNICATE BETTER?**: Add "Output code AFTER thinking tags" instruction
- **Pattern**: `code_in_thinking` (confidence: 0.85)

**Result**: Model went from 0% to 67% recoverable (6/9 domains).

---

## Data Flow

### Generator Level
```typescript
// In TierBasedGenerator.generate()
const response = await this.llm.generate(...);

// response contains:
// - code: string (may be empty)
// - thinking: string (the reasoning trace)
// - thinkingMetrics: { length, hasCodeBlocks, hasFunctionDefinitions, ... }
// - recoveredFromThinking: boolean

// Automatically:
// 1. Attempt code recovery if empty
// 2. Store in emergent patterns
// 3. Report to meta-harness with thinking
```

### Harness Level
```typescript
// In MetaHarnessIntegration.analyzeGeneratorThinking()
const analysisPrompt = `
PROMPT GIVEN TO GENERATOR: ${result.prompt}
SUCCESS: ${result.success}

GENERATOR'S THINKING:
${result.thinking}

YOUR TASK:
1. WHERE DID IT GO WRONG?
2. HOW CAN I COMMUNICATE BETTER?
3. SYSTEM IMPROVEMENT SUGGESTIONS
`;

const response = await this.llmClient.generate(...);
// Stores insights in harness memory
```

---

## Configuration

No configuration required—the system is always active.

**Storage Locations**:
```
~/.liminal/
├── thinking-traces/
│   ├── generator/          # Generator reasoning
│   │   └── YYYY-MM-DD.jsonl
│   └── harness/            # Harness reasoning  
│       └── YYYY-MM-DD.jsonl
├── emergent-patterns/
│   └── patterns.json       # Long-term trends
└── failures/
    └── *.json              # Failure records with thinking
```

---

## Comparison to Compost Mill

| Feature | Compost Mill | Thinking-Trace Loop |
|---------|--------------|---------------------|
| **Input** | Code fragments | Reasoning traces |
| **Question** | "What to generate?" | "How to communicate?" |
| **Process** | Digestion/collision | Pattern detection |
| **Output** | Seeds/nuggets | Adaptations/fixes |
| **ML Concept** | Evolutionary search | Meta-learning |
| **Timeframe** | Hours (digestion) | Real-time (per gen) |
| **Analyzes** | Content | Intent |

**Synergy**: 
- Compost provides *what* to generate
- Thinking-Trace provides *how* to ask for it

---

## Benefits

### 1. **Zero-Waste Telemetry**
Every generation produces value:
- Success → Code + Thinking → Learning
- Failure → Thinking → Root cause analysis

### 2. **Model-Specific Optimization**
Auto-detects quirks:
- Minimax: Code in thinking
- Qwen: Over-apologizing  
- Local models: Truncation

### 3. **Self-Improving Communication**
The system learns how to talk to each model:
- "Add explicit instructions for Minimax"
- "Use simpler prompts for small models"
- "Include examples for complex domains"

### 4. **Debugging Power**
As a coding agent, you have full visibility:
- Generator thinking traces
- Harness analysis results
- Pattern detection
- Improvement suggestions

---

## Summary

The Thinking-Trace Feedback Loop transforms Liminal from a **code generator** into a **learning system** that:

1. **Captures** reasoning traces from ALL 9 generators
2. **Separates** generator thinking from harness thinking
3. **Analyzes** with two critical questions:
   - **WHERE DID IT GO WRONG?**
   - **HOW CAN I COMMUNICATE BETTER?**
4. **Adapts** prompts and system based on insights
5. **Feeds** learnings back into the generation loop

**Result**: Every failure teaches the system how to communicate better. Every success confirms what works.

> *"The model's thinking is not waste—it's the richest training data you have. And the harness's analysis of that thinking is how the system learns to improve itself."*

---

## See Also

- [Compost Mill](./compost-mill.md) - Long-term nutrient processing
- [Meta-Harness](../architecture/meta-harness.md) - System adaptation engine
- [Architecture Overview](../architecture/README.md) - Full system design
