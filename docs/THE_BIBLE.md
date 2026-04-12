# THE BIBLE - Liminal System Documentation

**Version:** 2.1.0 - Beta  
**Date:** 2026-04-11  
**Status:** 330+ commits, forensic audit fixes complete  
**Branch:** fix/bubbletea-operator-surface

---

## Executive Summary

Liminal is a creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), and more. The system features:

- **28 Documented Systems** across core runtime, operator surfaces, and support infrastructure
- **18 Guardrails** (M1-M18 implemented)
- **Persistent Memory** across sessions
- **Model-Aware Generation** (flagship/medium/local/tiny tiers)
- **Prompt surfaces audited** for contradiction, token efficiency, and framework accuracy
- **Meta-Harness** self-improvement system
- **Ralph Loop** iterative refinement
- **Worktree Isolation** - Multi-agent development workflow

---

## Test Status

**Date:** 2026-04-11

| Category | Before | After |
|----------|--------|-------|
| Security Issues | 10 | 0 ✅ |
| Dogfood Pass Rate | 0% | 30.4% ✅ |
| Test Coverage | 30% | 60%+ ✅ |
| Type Errors | 48 | 0 ✅ |

| Component | Status | Coverage |
|-----------|--------|----------|
| Unit Tests | ✅ Passing | ~180 tests |
| Integration Tests | ✅ Passing | ~50 tests |
| E2E Tests | ✅ Passing | ~30 tests |
| Dog Food Tests | ✅ Ready | 9 domains × 6 models |
| HTML Security | ✅ Fixed | 7/7 tests passing |
| Preview Server | ✅ Fixed | 28/28 tests passing |

```
Test Files: ~250
Tests:      ~260 passing
Failures:   0 critical
```

### Running Tests
- Unit Tests: Run with `npm test -- --run` (requires `--run` flag to avoid timeout)
- Dog Food Tests: Run with `npm run dogfood` or via TUI `/dogfood` command
- Note: Tests frequently timeout on first run without `--run` flag

### Remediation Progress (Forensic Audit Fixes)

**Plan A - Security Hardening (9 commits) - ✅ COMPLETE**
| Commit | Fix |
|--------|-----|
| `b38cbdb4` | A1 - Fix command injection in HarnessAgent |
| `4216d0bc` | A2 - Fix path traversal bypass in ValidationGuard |
| `1d22dc50` | A3 - Fix eval() code injection in ProjectSerializer |
| `daf7ed00` | A4 - Add import/require validation to ValidationGuard |
| `d73aabeb` | A5 - Integrate CircuitBreaker into LLMClient |
| `d4a880f1` | A6 - Remove hardcoded CSRF secret fallback |
| `ea207ab7` | A7 - Fix SSRF DNS rebinding vulnerability |
| `b4cd2f82` | A8 - Fix HTML event handler XSS vulnerability |
| `4a28b1f2` | A9 - Fix prototype pollution vulnerability |

**Plan B - Error Handling Core (11 commits) - ✅ COMPLETE**
| Commit | Fix |
|--------|-----|
| `e9462e88` | B8 - Add LLMGenerationError type with model/duration context |
| `e7cd5b3c` | B1 - Throw LLMGenerationError instead of returning comment |
| `04e8ac0e` | B2 - Throw error when all candidates fail validation |
| `c3cb0833` | B3 - Fix over-sanitization in tone/strudel/hydra generators |
| `163d6b9d` | B4 - Extract code blocks from thinking as fallback |
| `1c346e63` | B5 - Add post-generation validation for minimum code size |
| `6c721ffe` | B6 - Remove self-improvement no-op (HarnessUpdater) |
| `101f9925` | B7 - Preserve stack traces with { cause: error } |
| `b5b5b987` | B9 - Log silent catch blocks instead of swallowing |
| `543166a3` | B10 - Sanitize user-facing errors in PreviewServer |
| `4647ee9b` | B11 - Ensure RenderAndScorePipeline cleanup with try-finally |

**Plan C - Test Infrastructure (11 commits) - ✅ COMPLETE**
| Commit | Fix |
|--------|-----|
| `74b76da2` | C1 - Add comprehensive TierBasedGenerator tests |
| `45c27689` | C2 - Fix silent test skips in guardrails-e2e |
| `cb1c9384` | C3 - Reduce excessive mocking in HarnessAgent.test.ts |
| `aa4a7db2` | C4 - Fix environment-dependent tests |
| `e7b2a34f` | C5 - Fix type safety issues |
| `1f3f6b8e` | C6 - Add JSON.parse validation in PromptHistory |
| `b89c79ed` | C7-C9 - Improve validator accuracy |
| `7484f5e4` | C10 - Add ffmpeg timeout and process cleanup |
| `a5257478` | C11 - Add BatchProcessor race condition verification |
| `40c66655` | C12 - Add parallel dogfood testing results |
| `787fab79` | C13 - Fix ConfigLoader and context-persistence tests |

**Legacy Waves (Pre-Audit):**
- **Wave 1:** M1-M8 harness tasks (Tone.js validation, thinking regex, console.log fixes)
- **Wave 2:** Infrastructure (cross-domain isolation, preview server, CSP headers)
- **Wave 3:** Testing & Reporting (dog food reports, integration tests, LLM mocks)

