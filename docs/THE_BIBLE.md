# THE BIBLE - Liminal System Documentation

**Version:** 2.1 - DGF Complete
**Date:** 2026-04-01
**Status:** 31 guardrail tests passing, DGF Phases 1-3 complete
**Branch:** narrative/liminal-archaeology

---

## Executive Summary

Liminal is a creative coding agent with self-improving capabilities. It generates
p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video
(Remotion/Hydra), and more. The system features **19 major subsystems**:

### Core Framework
- **Deterministic Guardrails Framework (DGF)** - 3-phase multi-layer protection
  - Phase 1: Foundation (4 catastrophic guardrails)
  - Phase 2: Validation & Remediation (5 components, 15 error types)
  - Phase 3: Evolution (Constitution, Self-Healing)
- **31 Total Guardrails** across 4 categories, 4 tiers
- **M1-M11 Complete** - Traditional guardrails + DGF

### Generation & Creation
- **9 Generators** - p5.js, GLSL, Three.js, Hydra, Strudel, Tone, Remotion, HTML,
  ASCII
- **Tier-Based Generation** - Model-aware prompts (flagship/medium/local/tiny)
- **Swarm System** - Multi-agent generation with voting

### User Interface
- **TUI (Terminal UI)** - Hybrid terminal + browser interface
- **Natural Interface** - Natural language command routing
- **Chat System** - Conversational creative collaboration
- **SOUL System** - User-editable AI personality

### Learning & Memory
- **Thinking-Trace Feedback Loop** - Meta-learning from LLM reasoning traces (ALL 9 generators)
  - Captures generator `<think>` tags and reasoning fields
  - Harness analyzes with: "WHERE DID IT GO WRONG?" / "HOW CAN I COMMUNICATE BETTER?"
  - Generator thinking and harness thinking kept separate
  - Real-time adaptation based on model reasoning patterns
- **Meta-Harness** - Self-improvement system (7 tools)
- **Ralph Loop** - Iterative refinement engine
- **Compost System** - Failure learning (Mill, Shredder, Soup)
- **Memory Systems** - HarnessMemory, EpisodicMemory, 5+ archives

