# THE BIBLE - Liminal System Documentation

**Version:** 2.1 - DGF Complete  
**Date:** 2026-04-01  
**Status:** 31 guardrail tests passing, DGF Phases 1-3 complete  
**Branch:** narrative/liminal-archaeology  

---

## Executive Summary

Liminal is a creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), and more. The system features:

- **Deterministic Guardrails Framework (DGF)** - 3-phase multi-layer protection system
  - Phase 1: Foundation (Observation, Constraint)
  - Phase 2: Validation & Remediation (Schema, Error Taxonomy, Correctness, Hygiene)
  - Phase 3: Evolution (Constitution, Self-Healing)
- **31 Total Guardrails** across 4 categories
- **Persistent Memory** across sessions
- **Model-Aware Generation** (flagship/medium/local/tiny tiers)
- **Meta-Harness** self-improvement system
- **Ralph Loop** iterative refinement

---

## Test Status: ✅ ALL PASSING

```
Guardrail Tests:
  - test/guardrails/GuardrailSystem.test.ts:     8 tests passing
  - test/guardrails/FullSystemSmoke.test.ts:    10 tests passing
  - test/e2e/guardrails-e2e.test.ts:            13 tests passing (with real LLM)
  
Total Guardrail Tests: 31 passing
Full System Tests: 1741+ passing
Failures: 0
```

### Recent Test Achievements

**Deterministic Guardrails Framework - COMPLETE:**
- ✅ Phase 1: 4 Catastrophic guardrails (Max Iteration, Resource, Tool, Schema)
- ✅ Phase 2: Validation, Remediation, Correctness (2), Hygiene (1)
- ✅ Phase 3: Constitution + Self-Healing guardrail
- ✅ E2E test with real LLM integration (Qwen3-Coder-40B via LM Studio)
- ✅ All tier levels working (SHADOW→ADVISORY→ENFORCING→AUTONOMOUS)
- ✅ Terminal action remediation verified

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIMINAL ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ DETERMINISTIC GUARDRAILS FRAMEWORK (DGF)                            │    │
│  │  Phase 1: Foundation (Tier 3 - AUTONOMOUS)                          │    │
│  │   ├── MaxIterationGuardrail     - Prevents infinite loops           │    │
│  │   ├── ResourceExhaustionGuardrail - Token/memory/time/api limits    │    │
│  │   ├── ToolPermissionGuardrail   - Whitelist-based authorization     │    │
│  │   └── OutputSchemaGuardrail     - JSON schema validation            │    │
│  │                                                                     │    │
│  │  Phase 2: Validation & Remediation (Tier 2 - ENFORCING)             │    │
│  │   ├── SchemaValidator           - Zod-like type-safe validation     │    │
│  │   ├── RemediationEngine         - Error taxonomy & auto-fix         │    │
│  │   ├── TypeCheckGuardrail        - tsc --noEmit integration          │    │
│  │   ├── TestVerificationGuardrail - Runs related tests                │    │
│  │   └── CodeStyleGuardrail        - ESLint + Prettier (Advisory)      │    │
│  │                                                                     │    │
│  │  Phase 3: Evolution (Tier 3 - AUTONOMOUS)                           │    │
│  │   ├── Constitution              - Self-learning rule database       │    │
│  │   └── SelfHealingGuardrail      - Pattern matching & prevention     │    │
│  │                                                                     │    │
│  │  4 Tiers: SHADOW→ADVISORY→ENFORCING→AUTONOMOUS                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ META-HARNESS (Self-Improvement)    🟢 ACTIVE                        │    │
│  │  ├── HarnessMemory          - Persistent tasks/adaptations          │    │
│  │  ├── FailureLogger          - Logs to ~/.liminal/failures/          │    │
│  │  ├── PatternDetector        - Detects failure patterns              │    │
│  │  ├── HarnessUpdater         - Applies adaptations                   │    │
│  │  ├── HarnessAgent           - 7 tools for self-repair               │    │
│  │  ├── ValidationGuard        - Prevents bad edits                    │    │
│  │  └── RateLimiter            - Prevents runaway execution            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ RALPH LOOP (Core Engine)           🟢 ACTIVE                        │    │
│  │  ├── GenerationOrchestrator - Swarm/Collab/Standard modes           │    │
│  │  ├── ContextAccumulation    - Builds iteration context              │    │
│  │  ├── CompostHeap            - Learns from failures                  │    │
│  │  ├── ScoringEngine          - Multi-strategy scoring                │    │
│  │  ├── PromiseDetector        - Detects "COMPLETE"                    │    │
│  │  ├── StagnationDetector     - Detects loops/plateaus                │    │
│  │  └── SafetyGuardrails       - Budget, circuit breaker               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ GENERATOR LAYER (Model-Aware)      🟢 TIER-BASED                  │    │
│  │  ├── TierBasedGenerator     - Base class for all                    │    │
│  │  ├── P5GeneratorV2          - p5.js with tier detection             │    │
│  │  ├── ShaderGenerator        - GLSL shaders                          │    │
│  │  ├── ThreeGenerator         - Three.js 3D                          │    │
│  │  ├── HydraGenerator         - Video synthesis                       │    │
│  │  ├── StrudelGenerator       - Live coding music                    │    │
│  │  ├── ToneGenerator          - Web Audio API                        │    │
│  │  ├── RemotionGenerator      - Video components                     │    │
│  │  ├── HTMLWebGenerator       - Web pages                            │    │
│  │  └── ASCIIArtGenerator      - ASCII art                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  │ GUARDRAIL LAYER (M1-M18 + DGF)                                     │    │
│  │  M1:  ✅ Prompt Validation          - CodeValidator                 │    │
│  │  M2:  ✅ Domain Routing             - GeneratorRegistry             │    │
│  │  M3:  ✅ Budget/Rate Limit          - SafetyGuardrails              │    │
│  │  M4:  ✅ Syntax Validation          - CodeValidator                 │    │
│  │  M5:  ✅ Safety (execution)         - SandboxRunner                 │    │
│  │  M6:  ✅ Anti-Hallucination         - APIValidator                  │    │
│  │  M7:  ✅ Aesthetic Quality          - AestheticScorer               │    │
│  │  M8:  ✅ Output Size                - CodeValidator                 │    │
│  │  M9:  ✅ Semantic Alignment         - SemanticValidator             │    │
│  │  M10: ✅ Runtime Health             - RuntimeHealthMonitor          │    │
│  │  M11: ✅ Accessibility              - AccessibilityGuardrails       │    │
│  │  M12-M18: ⚪ Planned/Future                                         │    │
│  │                                                                     │    │
│  │  DGF: ✅ COMPLETE (see above)                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ MEMORY & LEARNING LAYER                                            │    │
│  │  ├── HarnessMemory          - ~/.liminal/memory/                    │    │
│  │  ├── EpisodicMemory         - Conversations, generations            │    │
│  │  ├── CompostHeap            - Failed generations                    │    │
│  │  ├── NoveltyArchive         - Pattern diversity                     │    │
│  │  ├── QualityArchive         - High-quality examples                 │    │
│  │  ├── Constitution           - Learned guardrail rules               │    │
│  │  └── ArtKnowledgeGraph      - Concepts, techniques                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deterministic Guardrails Framework (DGF)