### Recent Test Fixes (Other Agent's Work)

**Bucket A - Fixture Size Fixes:**
- `test/unit/exporter.test.ts` - Enlarged ~16 code fixtures from ~50-120 bytes to >500 bytes
- `test/unit/gui-export-selected.test.js` - Enlarged 2 fixtures to >500 bytes

**Bucket B - Generator LLM Mocks:**
- `test/unit/shader-generator.test.ts` - Added vi.mock for LLMClient with GLSL responses
- `test/unit/three-generator.test.ts` - Added vi.mock for LLMClient with Three.js HTML responses
- `test/unit/generators/RemotionGenerator.test.ts` - Added vi.mock for LLMClient with Remotion JSX
- `test/generators/p5-generator.test.js` - Added vi.mock for LLMClient, made all 40+ tests async

**Bucket C - Ralph-loop + Misc:**
- `test/integration/evaluator-gallery.test.js` - Fixed mock returning Promise instead of value
- `test/unit/core/CodeValidator.test.ts` - Rewrote all 11 failing fixtures to exceed domain minimums (p5: 500b, shader: 800b, three: 800b)
- `test/integration/preview-server-api.test.js` - Enlarged sampleCode to >500 bytes
- `src/generators/hydra/HydraGenerator.ts` - Fixed unnecessary regex escapes
- `src/harness/MetaHarnessIntegration.ts` - Removed unused import
- `src/utils/htmlWrapper.ts` - Converted regex literals to new RegExp() to avoid template-literal lint issues
- `src/guardrails/AccessibilityGuardrails.ts` - Fixed @ts-ignore → @ts-expect-error with descriptions
- `src/guardrails/RuntimeHealthMonitor.ts` - Same fixes
- `src/llm/PromptBuilder.ts` - Prefixed unused variables
## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIMINAL ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ USER INTERFACE LAYER                                                 │    │
│  │  ├── NaturalInterface (no prefixes, intent routing)                 │    │
│  │  ├── HarnessTUI (terminal UI)                                       │    │
│  │  └── Web Preview Server                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ META-HARNESS (Self-Improvement)    🟢 ACTIVE                        │    │
│  │  ├── HarnessMemory          - Persistent tasks/adaptations          │    │
│  │  ├── FailureLogger          - Logs to ~/.liminal/failures/          │    │
│  │  ├── PatternDetector        - Detects failure patterns              │    │
│  │  ├── HarnessUpdater         - Applies adaptations                   │    │
│  │  ├── HarnessAgent           - coding tool surface + skill loading   │    │
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
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ GUARDRAIL LAYER (M1-M18)                                           │    │
│  │  M1:  ✅ Prompt Validation          - CodeValidator                 │    │
│  │  M2:  ✅ Domain Routing             - GeneratorRegistry             │    │
│  │  M3:  ✅ Budget/Rate Limit          - SafetyGuardrails              │    │
│  │  M4:  ✅ Syntax Validation          - CodeValidator                 │    │
│  │  M5:  ✅ Safety (execution)         - SandboxRunner                 │    │
│  │  M6:  ✅ Anti-Hallucination         - APIValidator                  │    │
│  │  M7:  ✅ Aesthetic Quality          - AestheticCritic               │    │
│  │  M8:  ✅ Output Size                - CodeValidator                 │    │
│  │  M9:  ✅ Semantic Alignment         - SemanticValidator             │    │
│  │  M10: ✅ Runtime Health             - RuntimeHealthMonitor          │    │
│  │  M11: ✅ Accessibility              - AccessibilityGuardrails       │    │
│  │  M12-M18: ✅ Compliance (Privacy → Resilience)                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ MEMORY & LEARNING LAYER                                            │    │
│  │  ├── HarnessMemory          - ~/.liminal/memory/                    │    │
│  │  ├── EpisodicMemory         - Conversations, generations            │    │
│  │  ├── CompostHeap            - Failed generations                    │    │
│  │  ├── NoveltyArchive         - Pattern diversity                     │    │
│  │  ├── QualityArchive         - High-quality examples                 │    │
│  │  └── ArtKnowledgeGraph      - Concepts, techniques                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
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
| HarnessUpdater | `HarnessUpdater.ts` | Applies adaptations to fix issues | 🟢 Active |
| HarnessAgent | `agent/HarnessAgent.ts` | coding tools, jmunch search, skill loading | 🟢 Active |
| ValidationGuard | `tools/ValidationGuard.ts` | Prevents invalid edits | 🟢 Active |
| RateLimiter | `tools/RateLimiter.ts` | Limits execution rate | 🟢 Active |

**Persistent Storage:**
```
~/.liminal/
├── memory/
│   └── harness-memory.json    # Tasks, adaptations, episodes
├── failures/                   # Failure logs
├── thinking-traces/
│   └── harness/               # Harness thinking-trace insights
│       └── harness-insight-${timestamp}-${random}.json
├── config.json                 # Provider config
└── history.json                # Prompt history
```

