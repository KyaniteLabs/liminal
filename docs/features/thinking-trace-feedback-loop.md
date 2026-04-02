# Thinking-Trace Feedback Loop

## Overview

The **Thinking-Trace Feedback Loop** is Liminal's mechanism for capturing, analyzing, and learning from LLM reasoning traces—turning every generation attempt (success or failure) into training signal for system improvement.

> **Core Innovation**: Unlike traditional systems that discard "failed" outputs, Liminal treats the model's reasoning process as first-class telemetry, extracting insights from *how* the model thinks, not just *what* it produces.

---

## Machine Learning Concepts

### 1. Reasoning Distillation

Traditional LLM systems treat the model as a black box:
```
Input → [Black Box] → Output
```

Liminal opens the box:
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

The **reasoning trace** (the model's internal monologue, captured in `<think>` tags or reasoning fields) contains:
- Intent signals (what the model *tried* to do)
- Confidence indicators (uncertainty markers)
- Strategy choices (which approach was selected)
- Error precursors (confusion before failure)

### 2. Adversarial Failure Mining

When a model produces empty code but rich thinking, traditional systems throw away both. Liminal uses this as **adversarial training data**:

| Traditional | Thinking-Trace Loop |
|-------------|---------------------|
| "Empty output = discard" | "Empty output + thinking = pattern detection" |
| Generic error logs | Structured reasoning analysis |
| Reactive fixing | Predictive adaptation |

The system detects patterns like:
- **Code-in-Thinking**: Model puts code in `<think>` tags (Minimax pattern)
- **Infinite Reconsideration**: Model stuck in analysis paralysis
- **Over-Engineering**: Premature optimization for simple tasks
- **Hallucination**: References to non-existent APIs

### 3. Meta-Learning from Reasoning

The harness model receives not just *what* failed, but *why* the generator thought it would succeed:

```
Generator Thinking:
"I'll create a particle system using object pooling 
for performance..."

Harness Analysis:
→ Pattern: over_engineering detected
→ Model: over-complicating simple task
→ Suggestion: Add "keep it simple" constraint
→ Adaptation: Apply to future prompts
```

This is **meta-learning**—learning how to learn from the generator's own reasoning process.

### 4. Nutrient-Rich Compost

The Compost Mill receives thinking traces as **high-entropy nutrients**:

| Input Type | Nutrient Value |
|------------|----------------|
| Working code | High (functional patterns) |
| Broken code | Medium (anti-patterns) |
| **Thinking traces** | **Very High** (intent + strategy) |

Thinking contains:
- **Semantic embeddings** of the model's understanding
- **Decision boundaries** (why this approach vs. that)
- **Alternative explorations** (paths not taken)

When the Compost Mill digests these, it generates seeds with *understanding*, not just syntax.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATION PHASE                              │
│                                                                  │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐ │
│  │   Prompt    │───►│  LLM (Generator) │───►│ Raw Response    │ │
│  └─────────────┘    └──────────────────┘    └────────┬────────┘ │
│                                                      │           │
│                              ┌───────────────────────┘           │
│                              ↓                                   │
│                    ┌──────────────────┐                         │
│                    │ Parse Response   │                         │
│                    │ ├─ Extract code  │                         │
│                    │ ├─ Extract thinking│                        │
│                    │ └─ Compute metrics │                        │
│                    └────────┬─────────┘                         │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              ↓              ↓              ↓                    │
│        ┌─────────┐  ┌────────────┐  ┌────────────┐             │
│        │  Code   │  │  Thinking  │  │  Metrics   │             │
│        │ (Output)│  │  (Trace)   │  │  (ML feats)│             │
│        └────┬────┘  └─────┬──────┘  └─────┬──────┘             │
│             │             │               │                    │
└─────────────┼─────────────┼───────────────┼────────────────────┘
              │             │               │
              ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEEDBACK PHASE                               │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │   Compost   │  │  Harness Model   │  │  Emergent Patterns  │ │
│  │    Mill     │  │  (Meta-Learner)  │  │   (Pattern Detect)  │ │
│  │             │  │                  │  │                     │ │
│  │ ├─ Thinking │  │ ├─ Analyze trace │  │ ├─ code_in_thinking │ │
│  │ │  as       │  │ │  for patterns  │  │ ├─ over_engineering │ │
│  │ │  nutrients│  │ │                │  │ ├─ confusion        │ │
│  │ └─ Seeds    │  │ └─ Suggest fixes │  │ └─ trends           │ │
│  │    w/       │  │                  │  │                     │ │
│  │    intent   │  │                  │  │                     │ │
│  └─────────────┘  └──────────────────┘  └─────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. LLMClient (Reasoning Extraction Layer)

**Function**: Parse raw LLM responses into structured `{code, thinking, metrics}`

**ML Techniques**:
- **Multi-modal parsing**: Handles OpenAI, Ollama, Anthropic response formats
- **Pattern extraction**: Regex-based thinking tag detection
- **Feature engineering**: Computes `hasCodeBlocks`, `hasFunctionDefinitions`, `attemptedDomain`

**Code Recovery Strategy**:
```typescript
if (codeEmpty && thinkingHasCodeBlocks) {
  code = extractFromThinking(thinking);
  markAsRecovered();
}
```

### 2. ThinkingAnalyzer (Meta-Learning Engine)

**Function**: Analyze reasoning traces to generate adaptation suggestions

**ML Techniques**:
- **Pattern classification**: Maps reasoning content to known failure modes
- **Confidence scoring**: Ranks suggestions by pattern frequency
- **Causal inference**: Links reasoning patterns to output failures

**Example Analysis**:
```
Input: "<think>I'll use object pooling for performance...</think>"
Pattern: over_engineering (confidence: 0.75)
Suggestion: Add "keep it simple" constraint to prompt
Learning: "Model over-complicates simple tasks"
```

### 3. ModelBehaviorPatterns (Emergent Pattern Detection)

**Function**: Track patterns across many generations to detect model-specific behaviors

**ML Techniques**:
- **Time-series analysis**: Detects trends (increasing/decreasing/stable)
- **Frequency analysis**: Identifies recurring issues per model/domain
- **Auto-adaptation**: Generates prompt modifications automatically

**Patterns Tracked**:
- `code_in_thinking` - Model puts code in `<think>` tags
- `infinite_reconsideration` - Model stuck in circular reasoning
- `truncated_code` - Consistent mid-function cutoffs
- `wrong_domain` - Domain confusion patterns

### 4. Compost Integration (Nutrient Enrichment)

**Function**: Feed thinking traces into Compost Mill as high-value nutrients

**ML Concept**: **Data Augmentation via Reasoning**

Standard compost: "Here's broken code"
Enriched compost: "Here's broken code, and *here's what the model thought it was doing*"

This allows the Compost Mill to generate seeds that account for **model intent**, not just output.

---

## Real-World Example: Minimax M2.7

### The Problem

Minimax M2.7 was returning empty code for 8/9 domains, appearing completely broken.

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

**Analysis**:
- Pattern: `code_in_thinking`
- Confidence: 0.85
- Root cause: Model outputs code inside `<think>` tags
- Solution: Extract code from thinking, add prompt constraint

**Result**: Model went from 11% success to recoverable for all domains.

---

## Benefits

### 1. **Zero-Waste Telemetry**

Every generation attempt produces value:
- Success → Code + Thinking → Compost nutrients
- Failure → Thinking → Pattern detection → Adaptation

### 2. **Model-Specific Optimization**

Detects quirks of specific models:
- Minimax: Code in thinking
- Qwen: Over-apologizing
- Local models: Truncation issues

Automatically adapts prompts per model.

### 3. **Predictive Failure Prevention**

Reasoning patterns predict failures *before* they happen:
- "Let me reconsider..." → Likely timeout
- "I'm not sure..." → Likely confusion → Wrong domain

System can intervene early.

### 4. **Continuous Learning Loop**

```
Generate → Capture Thinking → Analyze → Adapt → Generate Better
     ↑_________________________________________________↓
```

System improves with every attempt, successful or not.

---

## Comparison to Compost Mill

| Feature | Compost Mill | Thinking-Trace Loop |
|---------|--------------|---------------------|
| **Input** | Code files | Reasoning traces |
| **Process** | Digestion/shredding | Pattern detection |
| **Output** | Seeds/nuggets | Adaptations/fixes |
| **ML Concept** | Evolutionary search | Meta-learning |
| **Timeframe** | Hours (digestion) | Real-time (per gen) |
| **Value** | Long-term improvement | Immediate adaptation |

**Synergy**: Compost provides *what* to generate; Thinking-Trace provides *how* to prompt for it.

---

## Configuration

No configuration required—the system is always active.

**Optional Environment Variables**:
```bash
# Thinking trace storage
LIMINAL_THINKING_DIR=~/.liminal/thinking-traces

# Pattern detection sensitivity (0-1)
LIMINAL_PATTERN_THRESHOLD=0.7

# Enable/disable auto-adaptation
LIMINAL_AUTO_ADAPT=true
```

---

## Future Enhancements

1. **Chain-of-Thought Distillation**: Train smaller models on extracted reasoning
2. **Cross-Model Reasoning Transfer**: Apply Minimax insights to other models
3. **Reasoning Embeddings**: Vectorize thinking for similarity search
4. **Interactive Reasoning**: Show user the model's reasoning process

---

## Summary

The Thinking-Trace Feedback Loop transforms Liminal from a **code generator** into a **learning system**:

- **Captures** reasoning traces (the "why" behind the "what")
- **Analyzes** patterns in model thinking
- **Adapts** prompts and configurations automatically
- **Feeds** insights back into generation loop

**Result**: Every failure makes the system smarter. Every success teaches it more about model behavior.

> *"The model's thinking is not waste—it's the richest training data you have."*

---

## See Also

- [Compost Mill](./compost-mill.md) - Long-term nutrient processing
- [Meta-Harness](../architecture/meta-harness.md) - System adaptation engine
- [Model Tiers](../architecture/model-tiers.md) - Model-specific optimizations