**Location:** `src/guardrails/`

### Phase 1: Foundation Layer (Catastrophic)

| Guardrail | File | Purpose | Tier |
|-----------|------|---------|------|
| MaxIterationGuardrail | `rules/CatastrophicGuardrails.ts` | Blocks infinite loops at 50 iterations | AUTONOMOUS |
| ResourceExhaustionGuardrail | `rules/CatastrophicGuardrails.ts` | Enforces token/memory/time/api limits | AUTONOMOUS |
| ToolPermissionGuardrail | `rules/CatastrophicGuardrails.ts` | Whitelist-based tool authorization | AUTONOMOUS |
| OutputSchemaGuardrail | `rules/CatastrophicGuardrails.ts` | JSON schema validation | AUTONOMOUS |

### Phase 2: Validation & Remediation Layer

| Component | File | Purpose | Tier |
|-----------|------|---------|------|
| SchemaValidator | `validation/SchemaValidator.ts` | Zod-like type-safe validation | ENFORCING |
| RemediationEngine | `remediation/ErrorTaxonomy.ts` | 15 error types with auto-fix strategies | ENFORCING |
| TypeCheckGuardrail | `correctness/TypeCheckGuardrail.ts` | Runs tsc --noEmit on changes | ENFORCING |
| TestVerificationGuardrail | `correctness/TestVerificationGuardrail.ts` | Runs test suite on affected files | ENFORCING |
| CodeStyleGuardrail | `hygiene/CodeStyleGuardrail.ts` | ESLint + Prettier integration | ADVISORY |