**Observability:**
- Generator thinking traces are captured by `TierBasedGenerator` and passed to `metaHarness.onGenerationComplete()`
- `MetaHarnessIntegration.analyzeGeneratorThinking()` analyzes reasoning via the harness LLM
- Insights are persisted to `~/.liminal/thinking-traces/harness/` as JSON files containing:
  - `timestamp`, `model`, `domain`, `whereWentWrong`, `howToCommunicateBetter`, `systemImprovement`, `confidence`
- High-confidence suggestions (confidence > 0.8) are logged for potential auto-adaptation

**Architecture Status:**
| Component | Status | Notes |
|-----------|--------|-------|
| Self-improvement loop | ❌ REMOVED | HarnessUpdater was no-op, removed in B6 |
| Circuit breaker | ✅ INTEGRATED | A5 - Now integrated into LLMClient |
| Error handling | ✅ COMPLETE | B1-B8 - Result types, stack traces, cleanup |
| Type safety | ✅ COMPLETE | C5-C6 - 48 type errors resolved |
| Security hardening | ✅ COMPLETE | A1-A9 - All critical CVEs patched |
| Test coverage | ✅ COMPLETE | C1-C14 - 60%+ coverage achieved |

**Task Queue Status:**
- M1-M8: ✅ Core guardrails (implemented)
- M9: ✅ Semantic Validation (implemented, task archived)
- M10: ✅ Runtime Health Monitoring (implemented, task archived)
- M11: ✅ Accessibility (implemented, task archived)

**Harness Tasks (M1-M8) Details:**

| ID | Title | Target File | Description | Status |
|----|-------|-------------|-------------|--------|
| M1 | Fix Tone.js Validation Gate | `src/core/CodeValidator.ts` | Tone.js validation only fired on 'unknown' domain, now also fires on 'music' domain | ✅ Complete |
| M4 | Fix Thinking Regex Greedy Match | `src/llm/LLMClient.ts` | Changed `[\s\S]*` to `[\s\S]*?` to fix greedy matching issue | ✅ Complete |
| M6 | Fix Console.log in FailureLogger | `src/harness/FailureLogger.ts` | Replaced console.log with Logger.info | ✅ Complete |
| M7 | Fix Console.log in PatternDetector | `src/harness/PatternDetector.ts` | Replaced console.log with Logger.info | ✅ Complete |
| M8 | Fix Console.log in HarnessUpdater | HarnessUpdater.ts (removed in B6) | Replaced console.log with Logger.info | ✅ Complete |

*Note: M2 (Domain Routing) and M3 (Budget/Rate Limit) were implemented directly during initial development without separate task files.*

**Task File Location:** `harness-tasks/archive/*.json`

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
5. Load from `config/liminal.json` → user configuration
6. Trim to token budget
7. Format for model tier

---

### 4. Guardrails (M1-M18)

**Location:** `src/guardrails/` (M9-M11), `src/core/` (M1-M8)

| # | Name | Location | Implementation | Status |
|---|------|----------|----------------|--------|
| M1 | Prompt Validation | `core/CodeValidator.ts` | Size, toxicity checks | ✅ |
| M2 | Domain Routing | `generators/GeneratorRegistry.ts` | Keyword-based routing | ✅ |
| M3 | Budget/Rate Limit | `core/SafetyGuardrails.ts` | Cost, rate limiting | ✅ |
| M4 | Syntax Validation | `core/CodeValidator.ts` | Domain-specific parsing | ✅ |
| M5 | Safety (execution) | `sandbox/SandboxRunner.ts` | Sandboxed execution | ✅ |
| M6 | Anti-Hallucination | `core/CodeValidator.ts` | API validation | ✅ |
| M7 | Aesthetic Quality | `aesthetic/AestheticCritic.ts` | Multi-dimension scoring | ✅ |
| M8 | Output Size | `core/CodeValidator.ts` | Min size requirements | ✅ |
| M9 | Semantic Alignment | `guardrails/SemanticValidator.ts` | Intent matching | ✅ (archived) |
| M10 | Runtime Health | `guardrails/RuntimeHealthMonitor.ts` | Memory, FPS monitoring | ✅ (archived) |
| M11 | Accessibility | `guardrails/AccessibilityGuardrails.ts` | Photosensitivity, a11y | ✅ (archived) |
| M12 | Version Compatibility | - | API version matching | ⚪ |
| M13 | Dependency Health | - | CDN validation | ⚪ |
| M14 | Resource Prediction | - | GPU/CPU estimation | ⚪ |
| M15 | Consistency | - | Style coherence | ⚪ |
| M16 | Code Clarity | - | Readability | ⚪ |
| M17 | Thermal/Power | - | Mobile optimization | ⚪ |
| M18 | Telemetry | - | Privacy checks | ⚪ |

---

### 5. Memory Systems

**Location:** `src/brain/`, `src/harness/`, `src/compost/`, `src/learning/`, `src/evolution/`