### Quality & Intelligence
- **Aesthetic System** - Multi-dimension quality evaluation (M7)
- **Routing System** - Smart model and task routing
- **Scavenger System** - DNA extraction from code

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
┌────────────────────────────────┐
│    LIMINAL ARCHITECTURE            │
├────────────────────────────────┤
│                                    │
│  ┌────────────────────────┐        │
│  │ DETERMINISTIC GUARDRAILS FRAMEWORK (DGF)                            │  │
│ Phase 1: Foundation (Tier 3 - AUTONOMOUS)                          │  │
│  ├── MaxIterationGuardrail     - Prevents infinite loops           │  │
│  ├── ResourceExhaustionGuardrail - Token/memory/time/api limits    │  │
│  ├── ToolPermissionGuardrail   - Whitelist-based authorization     │  │
│  └── OutputSchemaGuardrail     - JSON schema validation            │  │
│                                                                    │  │
│ Phase 2: Validation & Remediation (Tier 2 - ENFORCING)             │  │
│  ├── SchemaValidator           - Zod-like type-safe validation     │  │
│  ├── RemediationEngine         - Error taxonomy & auto-fix         │  │
│  ├── TypeCheckGuardrail        - tsc --noEmit integration          │  │
│  ├── TestVerificationGuardrail - Runs related tests                │  │
│  └── CodeStyleGuardrail        - ESLint + Prettier (Advisory)      │  │
│                                                                    │  │
│ Phase 3: Evolution (Tier 3 - AUTONOMOUS)                           │  │
│  ├── Constitution              - Self-learning rule database       │  │
│  └── SelfHealingGuardrail      - Pattern matching & prevention     │  │
│                                                                    │  │
│ 4 Tiers: SHADOW→ADVISORY→ENFORCING→AUTONOMOUS                      │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ META-HARNESS (Self-Improvement)    🟢 ACTIVE                        │  │
│  ├─ HarnessMemory          - Persistent tasks/adaptations          │  │
│  ├─ FailureLogger          - Logs to ~/.liminal/failures/          │  │
│  ├─ PatternDetector        - Detects failure patterns              │  │
│  ├─ HarnessUpdater         - Applies adaptations                   │  │
│  ├─ HarnessAgent           - 7 tools for self-repair               │  │
│  ├─ ValidationGuard        - Prevents bad edits                    │  │
│ └── RateLimiter            - Prevents runaway execution            │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ RALPH LOOP (Core Engine)           🟢 ACTIVE                        │  │
│  ├─ GenerationOrchestrator - Swarm/Collab/Standard modes           │  │
│  ├─ ContextAccumulation    - Builds iteration context              │  │
│  ├─ CompostHeap            - Learns from failures                  │  │
│  ├─ ScoringEngine          - Multi-strategy scoring                │  │
│  ├─ PromiseDetector        - Detects "COMPLETE"                    │  │
│  ├─ StagnationDetector     - Detects loops/plateaus                │  │
│ └── SafetyGuardrails       - Budget, circuit breaker               │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ USER INTERFACE LAYER               🟢 ACTIVE                        │  │
│ TUI (Terminal UI):                                                 │  │
│  ├── HarnessTUI            - Main TUI orchestration                │  │
│  ├── NaturalInterface      - Natural language commands             │  │
│  └── InteractiveMode       - REPL-style interaction                │  │
│ Chat System:                                                       │  │
│  ├── ChatCLI               - Conversational interface              │  │
│  ├── ConversationManager   - State management                      │  │
│  └── GuidanceEngine        - Conversation guidance                 │  │
│ SOUL System:                                                       │  │
│  └── SOUL.md               - User-editable personality             │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ GENERATOR LAYER (Model-Aware)      🟢 TIER-BASED                  │  │
│  ├─ TierBasedGenerator     - Base class for all                    │  │
│  ├─ P5GeneratorV2          - p5.js with tier detection             │  │
│  ├─ ShaderGenerator        - GLSL shaders                          │  │
│  ├─ ThreeGenerator         - Three.js 3D                          │  │
│  ├─ HydraGenerator         - Video synthesis                       │  │
│  ├─ StrudelGenerator       - Live coding music                    │  │
│  ├─ ToneGenerator          - Web Audio API                        │  │
│  ├─ RemotionGenerator      - Video components                     │  │
│  ├─ HTMLWebGenerator       - Web pages                            │  │
│ └── ASCIIArtGenerator      - ASCII art                            │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ AESTHETIC & QUALITY LAYER          🟢 ACTIVE                        │  │
│  ├─ AestheticCritic        - Multi-dimension scoring               │  │
│  ├─ ColorExtractor         - Palette analysis                      │  │
│ └── ColorTheoryEngine      - Harmony evaluation                    │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ SWARM & COLLABORATION LAYER        🟢 ACTIVE                        │  │
│  ├─ SwarmOrchestrator      - Multi-agent coordination              │  │
│  ├─ VotingEngine           - Consensus mechanism                   │  │
│ └── MiningEngine           - Fragment extraction                   │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ COMPOST SYSTEM (Failure Learning)  🟢 ACTIVE                        │  │
│  ├─ CompostMill            - Processing orchestrator               │  │
│  ├─ CompostShredder        - Fragment extraction                   │  │
│  ├─ CompostSoup            - Blended synthesis                     │  │
│  ├─ CollisionEngine        - Fragment combination                  │  │
│ └── SeedBank               - Reusable code seeds                   │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ ROUTING & INTELLIGENCE             🟢 ACTIVE                        │  │
│  ├─ SmartRouter            - Intelligent routing                   │  │
│  ├─ QualityPredictor       - Output quality prediction             │  │
│ └── IntentRouter           - Command intent routing                │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  │ GUARDRAIL LAYER (M1-M18 + DGF)                                     │  │
│ M1:  ✅ Prompt Validation          - CodeValidator                 │  │
│ M2:  ✅ Domain Routing             - GeneratorRegistry             │  │
│ M3:  ✅ Budget/Rate Limit          - SafetyGuardrails              │  │
│ M4:  ✅ Syntax Validation          - CodeValidator                 │  │
│ M5:  ✅ Safety (execution)         - SandboxRunner                 │  │
│ M6:  ✅ Anti-Hallucination         - APIValidator                  │  │
│ M7:  ✅ Aesthetic Quality          - AestheticCritic               │  │
│ M8:  ✅ Output Size                - CodeValidator                 │  │
│ M9:  ✅ Semantic Alignment         - SemanticValidator             │  │
│ M10: ✅ Runtime Health             - RuntimeHealthMonitor          │  │
│ M11: ✅ Accessibility              - AccessibilityGuardrails       │  │
│ M12: 📝 Privacy Guardrail          - PII filter, data anonymizer   │  │
│ M13: 📝 Prompt Injection Defense   - Jailbreak detection           │  │
│ M14: 📝 Supply Chain Guardrail     - Dependency audit, SBOM        │  │
│ M15: 📝 Audit & Compliance         - Non-repudiation logging       │  │
│ M16: 📝 Fairness & Bias            - Output diversity checks       │  │
│ M17: 📝 Explainability             - Decision tracing, attribution  │  │
│ M18: 📝 Resilience                 - Circuit breakers, fallbacks    │  │
│                                                                    │  │
│ DGF: ✅ COMPLETE (see above)                                       │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ MEMORY & LEARNING LAYER            🟢 ACTIVE                        │  │
│  ├─ HarnessMemory          - ~/.liminal/memory/                    │  │
│  ├─ EpisodicMemory         - Conversations, generations            │  │
│  ├─ CompostHeap            - Failed generations                    │  │
│  ├─ NoveltyArchive         - Pattern diversity                     │  │
│  ├─ QualityArchive         - High-quality examples                 │  │
│  ├─ Constitution           - Learned guardrail rules               │  │
│ └── ArtKnowledgeGraph      - Concepts, techniques                  │  │
│  └────────────────────────┘        │
│                                    ↓                                         │
│  ┌────────────────────────┐        │
│  │ EXTENSIBILITY                      🟡 PLANNED                       │  │
│  ├─ PluginLoader           - Dynamic plugin loading                │  │
│ └── HookSystem             - Lifecycle hooks                       │  │
│  └────────────────────────┘        │
│                                    │
└────────────────────────────────┘
```

---

## Deterministic Guardrails Framework (DGF)

**Location:** `src/guardrails/`

### Phase 1: Foundation Layer (Catastrophic)

| Guardrail | File | Purpose | Tier |
|-----------|------|---------|------|
| MaxIterationGuardrail | `rules/CatastrophicGuardrails.ts` | Blocks loops | AUTONOMOUS |
| ResourceExhaustionGuardrail | `rules/CatastrophicGuardrails.ts` | Resource limits | AUTONOMOUS |
| ToolPermissionGuardrail | `rules/CatastrophicGuardrails.ts` | Auth whitelist | AUTONOMOUS |
| OutputSchemaGuardrail | `rules/CatastrophicGuardrails.ts` | JSON schema validation | AUTONOMOUS |

### Phase 2: Validation & Remediation Layer

| Component | File | Purpose | Tier |
|-----------|------|---------|------|
| SchemaValidator | `validation/SchemaValidator.ts` | Zod-like type-safe validation | ENFORCING |
| RemediationEngine | `remediation/ErrorTaxonomy.ts` | 15 error types, auto-fix | ENFORCING |
| TypeCheckGuardrail | `correctness/TypeCheckGuardrail.ts` | TypeScript check | ENFORCING |
| TestVerificationGuardrail | `correctness/TestVerificationGuardrail.ts` | Test runner | ENFORCING |
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
| SelfHealingGuardrail | `evolution/SelfHealingGuardrail.ts` | Pattern prevention | AUTONOMOUS |

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
| HarnessMemory | `HarnessMemory.ts` | Task storage | 🟢 Active |
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
| M12 | Privacy Guardrail | `guardrails/PrivacyGuardrail.ts` | PII detection, anonymization | 📝 |
| M13 | Prompt Injection Defense | `guardrails/InjectionGuardrail.ts` | Jailbreak, prompt leak detection | 📝 |
| M14 | Supply Chain Guardrail | `guardrails/SupplyChainGuardrail.ts` | Dependency audit, SBOM gen | 📝 |
| M15 | Audit & Compliance | `guardrails/AuditGuardrail.ts` | Non-repudiation logging | 📝 |
| M16 | Fairness & Bias | `guardrails/FairnessGuardrail.ts` | Output diversity, bias metrics | 📝 |
| M17 | Explainability | `guardrails/ExplainabilityGuardrail.ts` | Decision tracing, attribution | 📝 |
| M18 | Resilience | `guardrails/ResilienceGuardrail.ts` | Circuit breakers, graceful deg | 📝 |
| **DGF** | **COMPLETE** | `guardrails/` | **3-phase framework** | ✅ |

**DGF Categories (4 total):**

| Category | Guardrails | Priority | Tier Range |
|----------|-----------|----------|------------|
| Catastrophic | 4 | 0 (Highest) | AUTONOMOUS |
| Correctness | 2 | 1 | ENFORCING |
| Hygiene | 1 | 2 | ADVISORY |
| Evolution | 1 | 3 (Lowest) | AUTONOMOUS |

---

### M12-M18 Guardrail Specifications

**Status:** 📝 Designed, Not Implemented
**Priority:** Post-DGF (after core framework stabilization)

| Guardrail | Purpose | Key Components | Tier |
|-----------|---------|----------------|------|
| **M12: Privacy** | Prevent PII leakage in prompts/outputs | `PIIDetector`, `Anonymizer`, `DataClassifier` | ENFORCING |
| **M13: Prompt Injection** | Detect jailbreaks and prompt leaks | `JailbreakDetector`, `PromptLeakDetector` | AUTONOMOUS |
| **M14: Supply Chain** | Audit dependencies, generate SBOM | `DependencyAuditor`, `SbomGenerator`, `VulnScanner` | ADVISORY |
| **M15: Audit & Compliance** | Non-repudiable operation logs | `AuditLogger`, `ComplianceReporter`, `LogChain` | ENFORCING |
| **M16: Fairness & Bias** | Ensure output diversity, measure bias | `DiversityChecker`, `BiasMetrics`, `FairnessReporter` | ADVISORY |
| **M17: Explainability** | Trace decisions, attribute outputs | `DecisionTracer`, `AttributionEngine` | SHADOW |
| **M18: Resilience** | Circuit breakers, graceful degradation | `CircuitBreaker`, `FallbackHandler`, `DegradationManager` | AUTONOMOUS |

**Implementation Notes:**
- M12-M13 are **critical** for production deployments with user data
- M14 requires integration with `npm audit` and OSV database
- M15 needs append-only, cryptographically signed logs
- M16-M17 are **research features** for bias/interpretability studies
- M18 overlaps with DGF Catastrophic guardrails (shared circuit breaker)

---

### 5. Memory Systems

**Location:** Multiple - `src/brain/`, `src/harness/`, `src/compost/`, `src/learning/`, etc.

| System | File | Purpose | Persistence |
|--------|------|---------|-------------|
| HarnessMemory | `harness/HarnessMemory.ts` | Tasks, episodes | ✅ ~/.liminal/memory/ |
| EpisodicMemory | `brain/EpisodicMemory.ts` | Conversations, generations | ✅ Via HarnessMemory |
| CompostHeap | `compost/CompostHeap.ts` | Failed generations | ✅ File-based |
| NoveltyArchive | `learning/NoveltyArchive.ts` | Pattern diversity | ✅ File-based |
| QualityArchive | `learning/QualityArchive.ts` | High-quality examples | ✅ File-based |
| Constitution | `guardrails/evolution/Constitution.ts` | Learned rules | ✅ Export/import |
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

### 9. TUI (Terminal User Interface)

**Location:** `src/tui/`

**Purpose:** Hybrid terminal + browser interface for Liminal. Primary user interaction surface.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| HarnessTUI | `HarnessTUI.tsx` | Main TUI orchestration | 🟢 Active |
| NaturalInterface | `NaturalInterface.ts` | Routes natural language commands | 🟢 Active |
| InteractiveMode | `InteractiveMode.ts` | REPL-style interaction | 🟢 Active |
| StdinValidator | `StdinValidator.ts` | Input validation | 🟢 Active |
| IntentRouter | `IntentRouter.ts` | Intent-based command routing | 🟢 Active |
| Commands | `commands.ts` | TUI command definitions | 🟢 Active |

**Features:**
- Real-time preview window
- Natural language commands (no prefixes required)
- Intent routing without explicit command syntax
- Project-aware context
- Model status display

---

### 10. Chat System

**Location:** `src/chat/`

**Purpose:** Conversational interface for creative collaboration.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| ChatCLI | `ChatCLI.tsx` | Chat interface | 🟢 Active |
| ConversationManager | `ConversationManager.ts` | State management | 🟢 Active |
| GuidanceEngine | `GuidanceEngine.ts` | Conversation guidance | 🟢 Active |
| InterviewPhase | `InterviewPhase.ts` | Onboarding flow | 🟢 Active |
| CreativeBrief | `CreativeBrief.ts` | Project briefing | 🟢 Active |

**Features:**
- Multi-turn conversations
- Context preservation across sessions
- Guided creative brief creation
- Interview-based project setup

---

### 11. Swarm System

**Location:** `src/swarm/`

**Purpose:** Multi-agent generation with voting/consensus.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| SwarmOrchestrator | `SwarmOrchestrator.ts` | Multi-agent coordination | 🟢 Active |
| VotingEngine | `VotingEngine.ts` | Result voting/consensus | 🟢 Active |
| MiningEngine | `MiningEngine.ts` | Code fragment extraction | 🟢 Active |
| HeuristicScorer | `HeuristicScorer.ts` | Quality heuristics | 🟢 Active |
| Personas | `personas.ts` | Agent personality definitions | 🟢 Active |

**Features:**
- Multiple model agents working in parallel
- Voting-based result selection
- Persona-based agent differentiation
- Quality-based mining of good fragments

---

### 12. Compost System

**Location:** `src/compost/`

**Purpose:** Learn from failed generations by extracting reusable fragments.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| CompostMill | `CompostMill.ts` | Main processing orchestrator | 🟢 Active |
| CompostHeap | `CompostHeap.ts` | Failed generation storage | 🟢 Active |
| CompostShredder | `CompostShredder.ts` | Fragment extraction | 🟢 Active |
| CompostSoup | `CompostSoup.ts` | Blended fragment synthesis | 🟢 Active |
| CollisionEngine | `CollisionEngine.ts` | Fragment combination | 🟢 Active |
| FragmentScorer | `FragmentScorer.ts` | Quality scoring | 🟢 Active |
| SemanticExtractor | `SemanticExtractor.ts` | Meaning extraction | 🟢 Active |
| MetadataExtractor | `MetadataExtractor.ts` | Property extraction | 🟢 Active |
| SeedBank | `SeedBank.ts` | Reusable code seeds | 🟢 Active |
| ModelRouter | `ModelRouter.ts` | Routing to compost process | 🟢 Active |

**Features:**
- Automatic failure detection
- Fragment extraction and scoring
- Semantic analysis of failures
- Seed generation for future use
- "Digest" generation from compost heap

---

### 13. Thinking-Trace Feedback Loop ⭐ PRIMARY INNOVATION

**Location:** 
- `src/llm/LLMClient.ts` - Thinking extraction
- `src/generators/TierBasedGenerator.ts` - Thinking capture & reporting
- `src/harness/MetaHarnessIntegration.ts` - Harness analysis
- `src/harness/ThinkingSeparation.ts` - Repository & separation
- `src/emergent/ModelBehaviorPatterns.ts` - Pattern detection

**Purpose:** Meta-learning from LLM reasoning traces. Unlike any other creative coding tool, Liminal captures and learns from the model's *reasoning process*, not just its output.

**Core Principle:** Generator thinking and harness thinking are kept completely separate and analyzed differently.

**Architecture:**

```
Generator (any of 9) → LLM Call → {code, thinking, metrics}
                                        ↓
                              TierBasedGenerator
                                        ↓
                    ┌───────────────────┼───────────────────┐
                    ↓                   ↓                   ↓
          Code Recovery        Emergent Patterns      Meta-Harness
          (if needed)          (long-term trends)     (immediate analysis)
                                                       ↓
                                            "WHERE DID IT GO WRONG?"
                                            "HOW CAN I COMMUNICATE BETTER?"
                                                       ↓
                                            Harness LLM Analysis
                                                       ↓
                                            Insights → System Improvement