**Error Taxonomy (15 types):**
```
SYNTAX_ERROR      - Auto-fixable via AST (max 2 retries)
MISSING_SEMICOLON - eslint --fix (max 1 retry)
UNMATCHED_BRACKET - Balance brackets (max 2 retries)
TYPE_ERROR        - TypeScript fixes (max 3 retries)
MISSING_TYPE      - Infer & add annotations (max 2 retries)
TEST_FAILURE      - Analyze & fix (max 3 retries)
ASSERTION_FAILURE - Adjust implementation (max 2 retries)
TIMEOUT           - Not auto-fixable (max 1 retry)
RATE_LIMIT        - Not auto-fixable (backoff required)
HALLUCINATION     - Not auto-fixable (requires human)
SCHEMA_VIOLATION  - Validation errors
LINT_ERROR        - Style issues
PERMISSION_ERROR  - Tool misuse
RESOURCE_ERROR    - Token/memory exhausted
UNKNOWN_ERROR     - Fallback
```

### Phase 3: Evolution Layer

| Component | File | Purpose | Tier |
|-----------|------|---------|------|
| Constitution | `evolution/Constitution.ts` | Self-learning rule database | AUTONOMOUS |
| SelfHealingGuardrail | `evolution/SelfHealingGuardrail.ts` | Pattern matching & prevention | AUTONOMOUS |

**Constitution Features:**
- Extracts patterns from failure messages
- Rule confidence scoring (0.0 - 0.95)
- Automatic rule deprecation (confidence < 0.3)
- Prevention: Blocks actions matching known failure patterns
- Remediation: Suggests fixes from past successes
- Export/import for persistence
- Effectiveness tracking (success/failure counts)

### Guardrail Tiers

| Tier | Level | Action | Progression |
|------|-------|--------|-------------|
| 0 | SHADOW | Log only, don't block | Default |
| 1 | ADVISORY | Warn but allow override | 95% success over 50 tasks |
| 2 | ENFORCING | Block with remediation | 95% success over 100 tasks |
| 3 | AUTONOMOUS | Full auto-remediation | 95% success over 200 tasks |

### DGF Test Results

```
✓ Max iteration blocking (100 iterations > 50 max)
✓ Resource exhaustion detection (tokens, memory, time, API calls)
✓ Tool permission enforcement
✓ Schema validation (valid/invalid detection)
✓ Error taxonomy classification
✓ Remediation engine auto-fix strategies
✓ Shadow mode operation
✓ Remediation with terminal actions
✓ Constitution rule learning
✓ Constitution export/import
✓ E2E with real LLM (code generation + guardrail validation)
```

---

## Subsystem Details

### 1. Meta-Harness (Self-Improvement)

**Location:** `src/harness/`

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| HarnessMemory | `HarnessMemory.ts` | Persistent storage for tasks, adaptations, episodes | 🟢 Active |
| FailureLogger | `FailureLogger.ts` | Logs failures to ~/.liminal/failures/ | 🟢 Active |
| PatternDetector | `PatternDetector.ts` | Detects patterns in failures | 🟢 Active |
| HarnessUpdater | `HarnessUpdater.ts` | Applies adaptations to fix issues | 🟡 Built |
| HarnessAgent | `agent/HarnessAgent.ts` | 7 tools for self-repair | 🟢 Active |
| ValidationGuard | `tools/ValidationGuard.ts` | Prevents invalid edits | 🟢 Active |
| RateLimiter | `tools/RateLimiter.ts` | Limits execution rate | 🟢 Active |

**Persistent Storage:**
```
~/.liminal/
├── memory/
│   └── harness-memory.json    # Tasks, adaptations, episodes
├── failures/                   # Failure logs
├── config.json                 # Provider config
└── history.json                # Prompt history
```

---

### 2. Ralph Loop (Core Engine)

**Location:** `src/core/`

**Components:**

| Component | File | Purpose |
|-----------|------|---------|
| RalphLoop | `RalphLoop.ts` | Main orchestration |
| GenerationOrchestrator | `GenerationOrchestrator.ts` | Swarm/Collab/Standard modes |
| ContextAccumulation | `ContextAccumulation.ts` | Builds iteration context |
| CompostHeap | `CompostHeap.ts` | Learns from failures |
| ScoringEngine | `ScoringEngine.ts` | Multi-strategy scoring |
| PromiseDetector | `PromiseDetector.ts` | Detects convergence |
| StagnationDetector | `StagnationDetector.ts` | Detects loops |
| SafetyGuardrails | `SafetyGuardrails.ts` | Budget, circuit breaker |