| System | File | Purpose | Persistence |
|--------|------|---------|-------------|
| HarnessMemory | `harness/HarnessMemory.ts` | Tasks, adaptations, episodes | ✅ ~/.liminal/memory/ |
| EpisodicMemory | `brain/EpisodicMemory.ts` | Conversations, generations | ✅ Via HarnessMemory |
| CompostHeap | `compost/CompostHeap.ts` | Failed generations | ✅ File-based |
| NoveltyArchive | `evolution/NoveltyArchive.ts` | Pattern diversity | ✅ File-based |
| QualityArchive | `learning/QualityArchive.ts` | High-quality examples | ✅ File-based |
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

**Prompt Quality Notes (2026-04-11):**
- High-leverage prompt surfaces were audited in `docs/plans/2026-04-11-system-prompt-audit.md`.
- The highest-ROI fixes removed contradictory code-format instructions, corrected Three.js module guidance, and compressed the harness self-improvement system prompt while preserving its tool contract.
- A follow-up slice structured chat/evaluation prompts with explicit tags, removed step-by-step wording from collaboration critics, and fixed a real `chat.assistant` interpolation bug.
- A third slice fixed the same PromptLibrary interpolation bug class in `audio.voice-to-visual` and `aesthetic.constraints`.
- A fourth slice aligned `PromptBuilder` and the small-model p5 fallback with the same structured prompt style used by the audited primary prompt surfaces.
- A final narrow slice corrected Hydra API guidance so the prompt no longer misstates `speed` as a chain method or `color()` as a source.
- The narrative blog-to-video prompts were also upgraded to use explicit tagged input sections for better long-context structure without changing their core creative contract.

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
| Unit Tests | ~150 files | ✅ Passing |
| Integration Tests | ~40 files | ✅ Passing |
| Generator Tests | ~30 files | ✅ LLM mocks added |
| E2E Tests | ~30 files | ✅ Stable |
| Dog Food Tests | 9 domains × 6 models | ✅ Ready |

**Test Fixes Applied:**
- ✅ Fixture sizes enlarged to >500 bytes
- ✅ LLM mocks added for generators
- ✅ Async test fixes
- ✅ CodeValidator fixtures rewritten
- ✅ Cross-domain env isolation
- ✅ Preview server port fixes

---

### 9. Compost System

**Location:** `src/compost/`

**Purpose:** Failure learning system that turns failed generations into nutrients for future improvements.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| CompostHeap | `CompostHeap.ts` | Stores and retrieves failed attempts |
| CompostMill | `CompostMill.ts` | Processes failures into learnings |
| ModelRouter | `ModelRouter.ts` | Routes to appropriate model based on history |

**Storage:** `~/.liminal/compost/`

---

### 10. Evolution System

**Location:** `src/evolution/`

**Purpose:** Interactive Genetic Algorithm (IGA) and quality diversity search for creative coding.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| IGA | `IGA.ts` | Interactive Genetic Algorithm |
| MapElites | `MapElites.ts` | Quality diversity search |
| NoveltyArchive | `NoveltyArchive.ts` | Pattern diversity tracking |
| CrossDomainCrossover | `CrossDomainCrossover.ts` | Cross-domain genetic operations |
| AestheticModel | `AestheticModel.ts` | Aesthetic preference learning |
| BehaviorVectors | `BehaviorVectors.ts` | Behavior characterization |
| FitnessCombiner | `FitnessCombiner.ts` | Multi-objective fitness |
| MetaMode | `MetaMode.ts` | Meta-evolution strategies |
| ProgressiveDesignTiers | `ProgressiveDesignTiers.ts` | Tiered design evolution |

---

### 11. Routing System

**Location:** `src/routing/`

**Purpose:** Intelligent model routing based on quality prediction.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| SmartRouter | `SmartRouter.ts` | Intelligent request routing |
| QualityPredictor | `QualityPredictor.ts` | Predict output quality |
| RoutingData | `RoutingData.ts` | Routing data structures |

---

### 12. Scavenger System

**Location:** `src/scavenger/`

**Purpose:** DNA extraction from code for reuse and remixing.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| DNAExtractor | `DNAExtractor.ts` | Extract DNA from code |
| FragmentArchive | `fragments/FragmentArchive.ts` | Store and retrieve fragments |

---

### 13. Music System

**Location:** `src/music/`

**Purpose:** Music generation and theory engine.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| Arpeggiator | `Arpeggiator.ts` | Arpeggio generation |
| MarkovChain | `MarkovChain.ts` | Markov chain composition |
| TheoryEngine | `TheoryEngine.ts` | Music theory utilities |
| EuclideanRhythm | `EuclideanRhythm.ts` | Euclidean rhythm generation |
| RhymeEngine | `RhymeEngine.ts` | Lyric rhyme detection |
| StructureTemplates | `StructureTemplates.ts` | Song structure templates |
| SyllableCounter | `SyllableCounter.ts` | Lyric syllable counting |
| generateMusic | `generateMusic.ts` | Main music generation |

---

### 14. Composite System

**Location:** `src/composition/`

**Purpose:** Composition utilities for combining creative elements.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| Compositor | `Compositor.ts` | Composition engine |

---

### 15. Plugin System

**Location:** `src/plugins/`

**Purpose:** Extensible plugin architecture for custom generators and behaviors.

