# Agent vs Generator Model Architecture: The Meta-Harness Design

**Status:** Proposal  
**Date:** March 31, 2026  
**References:** 
- Huntley, G. [The Ralph Wiggum Loop](https://ghuntley.com/ralph/) — "Sit on the loop, not in it"
- Lee, Y. et al. [Meta-Harness (arXiv:2603.28052)](https://arxiv.org/abs/2603.28052) — "Outer-loop system that searches over harness code"
- Karpathy [Autoresearch](https://github.com/karpathy/autoresearch) — "program.md (human) + train.py (agent)"

---

## Executive Summary

This document proposes a **Meta-Harness architecture** for Liminal, inspired by three converging ideas:

1. **Ralph Wiggum**: "Sit on the loop, not in it" — design validation upfront, observe, tune
2. **Meta-Harness (arXiv 2603.28052)**: Outer-loop system that searches over harness code, richer access to prior experience enables automated harness engineering
3. **Autoresearch**: Human writes instructions (`program.md`), agent executes (`train.py`), fixed-time experiments, evolutionary improvement

**Core Principle:** The harness (Agent Model) evolves separately from the experiments (Generator Models).

---

## The Problem: Monolithic Model Limits

### Evidence from Dogfood Testing (63 iterations)

| Scenario | What Happened | Why It Failed |
|----------|---------------|---------------|
| Qwen3.5 for everything | Timeouts on all domains | Gets stuck in "thinking mode" with complex prompts |
| Phi4-Mini for GLSL | Poor shader quality | Model too small for complex GLSL |
| Gemma3-4B for Strudel | Invalid syntax | Model doesn't understand Strudel mini-notation |

### Root Cause

**Expecting one model to excel at all three tasks is unrealistic:**
- **Routing/Planning**: Needs reasoning, domain knowledge
- **Code Generation**: Needs syntax knowledge, domain expertise  
- **Evaluation**: Needs critical analysis

---

## The Solution: Meta-Harness Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  META-HARNESS (Agent Model)                                         │
│  "Sits on the loop, not in it" — Huntley                            │
│  "Outer-loop system that searches over harness code" — Meta-Harness │
│  "program.md: human instructions for the agent" — Autoresearch      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ RESPONSIBILITIES:                                           │   │
│  │ • Understand user intent (planning)                         │   │
│  │ • Select Generator Model per domain                         │   │
│  │ • Evaluate outputs (quality, validity)                      │   │
│  │ • Detect failure domains (pattern recognition)              │   │
│  │ • Tune the harness:                                         │   │
│  │   - Add/update validators                                   │   │
│  │   - Adjust prompts per model                                │   │
│  │   - Switch Generator Models                                 │   │
│  │   - Update "program.md" equivalent                          │   │
│  │ • DOES NOT fix outputs directly (feeds back to loop)        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ Decides which Generator to use
                        │ Provides "program.md" context
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GENERATOR MODELS (Domain-specific)                                 │
│  "Deterministically bad in an undeterministic world" — Huntley      │
│  "train.py: the file the agent edits" — Autoresearch                │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ p5.js    │ │ GLSL     │ │ Strudel  │ │ Three.js │               │
│  │ Phi4     │ │ Gemma3   │ │ MiniMax  │ │ Kimi     │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                     │
│  Fixed-time experiments (iterations), evolutionary selection        │
└─────────────────────────────────────────────────────────────────────┘
                        │
                        ▼ Broken output?
┌─────────────────────────────────────────────────────────────────────┐
│  FEED BACK INTO LIMINAL (Meta-Harness observes)                     │
│  • Capture thinking/reasoning from all models                       │
│  • Log failure patterns                                             │
│  • Agent updates harness (validators, prompts, model selection)     │
│  • Next iteration uses improved harness                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Principles

### 1. Separation of Concerns (Autoresearch Pattern)

| Component | Human (You) | Agent (Meta-Harness) | Generator |
|-----------|-------------|---------------------|-----------|
| **Writes** | `program.md` — goals, constraints, evaluation criteria | Harness code — validators, routers, prompts | Code per iteration |
| **Modifies** | High-level strategy | System behavior per domain | Implementation |
| **Evolution** | Rarely (quarterly) | Continuously (per failure) | Every iteration |

### 2. The Harness Evolves Separately

**Meta-Harness insight (arXiv 2603.28052):**
> "Richer access to prior experience can enable automated harness engineering."

**Application to Liminal:**
- Agent observes all 63 dogfood iterations
- Detects patterns: "Qwen timeouts with complex prompts"
- Updates harness: adds `isQwenModel()` check, simplified prompts
- Next 63 iterations benefit automatically

### 3. Fixed-Time Experiments (Autoresearch Pattern)

Karpathy's design:
> "Training always runs for exactly 5 minutes... approx 12 experiments/hour"

Liminal equivalent:
> "Each iteration has fixed max time... RalphLoop iterates until promise or limit"

**Why:** Comparable experiments regardless of what changes (model, prompt, domain)

### 4. Never Fix Outputs Programmatically

**Critical Rule:**

> "The only thing you are allowed to do with a broken dogfood test output, is feed it into liminal again as is, for liminal to catch it and fix it by themself."

**This IS the Meta-Harness principle:**

```
Broken Output (e.g., Qwen timeout)
        ↓
Feed back into Liminal unchanged
        ↓
Meta-Harness (Agent) observes pattern
        ↓
Harness updates: Model-specific prompt adaptation
        ↓
Next iteration: Qwen works
```

**Wrong approach ("sitting IN the loop"):**
```
Qwen timeout
  ↓
DEV manually patches timeout handling
  ↓
Still fails differently next time
```

### 5. Thinking/Reasoning Captured From ALL Models

**Meta-Harness learns from internal reasoning:**
- Qwen's `thinking` field shows why it got stuck
- GPT-4o's reasoning shows planning process
- All captured, stored, used for harness improvement

---

## Concrete Example: Qwen Timeout Fix

### Before Meta-Harness

```
Dogfood Test: Qwen3.5-0.8b × p5
  ↓
TIMEOUT (130s)
  ↓
Developer manually investigates
  ↓
Patches LLMClient with timeout handling
  ↓
Next test: Still fails (different reason)
  ↓
Repeat...
```

**Problem:** Developer is "sitting IN the loop" — reactive, manual, not scalable

### With Meta-Harness

```
Dogfood Test: Qwen3.5-0.8b × p5
  ↓
TIMEOUT (130s)
  ↓
Feed output back into Liminal as-is
  ↓
Meta-Harness (Agent) analyzes:
  • Response empty, thinking field 7000+ chars
  • Pattern: "Thinking Process:" → never transitions to code
  • Similar to prior Qwen failures in GLSL, Strudel...
  ↓
Harness self-updates:
  • Add isQwenModel() detection
  • Use simplified prompts for Qwen (avoid thinking trap)
  • Extract code from thinking field if response empty
  ↓
Next Dogfood Test: Qwen3.5-0.8b × p5
  ↓
SUCCESS (55s) — Harness learned
```

**Benefit:** Harness improved itself from observation, no manual intervention

---

## Configuration: program.md Equivalent

### Default (Agent = Generator)
```typescript
// liminal.config.ts — "program.md" for the Meta-Harness
export default {
  // Meta-Harness (Agent Model) — runs Liminal internally
  agent: {
    baseUrl: 'http://localhost:11434',
    model: 'phi4-mini',  // Stable, good at reasoning
    apiStyle: 'ollama',
    
    // Harness evolution settings
    harness: {
      autoTune: true,           // Update validators/prompts from failures
      failurePatternWindow: 10, // Look at last 10 failures for patterns
      experimentBudget: 100,    // Max iterations per session (Karpathy: ~100 overnight)
    }
  },
  
  // Generators (default to agent — no specialization)
  generators: {
    default: 'agent',
  }
}
```

### Specialized (Different Generator per Domain)
```typescript
// liminal.config.ts — evolved from dogfood learnings
export default {
  agent: {
    baseUrl: 'http://localhost:11434',
    model: 'phi4-mini',
    apiStyle: 'ollama',
    
    harness: {
      autoTune: true,
      // Harness has learned these patterns from prior failures:
      learnedPatterns: {
        'qwen-thinking-trap': {
          detector: 'model.includes("qwen") && response.empty && thinking.length > 5000',
          action: 'useSimplifiedPrompt'
        },
        'glsl-undefined-function': {
          detector: 'domain === "glsl" && validation.errors.includes("undefined function")',
          action: 'addFunctionDefinitionReminder'
        },
        'tone-hallucinated-api': {
          detector: 'domain === "tone" && validation.errors.includes("Invalid class")',
          action: 'strengthenApiWhitelist'
        }
      }
    }
  },
  
  generators: {
    default: 'agent',
    
    // Harness learned: Gemma3 better for GLSL
    glsl: {
      baseUrl: 'http://localhost:11434',
      model: 'gemma3:4b',
      apiStyle: 'ollama'
    },
    
    // Harness learned: Strudel needs cloud model
    strudel: {
      baseUrl: 'https://api.minimax.io/v1',
      model: 'MiniMax-M2.5',
      apiKey: '${MINIMAX_API_KEY}'
    },
    
    // Harness learned: Qwen needs simplified prompts
    p5: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen3.5:0.8b',
      apiStyle: 'ollama',
      promptStyle: 'simplified'  // Harness-evolved
    }
  }
}
```

---

## Implementation Phases

### Phase 1: ✅ Thinking Field Capture (Complete)
- Capture `thinking` from Ollama responses
- Capture `reasoning_content` from OpenAI responses
- Store in `result.reasoning` for harness learning

### Phase 2: ✅ Model-Specific Prompts (Complete)
- Detect Qwen models automatically
- Use simplified prompts for Qwen (avoid thinking trap)
- Extract code from thinking field if response empty

### Phase 3: Harness Registry (Next)
```typescript
// src/harness/HarnessRegistry.ts
interface HarnessConfig {
  // Learned patterns from failures
  patterns: Map<string, {
    detector: (context: FailureContext) => boolean;
    action: (harness: Harness) => void;
  }>;
  
  // Auto-evolved generator mappings
  generatorSelection: Map<string, LLMConfig>;
  
  // Validators added from failures
  customValidators: CodeValidator[];
}

class HarnessRegistry {
  observeFailure(failure: FailureContext): void {
    // Check against all patterns
    for (const [name, pattern] of this.config.patterns) {
      if (pattern.detector(failure)) {
        pattern.action(this);
        this.logPatternMatched(name, failure);
      }
    }
  }
}
```

### Phase 4: Full Meta-Harness (Future)
```typescript
// src/core/MetaHarness.ts
class MetaHarness {
  private agent: LLMClient;        // Agent Model (runs Liminal)
  private harness: HarnessRegistry; // Evolved rules
  private experimentLog: Experiment[]; // All prior iterations
  
  async runExperiment(prompt: string, domain: string): Promise<string> {
    // 1. Select Generator based on harness-learned rules
    const generator = this.harness.selectGenerator(domain);
    
    // 2. Run fixed-time experiment (RalphLoop)
    const result = await this.runFixedTimeExperiment(prompt, generator);
    
    // 3. Observe outcome
    if (!result.success) {
      // Feed back into harness (NOT fixing directly)
      this.harness.observeFailure({
        domain,
        model: generator.model,
        error: result.error,
        reasoning: result.reasoning, // Crucial for harness learning
      });
    }
    
    // 4. Log for future pattern detection
    this.experimentLog.push(result);
    
    return result.code;
  }
}
```

---

## Benefits

| Benefit | Explanation | Source |
|---------|-------------|--------|
| **Automated Improvement** | Harness learns from failures without manual intervention | Meta-Harness paper: "automated harness engineering" |
| **Predictability** | Agent model stable = consistent Liminal behavior | Ralph: monolithic process |
| **Domain Optimization** | Each domain uses best model for that domain | Dogfood evidence |
| **Cost Control** | Small models for generation, one good agent | Autoresearch: fixed-time experiments |
| **Scalable Learning** | 100 iterations overnight → harness improves | Autoresearch: "approx 100 experiments while you sleep" |

---

## Summary: The Three Pillars

| Pillar | Concept | Implementation in Liminal |
|--------|---------|---------------------------|
| **Ralph Wiggum** | "Sit on the loop, not in it" | Agent Model orchestrates, observes, tunes; does not micromanage iterations |
| **Meta-Harness** | Outer-loop searches over harness code | Agent detects patterns, updates validators/prompts/model selection |
| **Autoresearch** | Human: `program.md`, Agent: `train.py`, Evolutionary selection | Human: high-level config, Agent: harness evolution, Generators: experiments |

**The Architecture Principle:**

> The Meta-Harness (Agent Model) evolves separately from the experiments (Generator Models). The harness improves by observing failures, not by fixing outputs directly. Broken outputs feed back into the system, the harness learns, and the next iteration benefits.

---

*This architecture enables Liminal to become self-improving: the more dogfood tests run, the better the harness becomes at selecting models, crafting prompts, and validating outputs.*