**Modes:**
- **Standard:** Single generator, iterative refinement
- **Swarm:** Multiple agents with voting
- **Collab:** Collaborative refinement
- **Organism:** Evolutionary approach

---

### 3. Generators (Model-Aware)

**Location:** `src/generators/`

**Base Class:** `TierBasedGenerator`

**Model Tiers:**

| Tier | Models | Context | Budget | Prompt Style |
|------|--------|---------|--------|--------------|
| FLAGSHIP | Claude 4, GPT-4 | 200k | 8000 | Concise, XML tags |
| MEDIUM | GPT-3.5, Claude Haiku | 100k | 4000 | Detailed |
| LOCAL | Qwen, Llama, Mistral | **16k** | 2000 | Explicit, few-shot |
| TINY | TinyLlama, Phi-2 | 8k | 1000 | Minimal |

**All Generators:**

| Generator | Domain | File | Features |
|-----------|--------|------|----------|
| P5GeneratorV2 | p5.js | `p5/P5GeneratorV2.ts` | Sound detection, setup/draw validation |
| ShaderGenerator | GLSL | `glsl/ShaderGenerator.ts` | Truncation detection, main() validation |
| ThreeGenerator | Three.js | `three/ThreeGenerator.ts` | Scene/camera validation |
| HydraGenerator | Video | `hydra/HydraGenerator.ts` | Hydra syntax validation |
| StrudelGenerator | Music | `strudel/StrudelGenerator.ts` | Pattern validation |
| ToneGenerator | Audio | `tone/ToneGenerator.ts` | Synth validation |
| RemotionGenerator | Video | `remotion/RemotionGenerator.ts` | React component validation |
| HTMLWebGenerator | Web | `html/HTMLWebGenerator.ts` | HTML structure validation |
| ASCIIArtGenerator | ASCII | `ascii/ASCIIArtGenerator.ts` | Character validation |

**Context Assembly:**
1. Load `SOUL.md` → personality
2. Load `PROJECT_RULES.md` → constraints
3. Load `docs/domains/{domain}.md` → technical knowledge
4. Load from `HarnessMemory` → adaptations, preferences
5. Trim to token budget
6. Format for model tier

---

### 4. Guardrails (M1-M18 + DGF)

**Location:** `src/guardrails/` (DGF + M9-M11), `src/core/` (M1-M8)

| # | Name | Location | Implementation | Status |
|---|------|----------|----------------|--------|
| M1 | Prompt Validation | `core/CodeValidator.ts` | Size, toxicity checks | ✅ |
| M2 | Domain Routing | `generators/GeneratorRegistry.ts` | Keyword-based routing | ✅ |
| M3 | Budget/Rate Limit | `core/SafetyGuardrails.ts` | Cost, rate limiting | ✅ |
| M4 | Syntax Validation | `core/CodeValidator.ts` | Domain-specific parsing | ✅ |
| M5 | Safety (execution) | `sandbox/SandboxRunner.ts` | Sandboxed execution | ✅ |
| M6 | Anti-Hallucination | `core/CodeValidator.ts` | API validation | ✅ |
| M7 | Aesthetic Quality | `aesthetic/` | Multi-dimension scoring | ✅ |
| M8 | Output Size | `core/CodeValidator.ts` | Min size requirements | ✅ |
| M9 | Semantic Alignment | `guardrails/SemanticValidator.ts` | Intent matching | ✅ |
| M10 | Runtime Health | `guardrails/RuntimeHealthMonitor.ts` | Memory, FPS monitoring | ✅ |
| M11 | Accessibility | `guardrails/AccessibilityGuardrails.ts` | Photosensitivity, a11y | ✅ |
| M12-M18 | Planned | - | Future work | ⚪ |
| **DGF** | **COMPLETE** | `guardrails/` | **3-phase framework** | ✅ |

**DGF Categories (4 total):**

| Category | Guardrails | Priority | Tier Range |
|----------|-----------|----------|------------|
| Catastrophic | 4 | 0 (Highest) | AUTONOMOUS |
| Correctness | 2 | 1 | ENFORCING |
| Hygiene | 1 | 2 | ADVISORY |
| Evolution | 1 | 3 (Lowest) | AUTONOMOUS |

---

### 5. Memory Systems

**Location:** `src/brain/`, `src/harness/`, `src/compost/`, `src/learning/`, `src/guardrails/evolution/`