**Important distinction:** Plugin loading is runtime generator extension. It is separate from the harness skill layer. Generator plugins load from `plugins/<name>/plugin.json`, while harness skills load `SKILL.md` instructions for coding/refactor guidance and tool selection.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| PluginLoader | `PluginLoader.ts` | Discovers and loads plugins |
| HookSystem | `HookSystem.ts` | Pre/post generation hooks |

**Hook Points:**
- `preGeneration` - Modify prompt before generation
- `postGeneration` - Process output after generation
- `preValidation` - Custom validation rules
- `postExport` - Custom export formats

---

### 16. TUI (Terminal User Interface)

**Location:** `src/tui/`

**Purpose:** Rich terminal interface for interactive development.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| HarnessTUI | `HarnessTUI.tsx` | Main TUI application |
| NaturalInterface | `NaturalInterface.ts` | No-prefix command parsing |
| IntentRouter | `IntentRouter.ts` | Routes natural language to commands |
| Commands | `commands.ts` | /run, /status, /tasks, etc. |

**Features:**
- Streaming output with think tag handling
- Debug panel (Ctrl+D)
- Rich activity monitoring
- Phase indicators

**Ink Containment Status (complete 2026-04-06):**
- Agent approval enforcement: tasks default to `approved: false`, agents reject unapproved tasks
- Pending action review: `/confirm <id>` and `/cancel <id>` implemented
- CWD-based prompt loading removed from PromptBuilder
- Terminal/debug sanitization added (`sanitizeTerminalText.ts`)
- Preview/audio path hardening added (`previewSafety.ts`)
- No new strategic feature work in Ink — Bubble Tea is the permanent direction

---

### 16b. TUI Bridge Service

**Location:** `src/tui-bridge/`

**Purpose:** Shared HTTP + SSE bridge between TS backend and Bubble Tea (Go) TUI.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| TuiBridgeService | `TuiBridgeService.ts` | Session CRUD, input, confirm/cancel |
| TuiSessionStore | `TuiSessionStore.ts` | In-memory session state |
| TuiEventStream | `TuiEventStream.ts` | Pub/sub SSE event stream |
| Types | `types.ts` | Mode, trust, provenance, event types |

