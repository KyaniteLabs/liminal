# THE BIBLE - Liminal System Documentation

**Version:** 2.1.0 - Beta  
**Date:** 2026-04-03  
**Status:** 296+ commits, dog food infrastructure complete  
**Branch:** main

---

## Executive Summary

Liminal is a creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), and more. The system features:

- **21 Subsystems** (8 core + 14 supporting)
- **18 Guardrails** (M1-M11 implemented, M12-M18 planned)
- **Persistent Memory** across sessions
- **Model-Aware Generation** (flagship/medium/local/tiny tiers)
- **Meta-Harness** self-improvement system
- **Ralph Loop** iterative refinement
- **Worktree Isolation** - Multi-agent development workflow

---

## Test Status: ✅ COMPLETE

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

### Recent Test Fixes (Remediation Plan)

**Wave 1 - Harness Tasks M1-M8:**
- M1: Fixed Tone.js validation gate
- M4: Fixed thinking regex greedy match
- M6-M8: Fixed console.log leaks in harness components

**Wave 2 - Infrastructure Fixes:**
- Cross-domain environment isolation with cache clearing
- Preview server port configuration (default 3456)
- HTML CSP security headers

**Wave 3 - Testing & Reporting:**
- Automated dog food report generator
- Integration test suite for full dog food pipeline
- Mock LLM provider for deterministic testing

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

---

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
│  │  M12-M18: ⚪ Planned/Future                                         │    │
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
| HarnessAgent | `agent/HarnessAgent.ts` | 7 tools for self-repair | 🟢 Active |
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
| M8 | Fix Console.log in HarnessUpdater | `src/harness/HarnessUpdater.ts` | Replaced console.log with Logger.info | ✅ Complete |

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

**Location:** `src/composite/`

**Purpose:** Composition utilities for combining creative elements.

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| Compositor | `Compositor.ts` | Composition engine |

---

### 15. Plugin System

**Location:** `src/plugins/`

**Purpose:** Extensible plugin architecture for custom generators and behaviors.

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
- Pane-first layout: history, active response, status/trust
- Explicit modes: Chat, Inspect, Action, Confirm
- Active-response pane: streaming responses don't touch committed history
- Confirmation-first: no state mutation without operator approval
- Trust/provenance labels: provider, model, trust-level badges
- Generated code: untrusted by default

**Go Components:**
| Component | Package | Purpose |
|-----------|---------|---------|
| Model | `internal/app/model.go` | UI state, event application, confirm/cancel |
| Update | `internal/app/update.go` | Bubble Tea Update loop with bridge wiring |
| View | `internal/app/view.go` | Pane rendering with Lip Gloss styles |
| Theme | `internal/ui/theme.go` | Style definitions |
| Bridge Client | `internal/bridge/client.go` | HTTP + SSE client for TS bridge |
| Event Types | `internal/bridge/events.go` | Event, SessionStatus, PendingAction structs |

**Test Coverage:** 16 Go tests passing across bridge client, bootstrap, event handling, action modes, and view rendering.

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
| 13 | Happy-path parity verified end-to-end | ⬜ Remaining (28 Go tests pass, TS build clean; needs live server+TUI smoke test) |

**Current: 12/13 complete.** Items 8-12 implemented in Wave 1+2 (commit `029e41dc`). Item 13 requires a live bridge+TUI integration run. See `docs/TUI_BUBBLE_TEA_EXECUTION_PLAN.md` for detailed status.

---

## Recent Changes (Last 20 Commits)

1. **feat:** Systematize worktree isolation for multi-agent development
2. **feat:** Worktree isolation system for multi-agent development
3. **feat:** Harness analyzes generator thinking (Where wrong? How communicate?)
4. **feat:** Thinking Separation - generator vs harness thinking
5. **feat:** TUI streaming, debug panel, Meta-Harness self-evaluation
6. **fix:** TUI detect non-TTY stdin and exit gracefully
7. **docs:** Update THE BIBLE with 19 subsystems
8. **cleanup:** Delete merged/stale branches (docs-site, remediation, voice-aesthetic)
9. **feat:** Initialize 18 repos with worktree support
10. **fix:** Remove duplicate exports for HTMLWebGenerator
11. **feat:** Migrate all generators to TierBasedGenerator
12. **fix:** Apply lint fixes to guardrails
13. **docs:** Update THE BIBLE with persistent memory, M9-M11
14. **feat:** Implement M9-M11 Guardrails
15. **feat:** Add Model Tier detection
16. **feat:** Add HarnessMemory
17. **docs:** Add DOCUMENTATION_WARNING
18. **rules:** Add NO DUPLICATION rule
19. **docs:** Add PROJECT_RULES.md
20. **feat:** Natural language interface

---

## Known Limitations

1. **M12-M18:** Not yet implemented (M1-M11 complete)
2. **Template Removal:** All template-based generation removed (pure LLM now)
3. **Browser Dependency:** M9-M11 require Puppeteer/Playwright
4. **Local Models:** 16k context limit (tier detection respects this)

## Resolved Issues ✅

| Issue | Resolution | Date |
|-------|------------|------|
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

---

## Next Steps

1. ✅ Merge worktree system to `main` - DONE
2. ✅ Delete stale branches - DONE
3. ✅ Initialize 18 repos with worktree support - DONE
4. ✅ Dog food infrastructure complete - DONE
5. 🔄 Cloud provider testing (requires API keys)
6. 🔄 Implement M12-M18 (future)
7. 🔄 Community plugins (future)

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