| System | File | Purpose | Persistence |
|--------|------|---------|-------------|
| HarnessMemory | `harness/HarnessMemory.ts` | Tasks, adaptations, episodes | ✅ ~/.liminal/memory/ |
| EpisodicMemory | `brain/EpisodicMemory.ts` | Conversations, generations | ✅ Via HarnessMemory |
| CompostHeap | `compost/CompostHeap.ts` | Failed generations | ✅ File-based |
| NoveltyArchive | `learning/NoveltyArchive.ts` | Pattern diversity | ✅ File-based |
| QualityArchive | `learning/QualityArchive.ts` | High-quality examples | ✅ File-based |
| Constitution | `guardrails/evolution/Constitution.ts` | Learned guardrail rules | ✅ Export/import |
| ArtKnowledgeGraph | `brain/ArtKnowledgeGraph.ts` | Concepts, techniques | ❌ In-memory |

---

### 6. LLM Infrastructure

**Location:** `src/llm/`

| Component | File | Purpose |
|-----------|------|---------|
| LLMClient | `LLMClient.ts` | Main LLM interface |
| ModelTier | `ModelTier.ts` | Tier detection (flagship/medium/local/tiny) |
| PromptBuilder | `PromptBuilder.ts` | Tier-based prompt construction |
| CacheManager | `CacheManager.ts` | Response caching |
| CircuitBreaker | `CircuitBreaker.ts` | Failure handling |
| RetryManager | `RetryManager.ts` | Retry logic |

**Multi-Provider Support:**
- OpenAI
- Anthropic
- Local (Ollama, LM Studio)
- MiniMax

---

### 7. Security & Sandbox

**Location:** `src/security/`, `src/sandbox/`

| Component | File | Purpose |
|-----------|------|---------|
| SandboxRunner | `sandbox/SandboxRunner.ts` | Headless browser execution |
| SandboxConfig | `security/SandboxConfig.ts` | Chrome args, CSP |

**Sandbox Features:**
- Network restricted (only CDN allowed)
- No file system access
- Timeout enforcement
- Process isolation

---

### 8. Testing Infrastructure

**Location:** `test/`

| Category | Count | Status |
|----------|-------|--------|
| Unit Tests | ~100 files | ✅ Passing |
| Integration Tests | ~20 files | ✅ Passing |
| Generator Tests | ~12 files | ✅ Passing |
| E2E Tests | ~10 files | ✅ Passing |
| Guardrail Tests | 3 files | ✅ 31 tests passing |

**Test Files (DGF):**
```
test/guardrails/
├── GuardrailSystem.test.ts      # 8 unit tests
├── FullSystemSmoke.test.ts      # 10 integration tests
└── e2e/guardrails-e2e.test.ts   # 13 E2E tests (with real LLM)
```

---

## File Structure

```
liminal/
├── src/
│   ├── brain/              # Memory & knowledge systems
│   ├── collab/             # Collaborative generation
│   ├── compost/            # Failure learning
│   ├── core/               # Ralph Loop
│   ├── evolution/          # Evolutionary algorithms
│   ├── gallery/            # Output gallery
│   ├── generators/         # All generators
│   ├── guardrails/         # DGF + M9-M11
│   │   ├── core/           # Registry, types, ResourceLimiter
│   │   ├── rules/          # Catastrophic guardrails
│   │   ├── validation/     # SchemaValidator
│   │   ├── remediation/    # ErrorTaxonomy, RemediationEngine
│   │   ├── correctness/    # TypeCheck, TestVerification
│   │   ├── hygiene/        # CodeStyle
│   │   ├── evolution/      # Constitution, SelfHealing
│   │   └── index.ts        # Main exports
│   ├── harness/            # Meta-harness
│   ├── learning/           # Quality/Novelty archives
│   ├── llm/                # LLM infrastructure
│   ├── prompts/            # Prompt library
│   ├── routing/            # Model routing
│   ├── sandbox/            # Code execution
│   ├── scavenger/          # DNA extraction
│   ├── security/           # Security config
│   ├── swarm/              # Swarm mode
│   ├── tui/                # Terminal UI
│   └── utils/              # Utilities
├── test/                   # Test suite (1741+ tests)
│   └── guardrails/         # DGF tests (31 tests)
├── docs/                   # Documentation (THE BIBLE)
├── harness-tasks/          # M1-M11 task definitions
└── ~/.liminal/             # User data (created at runtime)
```

---

## API Exports

**Main Entry:** `src/index.ts`