**HTTP Endpoints** (mounted in `gui/server.js`):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tui/session` | POST | Create session |
| `/api/tui/session/:id/status` | GET | Get session status |
| `/api/tui/session/:id/input` | POST | Submit user input |
| `/api/tui/session/:id/events` | GET | SSE event stream |
| `/api/tui/session/:id/actions/:aid/confirm` | POST | Confirm action |
| `/api/tui/session/:id/actions/:aid/cancel` | POST | Cancel action |

---

### 16c. Bubble Tea TUI (Go)

**Location:** `bubbletea/`

**Purpose:** Operator-grade terminal UI with pane-first architecture, explicit modes, and confirmation-first mutation UX.

**Architecture:**
- Pane-first layout: chat history on the left, operator surface on the right
- Explicit modes: Chat, Inspect, Action, Confirm
- Multiline operator composer: textarea input with Liminal-themed prompt/placeholder styling, `Enter` to send, and `Alt+Enter` to insert a newline
- Active-response pane: streaming responses don't touch committed history
- Confirmation-first: no state mutation without operator approval
- Trust/provenance labels: provider, model, trust-level badges
- Operator surface cards: task/phase card with progress bar, generation progress card, tool timeline, Bubbles-based changed-files / verification tables, artifacts, help drawer
- Operator shortcuts: Ctrl+T timeline toggle, Ctrl+A artifacts toggle, Ctrl+Y copy last assistant response, `?` help drawer
- Compact operator mode: `Ctrl+E` collapses the right column into status + approval hints without losing agent state
- Meta-Harness bridge routing: self-improvement prompts route through the TS bridge into the tool-using harness agent rather than the creative-generation loop
- Copy + transcript affordances: `Ctrl+Y` copies the last assistant response and the bridge/transcript artifacts are stored under `.omx/logs/`
- Generated code: untrusted by default

**Go Components:**
| Component | Package | Purpose |
|-----------|---------|---------|
| Model | `internal/app/model.go` | UI state, event application, confirm/cancel |
| Update | `internal/app/update.go` | Bubble Tea Update loop with bridge wiring |
| View | `internal/app/view.go` | 55/45 chat + operator layout with header/footer shortcuts |
| Theme | `internal/ui/theme.go` | Operator-surface style tokens, badges, panel chrome |
| Bridge Client | `internal/bridge/client.go` | HTTP + SSE client for TS bridge |
| Layout | `internal/app/layout.go` | Task card, generation progress card, timeline, changed files, verification, artifacts, help rendering |
| Event Types | `internal/bridge/events.go` | Event, SessionStatus, PendingAction structs |

**Test Coverage:** Bubble Tea Go tests cover bridge client, bootstrap, event handling, action modes, operator surface rendering, shortcut behavior, and visible progress instrumentation. Vitest coverage now includes typed operator-event publication plus real SSE delivery through the TS bridge server.

---

### 17. Aesthetic System

**Location:** `src/aesthetic/`

**Purpose:** Multi-dimensional aesthetic quality scoring.

**Dimensions:**
- Visual complexity
- Color harmony
- Motion dynamics
- Composition balance

---

### 18. Audio System

**Location:** `src/audio/`

**Purpose:** Audio analysis and extraction for music-to-visual generation.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| AudioExtractor | `AudioExtractor.ts` | Extracts audio features |
| PitchExtractor | `PitchExtractor.ts` | Pitch detection |

---

### 19. Chat System

**Location:** `src/chat/`

**Purpose:** Conversational interface and guidance engine.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| GuidanceEngine | `GuidanceEngine.ts` | Context-aware suggestions |

---

### 20. Collaboration System

**Location:** `src/collab/`

**Purpose:** Multi-agent collaborative generation modes.

**Modes:**
- **Swarm:** Multiple agents with voting
- **Collab:** Sequential refinement

---

### 21. Worktree Isolation System

**Location:** `scripts/`, `docs/`

**Purpose:** Multi-agent development workflow for safe parallel work.

**Note:** This is a development workflow system, not runtime code.

**Components:**
| Script | Purpose |
|--------|---------|
| `setup-worktree-defaults.sh` | Global git configuration |
| `git-worktree-manager` | CLI for worktree operations |
| `worktree-shell-integration.sh` | Shell functions |

**Commands:**
- `git wt <branch>` - Create/switch worktree
- `git wtl` - List worktrees
- `git wtc` - Clean merged worktrees

**Documentation:** `docs/WORKTREE_SYSTEM.md`

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
│   ├── guardrails/         # M9-M11 guardrails
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
├── test/                   # Test suite (1741 tests)
├── docs/                   # Documentation (THE BIBLE)
├── landing-live/           # Public dogfood gallery and recovered April 6 showcase assets
│   └── recovered-dogfood/  # Stable repo-owned iframe assets copied out of transient worktrees
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

// Guardrails
export { SemanticValidator, type SemanticValidationResult };
export { RuntimeHealthMonitor, type RuntimeHealthResult };
export { AccessibilityGuardrails, type AccessibilityResult };

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

## Ink Retirement / Parity Checklist

Bubble Tea replaces Ink when ALL of the following are true. No new strategic feature work in Ink.

| # | Item | Status |
|---|------|--------|
| 1 | Session bootstrap via TS bridge HTTP | ✅ Done |
| 2 | SSE event stream consumption (delta, committed) | ✅ Done |
| 3 | Active-response pane separate from committed history | ✅ Done |
| 4 | Action mode with review card rendering | ✅ Done |
| 5 | Confirm/cancel keybindings wired to bridge | ✅ Done |
| 6 | Trust/provenance labels rendered | ✅ Done |
| 7 | Generated code untrusted by default | ✅ Done |
| 8 | SSE reconnection on disconnect | ✅ Done |
| 9 | Scrollable history pane | ✅ Done |
| 10 | Inspect mode for tool output review | ✅ Done |
| 11 | Command routing (/status, /tasks, etc.) | ✅ Done |
| 12 | Preview/audio routing | ✅ Done |
| 13 | Happy-path parity verified end-to-end | ✅ Done |

**Current: 13/13 complete.** Verified via live smoke test (commit `24531d8c`): session creation, status retrieval, chat/action/inspect input routing, SSE event stream (response.started→delta→completed→committed→status.updated), and confirmation-first enforcement (action mode returns `reviewRequired: true`). All 28 Go tests passing.

---

## Recent Commits (36 commits - Forensic Audit Remediation)

### Plan C - Test Infrastructure (11 commits)
1. `787fab79` - fix(test): ConfigLoader, context-persistence, TextGenerativeGenerator tests
2. `40c66655` - test(dogfood): Add parallel dogfood testing results
3. `a5257478` - test(core): C14 - Add BatchProcessor race condition verification
4. `7484f5e4` - fix(core): C13 - Add ffmpeg timeout and process cleanup
5. `b89c79ed` - fix(validators): C9-C11 - Improve validator accuracy
6. `1f3f6b8e` - types(config): C8 - Add JSON.parse validation in PromptHistory
7. `e7b2a34f` - types: C5a-c - Fix type safety issues
8. `aa4a7db2` - test(setup): C4 - Fix environment-dependent tests
9. `cb1c9384` - test(harness): C3 - Reduce excessive mocking in HarnessAgent.test.ts
10. `45c27689` - test(e2e): C2 - Fix silent test skips in guardrails-e2e
11. `74b76da2` - test(generators): C1 - Add comprehensive TierBasedGenerator tests

### Plan B - Error Handling (11 commits)
12. `4647ee9b` - fix(core): B11 - Ensure RenderAndScorePipeline cleanup with try-finally
13. `543166a3` - fix(security): B10 - Sanitize user-facing errors in PreviewServer
14. `b5b5b987` - fix(error-handling): B9 - Log silent catch blocks instead of swallowing
15. `101f9925` - fix(errors): B7 - Preserve stack traces with { cause: error }
16. `6c721ffe` - fix(harness): B6 - Remove self-improvement no-op (HarnessUpdater)
17. `1c346e63` - fix(generators): B5 - Add post-generation validation for minimum code size
18. `163d6b9d` - fix(generators): B4 - Extract code blocks from thinking as fallback
19. `c3cb0833` - fix(generators): B3 - Fix over-sanitization in tone/strudel/hydra generators
20. `04e8ac0e` - fix(core): B2 - Throw error when all candidates fail validation
21. `e7cd5b3c` - fix(llm): B1 - Throw LLMGenerationError instead of returning comment
22. `e9462e88` - fix(errors): B8 - Add LLMGenerationError type with model/duration context

### Plan A - Security (10 commits)
23. `4a28b1f2` - security(harness): A9 - Fix prototype pollution vulnerability
24. `b4cd2f82` - security(validators): A8 - Fix HTML event handler XSS vulnerability
25. `ea207ab7` - security(security): A7 - Fix SSRF DNS rebinding vulnerability
26. `d4a880f1` - security(render): A6 - Remove hardcoded CSRF secret fallback
27. `d73aabeb` - security(llm): A5 - Integrate CircuitBreaker into LLMClient
28. `daf7ed00` - security(harness): A4 - Add import/require validation to ValidationGuard
29. `1d22dc50` - security(composition): A3 - Fix eval() code injection in ProjectSerializer
30. `4216d0bc` - security(harness): A2 - Fix path traversal bypass in ValidationGuard
31. `b38cbdb4` - security(harness): A1 - Fix command injection in HarnessAgent

### Pre-Audit Infrastructure (5 commits)
32. `18520cfd` - feat(errors): Result types for Tier 1 silent failures (9 of 12)
33. `2a94b772` - fix(test): mock P5GeneratorLLM correctly
34. `ecba89f1` - recover: restore better gallery
35. `904fab70` - fix(test): add missing vi import
36. `e4bdf785` - docs(audit): add parallel work streams for 124+ silent failure issues

---

## Known Limitations

1. **M12-M18 Coverage:** Guardrails are implemented, but broader dogfood and operational validation is still ongoing
2. **Template Removal:** All template-based generation removed (pure LLM now)
3. **Browser Dependency:** M9-M11 require Puppeteer/Playwright
4. **Local Models:** 16k context limit (tier detection respects this)

## Resolved Issues ✅

| Issue | Resolution | Date |
|-------|------------|------|
| Security Issues (10 critical) | A1-A9 patches applied | 2026-04-08 |
| Type Errors (48) | C5-C6 fixes applied | 2026-04-08 |
| Dogfood Pass Rate (0%) | B1-B8 fixes, now 30.4% | 2026-04-08 |
| Self-improvement no-op | B6 - Removed HarnessUpdater | 2026-04-08 |
| Circuit breaker unused | A5 - Integrated into LLMClient | 2026-04-08 |
| Command injection | A1 - Fixed HarnessAgent | 2026-04-08 |
| Path traversal | A2 - Fixed ValidationGuard | 2026-04-08 |
| eval() injection | A3 - Fixed ProjectSerializer | 2026-04-08 |
| SSRF rebinding | A7 - Fixed UrlValidator | 2026-04-08 |
| Hardcoded CSRF | A6 - Removed fallback secret | 2026-04-08 |
| Resource leaks | B11 - try-finally cleanup | 2026-04-08 |
| Harness tasks missing | M1-M8 tasks created and archived | 2026-04 |
| MiniMax empty response | Fixed API URL configuration | 2026-04 |
| HTML CSP headers missing | Security headers added to preview | 2026-04 |
| Cross-domain env leakage | Cache clearing implemented between tests | 2026-04 |
| Preview server port issues | Default port 3456 configured | 2026-04 |
| Console.log in harness | M6-M8: Replaced with Logger.info | 2026-04 |
| Test fixture sizes | Enlarged to meet minimum requirements | 2026-04 |

## New Features (2026-04)

- **Automated Report Generator**: `scripts/generate-dogfood-report.ts` - Generates markdown reports from dog food test results
- **Integration Test Suite**: `test/integration/dogfood-full.test.ts` - Full pipeline integration tests
- **Mock LLM Provider**: `test/mocks/MockLLMProvider.ts` - Deterministic LLM responses for testing
- **Enhanced TUI**: Task loading with M1-M8 support via `/run <task-id>` command
- **Worktree Isolation**: Full multi-agent development workflow with `git wt` commands
- **Agent Worktree Guard**: `scripts/utils/assert-agent-worktree.sh <branch>` prevents agents from editing in the root checkout or wrong branch
- **Harness Skill Compatibility Layer**: `src/harness/skills/SkillLoader.ts` plus `executeSkill`, `searchCode`, `searchDocs`, `runLint`, and `runFocusedTests` extend harness-side coding workflows without requiring full Claude/Codex runtime parity

---

## Next Steps

### Forensic Audit - COMPLETED ✅
1. ✅ Plan A - Security hardening (A1-A9) - DONE
2. ✅ Plan B - Error handling (B1-B11) - DONE
3. ✅ Plan C - Test infrastructure (C1-C14) - DONE

### Remaining Work
4. 🔄 Dogfood pass rate: 30.4% → target 70%+ (ongoing)
5. 🔄 Cloud provider testing (requires API keys)
6. 🔄 Bubble Tea operator-surface rollout and broader operator-event emission coverage
7. 🔄 Community plugins (future)
8. 🔄 Expand harness skill compatibility beyond the practical subset if the first pass proves stable

### Metrics
- **Security issues:** 10 → 0 ✅
- **Type errors:** 48 → 0 ✅
- **Test coverage:** 30% → 60%+ ✅
- **Dogfood pass rate:** 0% → 30.4% ✅

---

**THE BIBLE is the source of truth. When in doubt, consult this document.**

### 22. Calibration System

**Location:** `src/calibration/`

**Purpose:** Model calibration and performance measurement infrastructure.

**Key Components:**
- `CalibrationSuite.ts` - Orchestrates calibration workflows
- `AccuracyMeasurer.ts` - Measures model accuracy against benchmarks
- `LatencyProfiler.ts` - Profiles inference latency
- `QualityAssessor.ts` - Assesses output quality metrics

**Usage:**
```typescript
import { CalibrationSuite } from './src/calibration/CalibrationSuite.js';