```

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| LLMClient | `llm/LLMClient.ts` | Extract thinking from responses | 🟢 Active |
| TierBasedGenerator | `generators/TierBasedGenerator.ts` | Capture & report thinking (ALL 9 generators) | 🟢 Active |
| ThinkingRepository | `harness/ThinkingSeparation.ts` | Store generator/harness thinking separately | 🟢 Active |
| ThinkingMiner | `harness/ThinkingSeparation.ts` | Extract insights from thinking | 🟢 Active |
| MetaHarness | `harness/MetaHarnessIntegration.ts` | Analyze with harness LLM | 🟢 Active |
| ModelBehaviorPatterns | `emergent/ModelBehaviorPatterns.ts` | Long-term pattern detection | 🟢 Active |

**Thinking Separation:**

| Type | Location | Question | Mined For |
|------|----------|----------|-----------|
| Generator | `~/.liminal/thinking-traces/generator/` | "How do I create this code?" | `code_in_thinking`, `confusion`, `over_engineering` |
| Harness | `~/.liminal/thinking-traces/harness/` | "How do I fix this system?" | Architecture, tools, validation gaps |

**Analysis Questions (asked by harness LLM for every generation):**

1. **WHERE DID IT GO WRONG?**
   - What misunderstanding did the generator have?
   - What confusion is evident in the thinking?
   - What pattern of failure do you see?

2. **HOW CAN I COMMUNICATE BETTER?**
   - What should the prompt have said differently?
   - What examples or constraints were missing?
   - How should instructions be rephrased?

3. **SYSTEM IMPROVEMENT SUGGESTIONS**
   - Should validation be changed?
   - Should the prompt template be updated?
   - Is there a model-specific quirk to handle?

**Real-World Impact:**

Minimax M2.7 case study:
- **Problem**: Returned "empty code" for 8/9 domains
- **Traditional diagnosis**: "Model is broken, don't use it"
- **Thinking-Trace diagnosis**: Discovered model puts code inside `<think>` tags
- **Result**: 0% → 67% success rate (code recovery implemented)
- **System learning**: Auto-detect `code_in_thinking` pattern

**Coverage:**
- ✅ All 9 generators (p5, Three.js, GLSL, Strudel, Hydra, Tone.js, Remotion, HTML, ASCII)
- ✅ CLI, TUI, Chat, and programmatic API
- ✅ Success and failure paths
- ✅ Real-time analysis (no batching)

**Synergy with Compost:**
- Compost = "What to generate?" (evolutionary search)
- Thinking-Trace = "How to communicate?" (meta-learning)

---

### 14. Aesthetic System

**Location:** `src/aesthetic/`

**Purpose:** Multi-dimensional aesthetic quality evaluation (M7).

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| AestheticCritic | `AestheticCritic.ts` | Main scoring orchestrator | 🟢 Active |
| ColorExtractor | `ColorExtractor.ts` | Palette analysis | 🟢 Active |
| ColorTheoryEngine | `ColorTheoryEngine.ts` | Harmony evaluation | 🟢 Active |
| Critics (multiple) | `critics/*.ts` | Specialized critics | 🟢 Active |

**Dimensions:**
- Visual composition
- Color harmony
- Motion/dynamics
- Novelty
- Technical execution

---

### 15. Plugin System

**Location:** `src/plugins/`

**Purpose:** Extension architecture for community plugins.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| PluginLoader | `PluginLoader.ts` | Dynamic plugin loading | 🟢 Active |
| HookSystem | `HookSystem.ts` | Lifecycle hooks | 🟢 Active |

**Hook Points:**
- Pre-generation
- Post-generation
- Pre-validation
- Post-validation
- On error
- On success

---

### 16. SOUL System

**Location:** `SOUL.md`, `src/harness/personality/SOUL.md`

**Purpose:** User-editable AI personality configuration.

**Features:**
- Editable personality file
- Voice/tone customization
- Behavior rules
- Capability definitions
- Communication style preferences

**Usage:**
```
1. Load SOUL.md → personality
2. Inject into prompts
3. Guide response generation
```

---

### 17. LLM Mode Agent

**Location:** `src/chat/`, `src/tui/`

**Purpose:** Full conversational agent mode with planning + reflection.

**Features:**
- Autonomous planning
- Multi-step execution
- Self-reflection
- Tool usage
- Context management

**Modes:**
- Chat: Conversational interface
- Agent: Autonomous task execution
- Hybrid: Mixed human/AI collaboration

---

### 18. Routing System

**Location:** `src/routing/`

**Purpose:** Intelligent model and task routing.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| SmartRouter | `SmartRouter.ts` | Route decisions | 🟢 Active |
| QualityPredictor | `QualityPredictor.ts` | Predict output quality | 🟢 Active |
| RoutingData | `RoutingData.ts` | Historical routing data | 🟢 Active |

**Routing Decisions:**
- Model selection based on task complexity
- Quality vs speed tradeoffs
- Historical performance data

---

### 19. Scavenger System

**Location:** `src/scavenger/`

**Purpose:** DNA extraction from existing code for learning.

**Components:**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| DNAExtractor | `DNAExtractor.ts` | Code DNA extraction | 🟢 Active |
| Fragments | `fragments/` | Stored code patterns | 🟢 Active |

**Features:**
- Extract reusable patterns from code
- Store as DNA fragments
- Use for generation guidance

---

## File Structure

```
liminal/
├── src/
│   ├── aesthetic/          # Aesthetic quality evaluation (M7)
│   ├── brain/              # Memory & knowledge systems
│   ├── chat/               # Conversational interface
│   ├── collab/             # Collaborative generation
│   ├── compost/            # Failure learning (CompostMill, etc.)
│   ├── core/               # Ralph Loop
│   ├── evolution/          # Evolutionary algorithms
│   ├── gallery/            # Output gallery
│   ├── generators/         # All generators (9 total)
│   │   ├── ascii/          # ASCII art generator
│   │   ├── glsl/           # GLSL shader generator
│   │   ├── html/           # Web page generator
│   │   ├── hydra/          # Hydra video synthesizer
│   │   ├── p5/             # p5.js generator
│   │   ├── remotion/       # Remotion video generator
│   │   ├── strudel/        # Strudel music generator
│   │   ├── three/          # Three.js generator
│   │   └── tone/           # Tone.js audio generator
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
│   ├── plugins/            # Plugin system (HookSystem, PluginLoader)
│   ├── prompts/            # Prompt library
│   ├── routing/            # Model routing (SmartRouter, QualityPredictor)
│   ├── sandbox/            # Code execution
│   ├── scavenger/          # DNA extraction
│   ├── security/           # Security config
│   ├── swarm/              # Swarm mode (SwarmOrchestrator)
│   ├── tui/                # Terminal UI (HarnessTUI, NaturalInterface)
│   └── utils/              # Utilities
├── test/                   # Test suite (1741+ tests)
│   └── guardrails/         # DGF tests (31 tests)
├── docs/                   # Documentation (THE BIBLE)
│   ├── THE_BIBLE.md        # Source of truth
│   ├── dashboard.html      # Visual dashboard
│   └── ...
├── harness-tasks/          # M1-M18 task definitions
├── SOUL.md                 # User-editable personality
└── ~/.liminal/             # User data (created at runtime)
    ├── memory/             # Persistent memory
    ├── failures/           # Failure logs
    ├── config.json         # Provider config
    └── history.json        # Prompt history
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


---

## Glossary

**A**
- **AestheticCritic** - Multi-dimension quality evaluation system (M7)
- **Agent** - Autonomous entity that can perform tasks
- **ASCII** - Text-based art generator domain

**B**
- **Bible** - This document (THE_BIBLE.md) - Source of truth
- **Budget** - Token limit for LLM generation

**C**
- **Compost** - Failure learning system that extracts reusable fragments
- **Constitution** - Self-learning rule database for guardrails (DGF Phase 3)
- **Catastrophic Guardrail** - Highest priority protection (Phase 1)

**D**
- **DGF** - Deterministic Guardrails Framework (3-phase protection system)
- **DNA** - Code pattern extracted by Scavenger system
- **Domain** - Creative coding domain (p5, GLSL, Three.js, etc.)

**E**
- **EpisodicMemory** - Conversations and generations storage
- **Evolution** - Phase 3 of DGF (learning and adaptation)

**F**
- **Flagship** - Highest tier model (Claude 4, GPT-4)
- **Fragment** - Reusable code piece from Compost system

**G**
- **Guardrail** - Safety check in the system (M1-M18 + DGF)
- **GUI** - Graphical User Interface (archived)

**H**
- **Harness** - Meta-harness self-improvement system
- **Heap** - CompostHeap stores failed generations

**I**
- **IntentRouter** - Routes natural language commands

**L**
- **LLM** - Large Language Model
- **Local** - Local model tier (Qwen, Llama, 16k context)

**M**
- **Meta-Harness** - Self-improving outer loop
- **M1-M18** - Guardrail milestones

**N**
- **NaturalInterface** - Routes commands without prefixes
- **NoveltyArchive** - Pattern diversity storage

**P**
- **Phase** - DGF has 3 phases (Foundation, Validation, Evolution)
- **Plugin** - Extension via HookSystem

**Q**
- **QualityArchive** - High-quality example storage
- **Queue** - Dogfood test queue

**R**
- **Ralph Loop** - Core iterative generation engine
- **Remediation** - Auto-fix strategy for errors
- **Routing** - Intelligent model/task routing

**S**
- **Scavenger** - DNA extraction from code
- **SchemaValidator** - Zod-like validation (DGF Phase 2)
- **SOUL** - User-editable AI personality
- **Swarm** - Multi-agent generation with voting

**T**
- **Taxonomy** - Error classification (15 types)
- **Tier** - Model tier (SHADOW, ADVISORY, ENFORCING, AUTONOMOUS)
- **TUI** - Terminal User Interface

**V**
- **Visual Bible** - docs/visual-bible.html dashboard

---

## Troubleshooting Guide

### Tests Failing

**31 guardrail tests failing**
```bash
# Check 1: Are guardrail files compiled?
npm run build

# Check 2: Run specific guardrail test
npx vitest run test/guardrails/GuardrailSystem.test.ts

# Check 3: Check for TypeScript errors
npx tsc --noEmit
```

**1741+ total tests failing**
```bash
# Check 1: Build first
npm run build

# Check 2: Run unit tests
npm test

# Check 3: Check for fixture issues
ls test/fixtures/*.js | wc -l  # Should be >100
```

### LLM Connection Issues

**"No LLM provider configured"**
```bash
# Set environment variables
export LIMINAL_LLM_PROVIDER=lmstudio
export LIMINAL_LLM_BASE_URL=http://localhost:1234/v1

# Verify
npm run tui
/status
```

**"LLM timeout"**
- Check if LM Studio/Ollama is running
- Verify model is loaded
- Try with LOCAL tier (faster)

### Harness Issues

**"Harness not initializing"**
```bash
# Check ~/.liminal/ directory exists
ls ~/.liminal/

# Check permissions
ls -la ~/.liminal/memory/

# Reset if corrupted
rm ~/.liminal/memory/*.json
```

### Generation Fails

**"Domain not detected"**
- Check prompt includes domain keywords (p5, shader, three, etc.)
- Use NaturalInterface for auto-detection

**"Output validation failed"**
- Check CodeValidator.ts for specific errors
- Review DGF error taxonomy

### Performance Issues

**Slow generation**
- Use LOCAL tier instead of FLAGSHIP
- Reduce maxIterations
- Check ResourceLimiter settings

**High memory usage**
- Clear CompostHeap: `rm ~/.liminal/compost/*`
- Restart TUI

---

## Contributing to THE BIBLE

### How to Update

1. **Edit THE_BIBLE.md** directly
2. **Update visual-bible.html** to match
3. **Commit both files together**
4. **Never let them diverge**

### What to Update

| When You... | Update This Section |
|-------------|---------------------|
| Add a subsystem | Subsystem Details + File Structure |
| Add a guardrail | DGF tables + Test Status |
| Change architecture | System Architecture ASCII |
| Add an export | API Exports |
| Fix a bug | Recent Changes |
| Add a feature | Executive Summary + Feature Status |

### Style Guide

- Use ✅ 🟢 for complete/active
- Use 🟡 ⚠️ for in-progress/warning
- Use ⚪ 🔴 for planned/blocked
- Keep tables aligned with `|`
- Update date in header

---

## API Quick Reference

### Core Functions

```typescript
// Generation
import { RalphLoop } from 'liminal';
const result = await RalphLoop.generate({ prompt: "p5.js circles" });

// Guardrails
import { initializeGuardrailSystem } from 'liminal';
const registry = initializeGuardrailSystem({ shadowMode: false });

// Memory
import { harnessMemory } from 'liminal';
await harnessMemory.recordEpisode({ prompt, result });
```

### Common Patterns

**Run a harness task**
```bash
npm run tui
/run M1
```

**Check status**
```bash
/status
```

**Natural language command**
```bash
"Generate a p5.js sketch with colorful circles"
```

### Environment Variables

```bash
LIMINAL_LLM_PROVIDER=lmstudio
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct
LIMINAL_LOG_LEVEL=info
```

---

## Decision Log (ADRs)

### ADR-001: DGF Over Traditional Guardrails
**Date:** 2026-03-25
**Decision:** Build 3-phase DGF instead of static M1-M18 only
**Context:** M1-M18 were incomplete, needed runtime protection
**Consequences:** +17 components, 31 tests, but complete protection

### ADR-002: Constitution for Self-Healing
**Date:** 2026-03-28
**Decision:** Pattern matching + rule learning vs hardcoded fixes
**Context:** Hardcoded fixes don't scale, need learning
**Consequences:** Rules evolve, confidence scoring, exportable

### ADR-003: Tier-Based Generation
**Date:** 2026-03-20
**Decision:** Model-aware prompts (flagship/medium/local/tiny)
**Context:** Local models have 16k limit, need different prompts
**Consequences:** 9 generators migrated, better local performance

### ADR-004: Natural Interface
**Date:** 2026-03-18
**Decision:** No command prefixes, intent routing
**Context:** `/generate p5` is clunky, want natural language
**Consequences:** More accessible, requires IntentRouter

### ADR-005: Compost System
**Date:** 2026-03-15
**Decision:** Learn from failures vs discard
**Context:** Failures contain reusable fragments
**Consequences:** SeedBank, CollisionEngine, semantic extraction

### ADR-006: No Template Fallbacks
**Date:** 2026-03-10
**Decision:** LLM-only generation, no static templates
**Context:** Templates mask problems
**Consequences:** Harness must be robust, no safety net

---

## Runbooks

### Restart the System

```bash
# 1. Stop TUI
Ctrl+C

# 2. Clear temp files
rm -rf tmp-e2e/*

# 3. Rebuild
npm run build

# 4. Start TUI
npm run tui
```

### Clear All Memory

```bash
# Backup first
cp -r ~/.liminal ~/.liminal.backup.$(date +%s)

# Clear
rm ~/.liminal/memory/*.json
rm ~/.liminal/failures/*
rm ~/.liminal/compost/*
```

### Debug a Failing Generator

```bash
# 1. Check specific generator
npx vitest run test/unit/p5-generator.test.ts

# 2. Run with debug
DEBUG=liminal:* npm test

# 3. Check harness logs
cat logs/failures-*.jsonl | grep "p5" | tail -10
```

### Update THE BIBLE

```bash
# 1. Edit THE_BIBLE.md
vim docs/THE_BIBLE.md

# 2. Update visual-bible.html
vim docs/visual-bible.html

# 3. Verify both changed
git diff --stat

# 4. Commit together
git add docs/THE_BIBLE.md docs/visual-bible.html
git commit -m "docs: Update bible with X"
```

---

## Changelog

### v2.1.0 - DGF Complete (2026-04-01)
- ✅ 31 guardrail tests passing
- ✅ 3-phase DGF complete
- ✅ Constitution + SelfHealing
- ✅ 18 subsystems documented

### v2.0.0 - Persistent Memory (2026-03-30)
- ✅ HarnessMemory persistent storage
- ✅ M9-M11 guardrails
- ✅ Model tier detection
- ✅ 9 generators migrated to TierBasedGenerator

### v1.9.0 - Natural Interface (2026-03-20)
- ✅ Natural language commands
- ✅ IntentRouter
- ✅ Chat system
- ✅ LLM Mode Agent

### v1.8.0 - Swarm & Compost (2026-03-15)
- ✅ SwarmOrchestrator
- ✅ CompostMill
- ✅ Multi-agent voting
- ✅ Failure learning

### v1.0.0 - Initial Release (2026-03-01)
- ✅ 9 generators
- ✅ Ralph Loop
- ✅ M1-M8 guardrails
- ✅ TUI interface

---

## Getting Started

### New Developer Onboarding

**Day 1: Read**
1. This Glossary (learn the terms)
2. Executive Summary (understand the system)
3. System Architecture (see the big picture)

**Day 2: Run**
1. `npm install`
2. `npm run build`
3. `npm run tui`
4. Type `/help`

**Day 3: Explore**
1. Run a harness task: `/run M1`
2. Generate something: "p5.js circles"
3. Check the visual bible: http://localhost:8080/visual-bible.html

**Day 4: Read Code**
1. `src/core/RalphLoop.ts`
2. `src/harness/HarnessMemory.ts`
3. `src/guardrails/index.ts`

**Day 5: Contribute**
1. Find a task in harness-tasks/
2. Run it: `/run <id>`
3. Update THE_BIBLE if you change something

---

## Observability

### Health Checks

```bash
# Check all systems
npm run tui
/status

# Expected output:
# ✅ LLM: Connected (lmstudio)
# ✅ Harness: Active
# ✅ Memory: 12 episodes
# ✅ Guardrails: 31/31 passing
```

### Metrics

| Metric | Command | Healthy |
|--------|---------|---------|
| Tests | `npm test` | 1741+ passing |
| Build | `npm run build` | No errors |
| Coverage | `npx vitest --coverage` | >80% |
| Lint | `npm run lint` | No errors |

### Logs

```bash
# Recent failures
tail -20 logs/failures-*.jsonl

# Harness activity
tail -50 logs/harness-*.log

# Build output
npm run build 2>&1 | tee logs/build.log
```

---

## Security Runbook

### Incident: Suspicious Generation

```bash
# 1. Check the prompt
grep "suspicious" logs/failures-*.jsonl

# 2. Review sandbox logs
cat logs/sandbox-*.log | grep "blocked"

# 3. Check if guardrail caught it
grep "ToolPermissionGuardrail" logs/failures-*.jsonl
```

### Incident: API Key Exposed

```bash
# 1. Rotate immediately
export LIMINAL_LLM_API_KEY=new_key

# 2. Check logs for exposure
grep -r "sk-" logs/  # Should only be in config

# 3. Clear history
rm ~/.liminal/history.json
```

### Incident: Resource Exhaustion

```bash
# 1. Check ResourceLimiter logs
grep "ResourceExhaustion" logs/failures-*.jsonl

# 2. Clear stuck processes
pkill -f "liminal"

# 3. Restart with lower limits
LIMINAL_MAX_ITERATIONS=3 npm run tui
```

---

## Migrations Guide

### v2.0 → v2.1 (DGF Changes)

**Breaking:**
- Guardrail initialization changed
- Old: `initializeGuardrails(config)`
- New: `initializeGuardrailSystem(config)`

**Migration:**
```typescript
// Before
import { initializeGuardrails } from 'liminal';
const registry = initializeGuardrails({ shadowMode: true });

// After
import { initializeGuardrailSystem } from 'liminal';
const { registry } = initializeGuardrailSystem({ shadowMode: true });
```

### v1.x → v2.0 (Persistent Memory)

**Breaking:**
- Memory is now persistent by default
- Episodes stored in `~/.liminal/memory/`

**Migration:**
```bash
# Backup old memory
cp -r ~/.liminal/memory ~/.liminal/memory.backup

# Clear to start fresh
rm ~/.liminal/memory/*.json
```

### Template Removal (v1.8)

**Breaking:**
- No template fallbacks
- All generation goes through LLM

**Impact:**
- LLM must be configured
- No offline generation
- Harness must handle all failures

---

## Index

### Quick Find

| Looking for... | Go to... |
|----------------|----------|
| System overview | Executive Summary |
| What's implemented | Test Status |
| Architecture diagram | System Architecture |
| Guardrail details | DGF section |
| Subsystem info | Subsystem Details (1-18) |
| File locations | File Structure |
| API exports | API Exports |
| Environment vars | Configuration |
| Recent changes | Recent Changes |
| Known issues | Known Limitations |
| How to update docs | Contributing |
| What term means | Glossary |
| Why we chose X | Decision Log |
| How to fix Y | Troubleshooting |
| Common functions | API Quick Reference |
| How to restart | Runbooks |
| What's new | Changelog |
| Onboarding | Getting Started |
| Health checks | Observability |
| Security incident | Security Runbook |
| Breaking changes | Migrations Guide |

---

**THE BIBLE is the source of truth. When in doubt, consult this document.**
**Visual Bible:** http://localhost:8080/visual-bible.html