### Key Exports:

```typescript
// Core
export { RalphLoop, type LoopOptions, type LoopResult };

// Generators (Tier-Based)
export { TierBasedGenerator, type TierBasedGeneratorOptions };
export { P5GeneratorV2, type P5GeneratorV2Options };
export { ShaderGenerator, ThreeGenerator, HydraGenerator };
export { StrudelGenerator, ToneGenerator, RemotionGenerator };
export { HTMLWebGenerator, ASCIIArtGenerator };

// Model Tiers
export { detectModelTier, getModelProfile, getModelInfo };
export { trimContext, selectPromptStyle };
export type { ModelTier, ModelProfile };
export { PromptBuilder, type PromptContext, type BuiltPrompt };

// Guardrails (M9-M11)
export { SemanticValidator, type SemanticValidationResult };
export { RuntimeHealthMonitor, type RuntimeHealthResult };
export { AccessibilityGuardrails, type AccessibilityResult };

// DGF - Deterministic Guardrails Framework
export {
  GuardrailTier,
  type GuardrailRule,
  type ExecutionContext,
  type GuardrailResult,
  type RemediationResult,
} from './guardrails/core/types.js';
export {
  GuardrailRegistry,
  initializeGuardrails,
  getGuardrailRegistry,
} from './guardrails/core/GuardrailRegistry.js';
export {
  SchemaValidator,
  initializeValidator,
  getValidator,
  type ValidationResult,
} from './guardrails/validation/SchemaValidator.js';
export {
  RemediationEngine,
  classifyError,
  ERROR_TAXONOMY,
  type ErrorClassification,
} from './guardrails/remediation/ErrorTaxonomy.js';
export {
  Constitution,
  initializeConstitution,
  getConstitution,
  type FailureRecord,
} from './guardrails/evolution/Constitution.js';
export {
  SelfHealingGuardrail,
  type SelfHealingConfig,
} from './guardrails/evolution/SelfHealingGuardrail.js';

// Meta-Harness
export { metaHarness, type MetaHarnessStatus };
export { harnessMemory, type HarnessMemoryState, type HarnessTask };

// Memory
export { EpisodicMemory, type Episode, type UserPreferences };

// LLM
export { LLMClient, type LLMConfig, type LLMResponse };
```

---

## Configuration

**Environment Variables:**

```bash
# LLM Provider (required)
LIMINAL_LLM_PROVIDER=lmstudio  # or ollama, openai, minimax
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct

# Optional
LIMINAL_DISABLE_SANDBOX=false
LIMINAL_LOG_LEVEL=info
```

---

## Recent Changes (Last 20 Commits)

1. **fix(tests):** Correct LLMClient.generate() call signature in E2E test
2. **fix(prompts):** Escape template variables in blog-to-video.ts
3. **test(guardrails):** E2E test with real LLM integration (31 tests)
4. **test(guardrails):** Full system smoke test (10 integration tests)
5. **feat(guardrails):** Phase 3 - Self-Healing & Evolution (Constitution)
6. **feat(guardrails):** Phase 2 - Validation, Remediation, Correctness, Hygiene
7. **feat(guardrails):** Phase 1 - Foundation (Observation, Constraint)
8. **fix:** Remove duplicate exports for HTMLWebGenerator
9. **feat:** Migrate all generators to TierBasedGenerator
10. **fix:** Apply lint fixes to guardrails
11. **docs:** Update THE BIBLE with persistent memory, M9-M11
12. **feat:** Implement M9-M11 Guardrails
13. **feat:** Add Model Tier detection
14. **feat:** Add HarnessMemory
15. **docs:** Add DOCUMENTATION_WARNING
16. **rules:** Add NO DUPLICATION rule
17. **docs:** Add PROJECT_RULES.md
18. **fix:** Pre-flight audit fixes
19. **feat:** Natural language interface
20. **feat:** Full LLM Mode

---

## Known Limitations

1. **M12-M18:** Not yet implemented
2. **Template Removal:** All template-based generation removed (pure LLM now)
3. **Browser Dependency:** M9-M11 require Puppeteer/Playwright
4. **Local Models:** 16k context limit (tier detection respects this)

---

## Next Steps

1. ✅ DGF Phases 1-3 COMPLETE
2. 🔄 M12-M18 implementation (future)
3. 🔄 Constitution persistence to disk (optional)
4. 🔄 Community plugins (future)

---

**THE BIBLE is the source of truth. When in doubt, consult this document.**