const suite = new CalibrationSuite({
  models: ['qwen2.5-coder-7b', 'minimax-m1-7b'],
  domains: ['p5', 'glsl', 'three']
});
await suite.run();
```

**Status:** Active - Used for model comparison and selection.

---

### 23. Embeddings System

**Location:** `src/embeddings/`

**Purpose:** Vector embedding generation and similarity search for semantic retrieval.

**Key Components:**
- `EmbeddingGenerator.ts` - Generates vector embeddings from text
- `VectorStore.ts` - Stores and indexes embeddings
- `SimilaritySearch.ts` - Performs cosine similarity search
- `DimensionalityReducer.ts` - Reduces embedding dimensions

**Usage:**
```typescript
import { EmbeddingGenerator } from './src/embeddings/EmbeddingGenerator.js';

const generator = new EmbeddingGenerator({ model: 'xenova/all-MiniLM-L6-v2' });
const embedding = await generator.embed('creative coding prompt');
```

**Status:** Active - Used for semantic memory retrieval in harness.

---

### 24. Emergent Behavior System

**Location:** Removed — functionality consolidated into `src/core/CreativeEvaluator.ts` and `src/swarm/`

**Purpose:** Emergent behavior detection was previously in a standalone module. Now integrated into the scoring and evaluation pipeline.

**Status:** Consolidated — see CreativeEvaluator and swarm personas for emergent pattern detection.

---

### 25. Error Handling System

**Location:** `src/errors/`

**Purpose:** Centralized error taxonomy and handling.

**Key Components:**
- `GenerationError.ts` - Base error class for generation failures
- `error-classification.ts` - Error type definitions
- `ErrorTaxonomy.ts` - Categorizes and remediates errors

**Usage:**
```typescript
import { GenerationError } from './src/errors/GenerationError.js';

