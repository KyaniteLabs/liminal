# RalphLoop Decomposition Plan

## Current State

**File:** `src/core/RalphLoop.ts`
**Lines:** 1,588
**Imports:** 45 modules
**Status:** Working, tested, high coupling

RalphLoop is the main creative loop. It works correctly but carries too many responsibilities in a single file. Any change to scoring, evaluation, aesthetics, harness, git, evolution, or compost risks touching the core loop.

---

## Responsibility Map

RalphLoop currently handles these distinct concerns:

### 1. Generation (core loop)
- Prompt construction, LLM calls, code generation
- Context building, prompt enhancement
- **Imports:** LLMClient, PromptStore, ContextBuilder, ContextAccumulation, PromptEnhancer, AmbiguityDetector, PromiseDetector

### 2. Evaluation & Scoring
- Quality scoring, evaluation criteria, creative evaluation
- Multi-candidate evaluation, repair advice
- **Imports:** ScoringEngine, CodeValidator, GenerationEvaluation types

### 3. Aesthetic Gate
- Aesthetic quality checks before acceptance
- AestheticModel integration
- **Imports:** aesthetic/types, evolution/AestheticModel

### 4. Compost & Digestion
- Feeding artifacts to compost, heap management
- Digestion triggers, compost mill coordination
- **Imports:** CompostMill, CompostHeap, compost/defaults

### 5. Evolution & Learning
- Evolution engine coordination, learning feedback
- Taste model updates, preference signals
- **Imports:** evolution/EvolutionEngine, EvolutionIntegration, learning/*

### 6. Harness & Tools
- Harness integration, tool execution, meta-harness
- Generator tools, multi-provider routing
- **Imports:** MetaHarnessIntegration, GeneratorHarnessTools, RoutingData

### 7. Persistence & I/O
- Git operations, filesystem writes, loop state persistence
- Gallery updates, LIR parsing
- **Imports:** GitIntegration, LiminalFS, LoopPersistence, gallery/Gallery, lir/GeneratedCodeParser

### 8. Safety & Guardrails
- Safety checks, stagnation detection
- Feature flag gates
- **Imports:** SafetyGuardrails, StagnationDetector, SuccessRateTracker, FeatureFlags

### 9. Event Bus
- Event emission for telemetry and observation
- **Imports:** EventBus

### 10. Entropy & Metabolism
- Metabolic entropy engine, resource accounting
- **Imports:** entropy/MetabolicEntropyEngine, entropy/types

---

## Recommended Decomposition

### Phase A: Extract Sub-Orchestrators (lowest risk)

Create thin coordinator classes that RalphLoop delegates to. RalphLoop keeps its shape but shrinks.

```
src/core/ralph/
  RalphGenerationPhase.ts    — #1 + #2 (generate, evaluate, score)
  RalphAestheticGate.ts       — #3 (aesthetic checks)
  RalphCompostPhase.ts        — #4 (compost feeding/digestion)
  RalphEvolutionPhase.ts      — #5 (evolution + learning feedback)
  RalphPersistencePhase.ts    — #7 (git, fs, gallery, LIR)
  RalphSafetyPhase.ts         — #8 + #10 (safety, stagnation, entropy)
```

RalphLoop becomes a coordinator:
```typescript
class RalphLoop {
  constructor(
    private generation: RalphGenerationPhase,
    private aesthetic: RalphAestheticGate,
    private compost: RalphCompostPhase,
    private evolution: RalphEvolutionPhase,
    private persistence: RalphPersistencePhase,
    private safety: RalphSafetyPhase,
  ) {}

  async run(): Promise<RalphResult> {
    // High-level orchestration only
    const generated = await this.generation.execute(context);
    if (!this.aesthetic.check(generated)) return this.generation.repair(generated);
    await this.compost.feed(generated);
    await this.evolution.learn(generated);
    await this.persistence.save(generated);
    this.safety.track(generated);
  }
}
```

### Phase B: Narrow RalphLoop's Imports

After Phase A, RalphLoop imports ~10 modules (the sub-orchestrators + config + event bus) instead of 45.

### Phase C: Enable Independent Testing

Each phase can be tested in isolation without mocking 45 modules. Tests become faster and more focused.

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking the main loop | Phase A preserves RalphLoop's interface. Only internal delegation changes. |
| Performance regression | Sub-orchestrator calls are synchronous method calls. Zero overhead. |
| Test coverage drops | Extract tests alongside code. Each phase gets its own test file. |
| Merge conflicts | Do extraction in a dedicated branch. Other dev can continue on main. |

## When to Execute

- **Trigger:** When RalphLoop needs modification for a new feature (e.g., wiring guardrails, garden integration)
- **Not yet:** The loop works. Don't refactor without a driving need.

---

## Current Import Dependency Graph

```
RalphLoop (45 imports)
├── Generation: LLMClient, PromptStore, ContextBuilder, ContextAccumulation,
│               PromptEnhancer, AmbiguityDetector, PromiseDetector,
│               GenerationOrchestrator, OrganismLoop
├── Evaluation: ScoringEngine, CodeValidator, GenerationEvaluation types
├── Aesthetic:  aesthetic/types, AestheticModel
├── Compost:    CompostMill, CompostHeap, compost/defaults
├── Evolution:  EvolutionEngine, EvolutionIntegration, learning/*
├── Harness:    MetaHarnessIntegration, GeneratorHarnessTools, RoutingData
├── Persistence: GitIntegration, LiminalFS, LoopPersistence, Gallery,
│                GeneratedCodeParser
├── Safety:     SafetyGuardrails, StagnationDetector, SuccessRateTracker,
│               FeatureFlags
├── Events:     EventBus
├── Entropy:    MetabolicEntropyEngine, entropy/types
├── Config:     LoopConfig
├── Utils:      Logger, env, errors, LLMGenerationError, domains, providers
└── External:   node:path
```
