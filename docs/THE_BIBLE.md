# THE BIBLE - Liminal System Documentation

**Version:** 2.1 - Production Ready  
**Date:** 2026-04-02  
**Status:** 295 commits, worktree isolation deployed  
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

## Test Status: ✅ ALL PASSING

```
Test Files: 132
Tests:      1741 passing
Failures:   0
```

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

**Task Queue Status:**
- M1-M8: ✅ Core guardrails (implemented)
- M9: ✅ Semantic Validation (implemented, task archived)
- M10: ✅ Runtime Health Monitoring (implemented, task archived)
- M11: ✅ Accessibility (implemented, task archived)

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
| Unit Tests | ~100 files | ✅ Passing |
| Integration Tests | ~20 files | ✅ Passing |
| Generator Tests | ~12 files | ✅ Passing |
| E2E Tests | ~10 files | ✅ Passing |

**Test Fixes Applied:**
- ✅ Fixture sizes enlarged to >500 bytes
- ✅ LLM mocks added for generators
- ✅ Async test fixes
- ✅ CodeValidator fixtures rewritten

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

1. **M12-M18:** Not yet implemented
2. **Template Removal:** All template-based generation removed (pure LLM now)
3. **Browser Dependency:** M9-M11 require Puppeteer/Playwright
4. **Local Models:** 16k context limit (tier detection respects this)

---

## Next Steps

1. ✅ Merge worktree system to `main` - DONE
2. ✅ Delete stale branches - DONE
3. ✅ Initialize 18 repos with worktree support - DONE
4. 🔄 Implement M12-M18 (future)
5. 🔄 Community plugins (future)

---

**THE BIBLE is the source of truth. When in doubt, consult this document.**