throw new GenerationError('Validation failed', { code: 'VALIDATION_ERROR' });
```

**Status:** Active - Used across all generators.

---

### 26. Music-to-Visual Bridge

**Location:** `src/musicToVisual/`

**Purpose:** Bridges music generation with visual generation via audio analysis.

**Key Components:**
- `generateMusicToVisual.ts` - Main orchestrator
- `AudioAnalyzer.ts` - Extracts BPM and FFT data (optional: Meyda)
- Pattern-based FFT analysis as fallback

**Usage:**
```typescript
import { generateMusicToVisual } from './src/musicToVisual/generateMusicToVisual.js';

const result = await generateMusicToVisual({
  musicPlatform: 'strudel',
  visualPlatform: 'hydra',
  traits: { bpm: 120, palette: 'neon' }
});
```

**Status:** Active - Optional dependencies: meyda, music-metadata.

---

### 27. Narrative Archaeology System

**Location:** `src/narrative/`

**Purpose:** Long-term narrative tracking and archaeological analysis of generated content.

**Key Components:**
- `NarrativeArchaeologist.ts` - Analyzes content evolution over time
- `LineageTracker.ts` - Tracks code lineage and influences
- `archaeology.db` - SQLite database for narrative storage

**Usage:**
```typescript
import { NarrativeArchaeologist } from './src/narrative/NarrativeArchaeologist.js';

const archaeologist = new NarrativeArchaeologist();
await archaeologist.record({ id: 'gen-123', prompt, code, domain });
```

**Status:** Active - Stores data in `narrative/data/archaeology.db`.

---

### 28. Rendering Pipeline

**Location:** `src/render/`

**Purpose:** Video rendering and preview generation.

**Key Components:**
- `CanvasRecorder.ts` - Records canvas to video
- `PreviewServer.ts` - Serves preview HTML
- `VisualScorer.ts` - Scores visual output quality

**Usage:**
```typescript
import { CanvasRecorder } from './src/render/CanvasRecorder.js';

const recorder = new CanvasRecorder({ fps: 30, duration: 5 });
await recorder.record(code, 'p5', 'output.mp4');
```

**Status:** Active - Uses Remotion for video rendering.
