# Liminal GitHub Repo Mining Blueprint

> **Purpose**: Single-source guide for a coding agent to mine 45 GitHub repos into Liminal
> **Owner**: Pastorsimon1798
> **Date**: 2026-03-29
> **Status**: READY FOR EXECUTION

---

## What Is Liminal

Liminal is a self-recursive creative coding agent at `/Users/simongonzalezdecruz/workspaces/liminal/`. It generates emergent generative art through iterative LLM-driven refinement via a **Ralph-Wiggum Loop**: the same prompt runs repeatedly, but context accumulates (artistic knowledge, compost DNA, evaluation history, archive examples). The agent generates code, evaluates its own output, and progressively improves until a quality gate is met.

**Stack**: TypeScript, Node.js, ESM, `tsc` build to `dist/`, pnpm, 187 test files, MIT license.

**Entry points**: CLI (`bin/liminal`), Node library (`src/index.ts`), HTTP API, GUI (`gui/`).

**Current domains**: p5.js (2D art), GLSL shaders, Three.js (3D), Strudel (live music), Hydra (audio-reactive visuals), Remotion (video).

---

## Existing Liminal Architecture

The agent must understand what already exists before writing code. All paths relative to project root.

```
src/
├── core/              # Main loop engine
│   ├── RalphLoop.ts          # Static run(prompt, options?) → LoopResult. Iterative generate→evaluate→accumulate loop
│   ├── CreativeEvaluator.ts  # 5-dimension heuristic scoring (technical, aesthetic, novelty, domain-specific)
│   ├── ScoringEngine.ts      # Composite scoring from multiple evaluators
│   ├── LoopConfig.ts         # LoopOptions, LoopResult, IterationContext, NormalizedLoopOptions types
│   ├── ContextBuilder.ts     # Builds enhanced context per iteration
│   └── StagnationDetector.ts # Detects when iterations stop improving
│
├── evolution/         # Quality-diversity optimization
│   ├── MapElites.ts          # 2D grid [10,10], insert/get/getElites/coverage. HARDCODED 2D — needs N-dim
│   ├── NoveltyArchive.ts     # K-NN (k=5, capacity=1000). NO PERSISTENCE — data lost between runs
│   ├── AestheticModel.ts     # K-NN quality predictor from human feedback (k=5). Has save/load. No decay
│   ├── BehaviorVectors.ts    # Extracts behavior vectors from creative output
│   ├── MetaMode.ts           # Meta-level evolution control
│   └── IGA.ts                # Interactive Genetic Algorithm
│
├── brain/             # Artistic intelligence
│   ├── SemanticArtMemory.ts  # Semantic memory for artistic knowledge
│   ├── EpisodicMemory.ts     # Episode-based memory
│   ├── ArtKnowledgeGraph.ts  # Knowledge graph of art concepts
│   ├── PromptEnhancer.ts     # Domain-specific prompt enhancement
│   └── comprehensive-artistic-knowledge.ts  # 50KB, 100+ techniques, 12+ styles
│
├── compost/           # Creative material digestion
│   ├── CompostMill.ts        # Main pipeline: extract→shred→collide→score→promote
│   ├── CompostSoup.ts        # Evolutionary loop on seeds (LLM-driven). THIS IS THE PRIMARY TARGET FOR UPGRADES
│   ├── CompostHeap.ts        # Raw material storage
│   ├── SeedBank.ts           # Scored seed storage
│   ├── CollisionEngine.ts    # Combines seeds for novel ideas
│   ├── SemanticExtractor.ts  # Extracts meaning from creative material
│   └── cli.ts                # CLI: add, digest, soup start/stop/status, seeds list/show
│
├── swarm/             # Multi-persona parallel generation
│   ├── SwarmOrchestrator.ts  # 4 modes: competitive, hybrid, ring, mesh. 5 Ollama personas
│   ├── VotingEngine.ts       # Multiple voting strategies
│   ├── MiningEngine.ts       # Extracts MinedFragments from persona outputs
│   ├── HeuristicScorer.ts    # Quick scoring without LLM
│   └── personas.ts           # 5 personas: Kai, Nova, Rex, Sam, Max (each: name, model, temp, systemPrompt)
│
├── collab/            # Multi-model collaboration
│   ├── DeepCollaboration.ts  # 3-phase: Diverge→Analyze→Synthesize across local+cloud
│   ├── CollaborativeClient.ts # Two-model generate→critique→refine
│   └── CollaborationEngine.ts
│
├── llm/               # LLM backend abstraction
│   ├── LLMClient.ts          # generate(systemPrompt, userPrompt) → {code, success}. 5 providers
│   ├── CacheManager.ts       # Response caching
│   └── RetryManager.ts       # Retry with backoff
│
├── routing/           # Smart model selection
│   ├── SmartRouter.ts        # Backward-compatible routing
│   └── RoutingData.ts        # Historical routing performance data
│
├── audio/             # Audio analysis (NEW, partially implemented)
│   ├── types.ts              # AudioFeature types
│   ├── AudioToVisualMapper.ts # Maps audio features to visual parameters
│   └── PitchUtils.ts         # Basic pitch utilities
│
├── aesthetic/         # Aesthetic quality critics (NEW, partially implemented)
│   ├── types.ts              # AestheticProfile, DesignConstraint types
│   └── critics/              # ColorHarmonyCritic, LayoutCritic, TypographyCritic
│
├── generators/        # Code generation by domain
│   ├── p5/                   # P5Generator, ParticleSystem, CellularAutomata, FlowField
│   ├── glsl/                 # ShaderGenerator
│   ├── three/                # ThreeGenerator
│   └── remotion/             # RemotionGenerator, RemotionRenderer
│
├── gallery/           # Iteration storage
│   ├── Gallery.ts            # JSON persistence, organism support, project-based
│   ├── SeedArchive.ts        # Archived seeds
│   └── FeedbackQueue.ts      # User feedback collection
│
├── learning/          # Quality archive and few-shot
│   ├── ArchiveLearning.ts    # Semantic few-shot from high-quality outputs
│   └── QualityArchive.ts     # Quality score history
│
├── chat/              # Interview-driven creative sessions
│   ├── types.ts              # Domain type = 'p5'|'shader'|'three'|'music'|'hydra'|'strudel'|'remotion'
│   ├── ChatCLI.tsx           # Interactive chat interface
│   ├── GuidanceEngine.ts     # Proactive suggestions based on iteration state
│   ├── InterviewPhase.ts     # 7-question creative brief
│   └── CreativeBrief.ts      # Brief data structure
│
├── prompts/           # 13 prompt template modules per domain
├── render/            # Preview + video rendering (Renderer, PreviewServer, CanvasRecorder, RemotionRenderer)
├── export/            # Output export (Exporter HTML/JS/ZIP, VideoExporter FFmpeg)
├── composite/         # Multi-layer compositing (Compositor with FFmpeg filter graphs)
├── scavenger/         # DNA extraction from past work (DNAExtractor)
├── sandbox/           # Safe code execution (SandboxRunner)
├── improvement/       # Self-reflection (SelfReflection, requestImprovement)
├── config/            # ConfigLoader, PromptHistory
├── tui/               # Terminal UI (Ink-based React)
├── ui/                # Transparency/debug viewer
├── music/             # generateMusic.ts
├── musicToVisual/     # Music-to-visual bridge
└── utils/             # Shared utilities
```

---

## Source Repos: Full Inventory

All repos belong to **Pastorsimon1798** on GitHub. Each entry lists what to mine and where it goes.

### Tier 1: Core Algorithm Repos (7 repos)

These contain the highest-value code — complete evolutionary systems, audio pipelines, and AI architectures.

#### 1. hydra-creative-agent (Python)
`https://github.com/Pastorsimon1798/hydra-creative-agent`

Multi-head creative AI with MAP-Elites quality-diversity optimization and novelty search.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `src/hydra/creative/map_elites.py` | N-dimensional BehaviorGrid (20x20), coverage tracking, behavior diversity metrics | `src/evolution/MapElites.ts` — upgrade from 2D to N-dim |
| `src/hydra/creative/novelty_archive.py` | K-NN with capacity-bounded deque, exponential decay sparseness, persistence | `src/evolution/NoveltyArchive.ts` — add save/load |
| `src/hydra/creative/prompt_evolution.py` | GA for prompts: selection (top 50%), crossover (word-level), mutation (synonym/numeric), fitness lineage | `src/evolution/PromptEvolution.ts` (NEW) |
| `src/hydra/creative/symbolic_language.py` | Emergent vocabulary of CreativeSymbols, 3 composition strategies, effectiveness tracking, disk persistence | `src/brain/SymbolicCreativeLanguage.ts` (NEW) |
| `src/hydra/creative/crossover.py` | Cross-domain technique transfer with mapping dictionaries, `combineReasoning()` | `src/evolution/CrossDomainCrossover.ts` (NEW) |
| `src/hydra/creative/reasoning_injection.py` | Parse Chain of Thought from cloud LLM, format as structured guidance for local LLM | `src/brain/ReasoningInjection.ts` (NEW) |
| `src/hydra/memory/aesthetic_model.py` | Recency-weighted decay, importance-based pruning | `src/evolution/AestheticModel.ts` — add decay |
| `src/hydra/eval/fitness.py` | Configurable fitness: `0.4*novelty + 0.3*quality + 0.2*technical + 0.1*diversity` | `src/evolution/FitnessCombiner.ts` (NEW) |

#### 2. EvoLab (TypeScript)
`https://github.com/Pastorsimon1798/EvoLab`

Evolution simulator with 55+ genetic traits, speciation, and adaptive procedural music.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `src/genetics/MutationEngine.ts` | Per-trait mutation (15% rate, ±15% magnitude), beneficial bias (10%), super mutations, DNA points | `src/evolution/MutationEngine.ts` (NEW) |
| `src/genetics/TraitSynergies.ts` | 12 emergent synergies (Hunter=speed+vision, Tank=armor+size). Trait interconnections | `src/evolution/TraitSynergies.ts` (NEW) |
| `src/genetics/SpeciationSystem.ts` | Auto-speciation at distance >0.4, K-means clustering, phylogenetic trees, extinction detection | `src/evolution/SpeciationSystem.ts` (NEW) |
| `src/genetics/SelectionPressure.ts` | Multi-axis fitness (temperature, light, pressure, toxicity, pH), multiplicative composite | `src/evolution/SelectionPressure.ts` (NEW) |
| `src/genetics/PerlinNoise.ts` | Seeded permutation, octave noise, 2D+3D | `src/utils/PerlinNoise.ts` (NEW) |
| `src/genetics/Genome.ts` | Full genome with traits, lineage, compound storage, cloning, serialization | `src/evolution/CreativeGenome.ts` (NEW) |
| `src/audio/MusicManager.ts` | 12 biome-specific scales, combat/light modulation, multi-layer synthesis | `src/audio/AdaptiveMusicManager.ts` (NEW) |
| `src/genetics/TraitSystem.ts` | 55+ traits across 7 categories, fitness/combat/metabolic calculations | `src/evolution/CreativeTraits.ts` (NEW) |

#### 3. mcp-video (Python)
`https://github.com/Pastorsimon1798/mcp-video`

79 MCP tools for video editing, published to PyPI, 545 tests.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| Full MCP architecture | 3-interface pattern (MCP server + Python client + CLI), structured JSON returns | `src/mcp/server.ts` (NEW) |
| Timeline DSL | JSON declarative video editing language | `src/mcp/tools/timeline.ts` (NEW) |
| Audio normalization | LUFS targets: YouTube -16, broadcast -23, Spotify -14 | `src/audio/AudioNormalizer.ts` (NEW) |
| Stem separation | Isolate vocals/drums/bass via AI | `src/audio/StemSeparator.ts` (NEW) |
| K-means color extraction | Pull dominant colors from images | `src/aesthetic/ColorExtractor.ts` (NEW) |
| Glitch/visual effects | Chromatic aberration, scanlines, noise, glow | `src/generators/effects/` (NEW) |
| Ken Burns effect | Pan+zoom animation from still images | `src/generators/effects/KenBurns.ts` (NEW) |

#### 4. Print-OS / caedo (TypeScript + Python)
`https://github.com/Pastorsimon1798/Print-OS`

Integrated 3D design + manufacturing platform with sophisticated AI prompt architecture.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `caedoapi/ai/prompts.py` | 8 specialized prompts with temperature tuning (0.2-0.8), anti-hallucination, JSON schemas | `src/prompts/specialized/` (NEW directory, 8 files) |
| `caedoapi/services/memory_service.py` | Extract user preferences from conversations, importance scoring (0-1), category-based | `src/brain/CreativePreferenceExtractor.ts` (NEW) |
| `caedoapi/domain/routing.py` | 5-dimension weighted scoring (quality 30, cost 20, speed 20, capability 20, reliability 10) | `src/routing/SmartRouter.ts` — enhance existing |
| `caedoapi/ml/failure_model.py` | RandomForestClassifier trained on synthetic data, predicts failure probability | `src/routing/QualityPredictor.ts` (NEW) |
| `caedoapi/services/scheduler.py` | Greedy scheduling by priority → best-scored resource | `src/core/TaskScheduler.ts` (NEW) |
| `caedoapi/services/batch_processor.py` | Queue-based processing with concurrency control | `src/core/BatchProcessor.ts` (NEW) |
| `caedoapi/services/forecaster.py` | Material forecasting from history + 20% safety buffer | `src/core/ResourceForecaster.ts` (NEW) |

#### 5. voice-to-scultpure-app (SvelteKit/TypeScript)
`https://github.com/Pastorsimon1798/voice-to-scultpure-app`

Transforms voice (singing, humming, speaking) into 3D ceramic sculptures in real-time.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `src/lib/engine/physicsMapping.ts` | Audio-frame-to-lathe-profile: energy→radius, pitch→height, semitone log scaling, beat impulse (1.2x) | `src/audio/VoiceToShapeMapper.ts` (NEW) |
| `src/lib/audio/audioTheory.ts` | Hz→MIDI, scale quantization, **pitch-class-to-HSL** (12 notes = 30° hue steps: C=Red, E=Yellow, G#=Blue) | `src/audio/PitchColorMapper.ts` (NEW) |
| `src/lib/workers/analysis.worker.ts` | Formant estimation (F1 openness, F2 frontness) via Meyda, phoneme→geometry mapping | `src/audio/FormantAnalyzer.ts` (NEW) |
| `src/lib/engine/geometryFactory.ts` | N-fold angular ripple, PBR materials with clearcoat/sheen/subsurface | `src/generators/effects/SymmetryDistortion.ts` (NEW) |
| `src/lib/engine/materialFactory.ts` | Ceramic PBR materials, fabrication constraints (3 modes) | `src/core/CreativeConstraints.ts` (NEW) |

#### 6. VoxForge (Next.js/TypeScript)
`https://github.com/Pastorsimon1798/VoxForge`

Voice-to-song: records singing/humming/beatboxing → complete music arrangements.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `lib/audio/pitch-detector.ts` | Multi-method: Hann windowing (4096 samples, 75% overlap), pre-emphasis, noise profile, confidence scoring | `src/audio/PitchDetector.ts` (NEW) |
| `lib/audio/music-generator.ts` | Drums (MembraneSynth/NoiseSynth/MetalSynth), bass (sawtooth), chords (PolySynth triangle) | `src/audio/BackingTrackGenerator.ts` (NEW) |
| BPM detection | Auto-detect tempo from recording | `src/audio/BPMKeyDetector.ts` (NEW) |
| Key detection | Auto-detect musical key via Tonal.js | `src/audio/BPMKeyDetector.ts` (combined) |
| Stem export | Individual WAV + MIDI export | `src/audio/StemExporter.ts` (NEW) |

#### 7. Generative-Score-Lab (TypeScript)
`https://github.com/Pastorsimon1798/Generative-Score-Lab`

AI-powered music composition with proven generative algorithms.

| Source File | What to Port | Target in Liminal |
|------------|--------------|-------------------|
| `src/generators/euclidean.ts` | **Bjorklund's algorithm**: distribute N pulses across M steps, rotation support, role-specific MIDI mapping | `src/music/EuclideanRhythm.ts` (NEW) |
| `src/generators/markov.ts` | Order-1 to Order-4 Markov chains, transition matrix, probabilistic walking | `src/music/MarkovChain.ts` (NEW) |
| `src/generators/random-walk.ts` | Constrained random walk from tonic, scale quantization, MIDI range C2-C7 | `src/music/RandomWalk.ts` (NEW) |
| `src/generators/arpeggiator.ts` | 5 modes (up/down/upDown/downUp/random), configurable octaveRange (1-4) | `src/music/Arpeggiator.ts` (NEW) |
| `src/theory/scales.ts` | 14 scale types, MIDI conversion, scale quantization | `src/music/TheoryEngine.ts` (NEW) |
| `src/theory/chords.ts` | Chord intervals, progression patterns | `src/music/TheoryEngine.ts` (combined) |
| AI intent parsing | "make it darker" → structured parameter changes | `src/music/IntentParser.ts` (NEW) |

---

### Tier 2: Algorithm + Pattern Repos (14 repos)

#### 8. lyrics-engine (Python)
`https://github.com/Pastorsimon1798/lyrics-engine`

| Source | Port | Target |
|--------|------|--------|
| `lyrics/rhyme_engine.py` — Perfect + slant rhyme via ARPAbet vowels, scoring (1.0/0.7/0.0) | `src/music/RhymeEngine.ts` (NEW) |
| `lyrics/syllable_counter.py` — Hyphenation + vowel group fallback, constraint validation, synonym suggestions | `src/music/SyllableCounter.ts` (NEW) |
| `lyrics/structure.py` — 5 templates (pop/rap/ballad/punk/singer-songwriter), generalizable to any creative domain | `src/music/StructureTemplates.ts` (NEW) |

#### 9. noise.sh (Go)
`https://github.com/Pastorsimon1798/noise.sh`

| Source | Port | Target |
|--------|------|--------|
| `internal/app/theory/prosody_engine.go` — Stress lexicon, syllable counts, meter detection, rhythmic weight | `src/audio/ProsodyEngine.ts` (NEW) |
| `internal/app/theory/harmony.go` — Mood-to-scale mapping (happy=CMajor, sad=AMinor, tense=EPhrygian, chill=DDorian) | `src/audio/MoodPaletteMapper.ts` (NEW) |
| `internal/app/ai/quick_idea_agent.go` — 5 modes (unstick/spark/tweak/check/harmony), exponential backoff | `src/core/QuickIdeaAgent.ts` (NEW) |
| `internal/app/ai/context_aware_prompts.go` — Content-type detection for domain-specific templates | `src/prompts/ContextAwareTemplates.ts` (NEW) |

#### 10. CEO_Agents (TypeScript)
`https://github.com/Pastorsimon1798/CEO_Agents`

| Source | Port | Target |
|--------|------|--------|
| `src/orchestrator.ts` — Multi-round deliberation, parallel responses, synthesis, token tracking | `src/collab/CreativeBoard.ts` (NEW) |
| `src/agent.ts` — Markdown+YAML frontmatter agent definition, expertise accumulation | `src/collab/board-agents/` (NEW, 5 agent .md files) |
| Decision memo format — Title, brief, stances, tensions, risks, actions, final positions | `src/collab/EvaluationMemo.ts` (NEW) |
| Expertise store — Persist insights per round, 3 extraction modes | `src/collab/ExpertiseStore.ts` (NEW) |

#### 11. Prism.sh (Go)
`https://github.com/Pastorsimon1798/Prism.sh`

| Source | Port | Target |
|--------|------|--------|
| 7 harmony rules (monochromatic through square) with ±5° precision | `src/aesthetic/ColorTheoryEngine.ts` (NEW) |
| WCAG 2.1 contrast validation (gamma-corrected, AA/AAA) | `src/aesthetic/ContrastValidator.ts` (NEW) |
| Temperature detection (warm/cool classification) | `src/aesthetic/ColorTemperature.ts` (NEW) |
| 147 named colors with fuzzy search | `src/aesthetic/NamedColors.ts` (NEW) |

#### 12. FlowCLI (Python)
`https://github.com/Pastorsimon1798/FlowCLI`

| Source | Port | Target |
|--------|------|--------|
| `src/flowcli/core/ambiguity.py` — 4 ambiguity types (vague, missing context, contradictions, multiple approaches) | `src/core/AmbiguityDetector.ts` (NEW) |
| `src/flowcli/core/session.py` — Persistent session state, file context tracking, checkpoints | `src/core/SessionManager.ts` (NEW) |
| Three-mode system (plan/ask/act) | Pattern for `GuidanceEngine` mode switching |
| Hybrid LLM strategy (local privacy, cloud complexity) | Pattern for `SmartRouter` |

#### 13. GameStory-Lab (TypeScript)
`https://github.com/Pastorsimon1798/GameStory-Lab`

| Source | Port | Target |
|--------|------|--------|
| Genre blending — Weighted mixing (70% RPG + 30% FPS), smart merging | `src/brain/StyleBlender.ts` (NEW) |
| 26 validation rules across 6 categories | Pattern for `CreativeEvaluator` domain rules |
| Multi-model orchestration — Cost-aware model selection (DeepSeek mechanics, Qwen creative, Gemini validation) | Pattern for `SmartRouter` |
| AI Project Architect — 27-question structured interview | Pattern for `InterviewPhase` |

#### 14. CyberWitches (JavaScript)
`https://github.com/Pastorsimon1798/CyberWitches`

| Source | Port | Target |
|--------|------|--------|
| Progressive design tiers (Tier 0 glitch → Tier 4 perfect) | `src/evolution/ProgressiveDesignTiers.ts` (NEW) |
| Glitch effects system — Chromatic aberration, scanlines, text corruption, distortion waves | `src/generators/effects/GlitchEffects.ts` (NEW) |
| Procedural ambient music — Pentatonic scale, mode-dependent effects, quantized timing | `src/audio/ProceduralAmbient.ts` (NEW) |
| Element specialization — 4 paths with unique multipliers and mechanics | Pattern for creative specialization trees |

#### 15. Generative-Assets-Lab (TypeScript + Python)
`https://github.com/Pastorsimon1798/Generative-Assets-Lab`

| Source | Port | Target |
|--------|------|--------|
| Multi-provider AI orchestration — OpenRouter/Imagen/DALL-E/Ollama with auto-enhancement | Pattern for `LLMClient` |
| Version history with branching — Visual timeline, rollback, branch from any version | `src/gallery/VersionTree.ts` (NEW) |
| Prompt enhancement pipeline — Auto-add domain context to prompts | Pattern for `PromptEnhancer` |
| Image processing — Transparent background, PNG compression, resize, LANCZOS | `src/export/ImageProcessor.ts` (NEW) |

#### 16. 3d-Designer (TypeScript)
`https://github.com/Pastorsimon1798/3d-Designer`

| Source | Port | Target |
|--------|------|--------|
| `lib/ai/provider.ts` — Factory supporting 8 backends with automatic fallback | Pattern for `LLMClient` |
| `lib/ai/system-prompt.ts` — CLARIFY vs DESIGN DELIVERY modes, DFM validation | Pattern for domain prompts |
| `lib/jscad/executor.ts` — Multi-step preprocessing pipeline: strip imports → remove duplicates → validate → execute → cache | Pattern for `SandboxRunner` |
| `components/voice/VoiceInput.tsx` — Web Speech API, continuous mode, silence detection, permission handling | Pattern for voice UI |

#### 17. Farm-to-Stars (TypeScript)
`https://github.com/Pastorsimon1798/Farm-to-Stars`

| Source | Port | Target |
|--------|------|--------|
| `src/game/decisions/engine.ts` — AI-driven events, immutable state transitions, phase advancement | `src/core/DecisionEngine.ts` (NEW) |
| `src/game/state/gameState.ts` — 4-phase progression (homestead→stellar), population cap scaling | Pattern for creative pipeline stages |
| `src/ai/minimax.ts` — Cache by composite key (scenario+phase+week), context-rich prompts | Pattern for creative material caching |
| `src/ai/types.ts` — `AIProvider` interface (generateEvent, resolveDecision, generateNarrative) | Pattern for LLM creative interface |

#### 18. apex-vault (Python)
`https://github.com/Pastorsimon1798/apex-vault`

| Source | Port | Target |
|--------|------|--------|
| `apex/skills/autonomous-loop/SKILL.md` — Ralph pattern: fresh agent per iteration, two-layer memory (progress.txt + AGENTS.md) | Pattern for `RalphLoop` iteration isolation |
| Quality gates — Baseline→Build→Lint→Types→Test→Regression→Security | Pattern for `CreativeEvaluator` multi-gate |
| Skill auto-routing — Load skills based on task keywords | Pattern for `GuidanceEngine` |

#### 19. atelier (TypeScript)
`https://github.com/Pastorsimon1798/atelier`

| Source | Port | Target |
|--------|------|--------|
| `src/core/RalphLoop.ts` — Merge steps (every N iterations, combine two previous outputs) | Add to `RalphLoop` — merge step mechanism |
| `src/evolution/IGA.ts` — Interactive Genetic Algorithm: 5 variations → score → ranked results | Enhance existing `IGA.ts` |
| Organism mode — `generateMusicToVisual` per iteration, living digital creatures | Pattern for `OrganismLoop` |

#### 20. DialectOS (TypeScript)
`https://github.com/Pastorsimon1798/DialectOS`

| Source | Port | Target |
|--------|------|--------|
| Circuit breaker — 3 providers with automatic failover | `src/llm/CircuitBreaker.ts` (NEW) |
| Structure-preserving markdown transformation | Pattern for code transformations |
| 16 MCP tools — Monorepo with 7 packages | Architecture pattern for `src/mcp/` |

#### 21. Pottery-App (TypeScript)
`https://github.com/Pastorsimon1798/Pottery-App`

| Source | Port | Target |
|--------|------|--------|
| `src/utils/potteryGeometry.ts` — 5 parametric profiles as Vector2 control points | Pattern for parametric creative profiles |
| `src/services/aiService.ts` — Async polling with retry (3 retries, 2s interval, 30s timeout), IndexedDB caching | Pattern for async AI generation |
| `src/utils/sculptingTools.ts` — 4 tools with ease-in-out cubic interpolation (`4t³` / `1-(-2t+2)³/2`) | `src/generators/effects/BrushTools.ts` (NEW) |

---

### Tier 3: Supporting Pattern Repos (11 repos)

#### 22. research-pipeline-prod (Python)
`https://github.com/Pastorsimon1798/research-pipeline-prod`

- **Human Door**: Bidirectional thought capture (HTML UI + TUI + MCP server). Port as pattern for creative intent capture
- **7-stage pipeline** (monitor→scope→discover→analyze→synthesize→output→publish). Port as pattern for `CompostMill` stages
- **Three-tier archive** (high-value/reviewed/rejected). Port as `src/gallery/ArchiveClassifier.ts` (NEW)

#### 23. cerafica (Python)
`https://github.com/Pastorsimon1798/cerafica`

- **Stage-based pipeline** (gather→plan→create→repurpose) with folder state tracking. Port as `src/core/CreativeWorkflow.ts` (NEW)
- **Brand identity system** (`identity.md`, `voice-rules.md`). Port as `src/brain/CreativeIdentity.ts` (NEW)
- **Direct Action Rule**: "Do the task directly once. Only abstract after 3+ repetitions." Pattern for avoiding premature abstraction

#### 24. GlazeLab (Python)
`https://github.com/Pastorsimon1798/GlazeLab`

- **UMF chemistry engine** — Oxide percentages → surface prediction. Port as `src/generators/chemistry/ChemistryMapper.ts` (NEW)
- **Compatibility analyzer** — Thermal expansion, fluidity, hard+soft scoring. Port as `src/generators/chemistry/CompatibilityScorer.ts` (NEW)
- **Gamification** — Badges, streaks, progression. Port as `src/core/Gamification.ts` (NEW)

#### 25. focus.sh (Go)
`https://github.com/Pastorsimon1798/focus.sh`

- **10 curated themes** (Amber Night, Twilight Mist, Forest Path, etc.). Port as `src/config/VisualThemes.ts` (NEW)
- **Natural language task parsing**. Pattern for `ChatCLI` creative direction
- **Unified dashboard**. Pattern for `src/tui/` multi-panel layout

#### 26. DECLuTTER-AI (Dart)
`https://github.com/Pastorsimon1798/DECLuTTER-AI`

- **Object detection + semantic grouping**. Port grouping algorithm as pattern for `SeedBank` categorization
- **Graceful degradation** (real model vs. mock fallback). Pattern for all multi-modal features
- **ADHD sprint timer**. Pattern for creative session timeboxing

#### 27. LifeOS (TypeScript)
`https://github.com/Pastorsimon1798/LifeOS`

- **Voice capture with auto-start + Whisper**. Port `useWhisper` hook pattern for `src/audio/`
- **Local-first sync** (PowerSync + Turso). Pattern for offline creative work with cloud backup
- **Second Brain architecture** (capture→organize→retrieve). Pattern for `compost` + `gallery`

#### 28. cursor-code-analyzer (TypeScript)
`https://github.com/Pastorsimon1798/cursor-code-analyzer`

- **"Fix with AI" pattern** (detect issue → suggest precise fix). Pattern for `SelfReflection` improvements
- **Multi-language AST analysis** (12 languages, 1-3 high-value checks each). Pattern for domain-specific validation

#### 29. tarot-content-creator (JavaScript)
`https://github.com/Pastorsimon1798/tarot-content-creator`

- **Multi-provider vision pipeline** (Gemini/OpenRouter/Ollama/LMStudio). Port as `src/llm/VisionClient.ts` (NEW)
- **Journal/gallery pattern**. Pattern for `Gallery` browsing UX

#### 30. site-to-stitch
`https://github.com/Pastorsimon1798/site-to-stitch`

- **Website reverse-engineering for design iteration**. Pattern for reference-image-to-generative-art

#### 31. prompt-optimizer (TypeScript)
`https://github.com/Pastorsimon1798/prompt-optimizer`

- **Prompt optimization algorithms**. Mine for `PromptEnhancer` improvements

#### 32. ShipLab (TypeScript)
`https://github.com/Pastorsimon1798/ShipLab`

- Ship/deploy patterns. Mine for deployment workflow

---

### Tier 4: Non-Code / Context Repos (13 repos — no code to port, useful for understanding)

| Repo | Why Listed |
|------|-----------|
| `Creator-kit` | Placeholder only — README with project name, nothing to mine |
| `AIJobs` | Job application materials — resume, prompts, domain instructions. No code |
| `cerafica-site` | HTML portfolio for ceramics brand. No algorithms |
| `creative-portfolio` | CSS portfolio site. Design reference only |
| `puenteworks-site` | HTML site for AI consulting. No algorithms |
| `web` | Astro site for Puente ops. No algorithms |
| `neurodivergent-directory` | Static directory. No algorithms |
| `liam-private` | Makefile backup of APEX rules + Liam identity. Already mined via apex-vault |
| `reverse-engineering` | HTML methodology docs. Research reference |
| `MutualAidApp` | Geohash privacy, smart matching, 14-language i18n. Low priority patterns |
| `openglaze` | Python SaaS — recipe calculator + billing. Low priority (overlap with GlazeLab) |
| `Pottery-App` | Already listed in Tier 2 above |
| `lean-study-buddy-extension` | Cost tracking, privacy filter, accessibility features. Low priority patterns |

---

## Implementation Phases

### Phase 1: Enhanced Evolutionary Engine (7 new files, 2 modified)

The core differentiator. Supercharges `CompostSoup` with real evolutionary mechanics.

**New files:**
1. `src/evolution/MutationEngine.ts` — from EvoLab's `MutationEngine.ts`
2. `src/evolution/TraitSynergies.ts` — from EvoLab's `TraitSynergies.ts`
3. `src/evolution/SpeciationSystem.ts` — from EvoLab's `SpeciationSystem.ts`
4. `src/evolution/SelectionPressure.ts` — from EvoLab's `SelectionPressure.ts`
5. `src/evolution/CreativeGenome.ts` — from EvoLab's `Genome.ts`
6. `src/evolution/FitnessCombiner.ts` — from hydra-creative-agent's `fitness.py`
7. `src/utils/PerlinNoise.ts` — from EvoLab's `PerlinNoise.ts`

**Modified files:**
1. `src/evolution/MapElites.ts` — upgrade from 2D to N-dimensional (from hydra-creative-agent)
2. `src/compost/CompostSoup.ts` — wire in all new evolution modules

**Test first:** Write tests for each new module before wiring into CompostSoup.

### Phase 2: Voice + Audio Pipeline (6 new files, 1 modified)

Complete voice-to-visual capability.

**New files:**
1. `src/audio/VoiceToShapeMapper.ts` — from voice-to-scultpure-app
2. `src/audio/PitchColorMapper.ts` — from voice-to-scultpure-app
3. `src/audio/FormantAnalyzer.ts` — from voice-to-scultpure-app
4. `src/audio/PitchDetector.ts` — from VoxForge
5. `src/audio/BackingTrackGenerator.ts` — from VoxForge
6. `src/audio/BPMKeyDetector.ts` — from VoxForge

**Modified files:**
1. `src/audio/AudioToVisualMapper.ts` — wire in all new audio modules

### Phase 3: Music Theory Engine (7 new files, 1 modified)

Complete generative music system.

**New files:**
1. `src/music/EuclideanRhythm.ts` — from Generative-Score-Lab
2. `src/music/MarkovChain.ts` — from Generative-Score-Lab
3. `src/music/TheoryEngine.ts` — from Generative-Score-Lab (scales + chords)
4. `src/music/Arpeggiator.ts` — from Generative-Score-Lab
5. `src/music/RhymeEngine.ts` — from lyrics-engine
6. `src/music/SyllableCounter.ts` — from lyrics-engine
7. `src/music/StructureTemplates.ts` — from lyrics-engine

**Modified files:**
1. `src/music/generateMusic.ts` — wire in all music theory modules

### Phase 4: Prompt Architecture + Creative Intelligence (7 new files, 2 modified)

Sophisticated prompts that evolve and learn preferences.

**New files:**
1. `src/prompts/specialized/evaluation.ts` — from Print-OS
2. `src/prompts/specialized/chat.ts` — from Print-OS
3. `src/prompts/specialized/design.ts` — from Print-OS
4. `src/brain/CreativePreferenceExtractor.ts` — from Print-OS
5. `src/core/AmbiguityDetector.ts` — from FlowCLI
6. `src/evolution/CrossDomainCrossover.ts` — from hydra-creative-agent
7. `src/brain/SymbolicCreativeLanguage.ts` — from hydra-creative-agent

**Modified files:**
1. `src/core/RalphLoop.ts` — add AmbiguityDetector pre-check
2. `src/brain/PromptEnhancer.ts` — integrate CreativePreferenceExtractor

### Phase 5: Multi-Agent Creative Critique (5 new files, 1 modified)

Deliberating panel replaces single evaluator.

**New files:**
1. `src/collab/CreativeBoard.ts` — from CEO_Agents
2. `src/collab/board-agents/TheMinimalist.md`
3. `src/collab/board-agents/TheExpressionist.md`
4. `src/collab/board-agents/TheTechnician.md`
5. `src/collab/EvaluationMemo.ts` — from CEO_Agents

**Modified files:**
1. `src/core/CreativeEvaluator.ts` — add optional board evaluation mode

### Phase 6: MCP Server + Smart Routing (5 new files, 2 modified)

Expose Liminal as an MCP server with intelligent routing.

**New files:**
1. `src/mcp/server.ts` — from mcp-video + DialectOS patterns
2. `src/llm/CircuitBreaker.ts` — from DialectOS
3. `src/routing/QualityPredictor.ts` — from Print-OS
4. `src/core/BatchProcessor.ts` — from Print-OS
5. `src/aesthetic/ColorExtractor.ts` — from mcp-video

**Modified files:**
1. `src/routing/SmartRouter.ts` — add weighted multi-dimensional scoring
2. `src/llm/LLMClient.ts` — integrate CircuitBreaker

### Phase 7: Supporting Features (9 new files)

Polish and enrichment.

**New files:**
1. `src/aesthetic/ColorTheoryEngine.ts` — from Prism.sh
2. `src/generators/effects/GlitchEffects.ts` — from CyberWitches
3. `src/evolution/ProgressiveDesignTiers.ts` — from CyberWitches
4. `src/brain/StyleBlender.ts` — from GameStory-Lab + GlazeLab
5. `src/core/CreativeConstraints.ts` — from voice-to-scultpure-app
6. `src/core/CreativeWorkflow.ts` — from cerafica + research-pipeline-prod
7. `src/generators/chemistry/ChemistryMapper.ts` — from GlazeLab
8. `src/llm/VisionClient.ts` — from tarot-content-creator
9. `src/core/Gamification.ts` — from GlazeLab + EvoLab + CyberWitches

---

## Porting Guidelines

### Python → TypeScript
- Focus on algorithm fidelity, not line-by-line translation
- Use TypeScript interfaces instead of Python dataclasses
- Use `Map` instead of Python `dict` where key types matter
- Use `Array` with `.push()` instead of Python lists with `.append()`
- Use `async/await` instead of Python `await`
- Add explicit types everywhere

### Go → TypeScript
- Convert Go structs to TypeScript `interface` or `type`
- Convert goroutine patterns to `Promise.all()` for parallel execution
- Convert Go channels to event emitters or async generators
- Use `string` template literals instead of `fmt.Sprintf`

### Integration Rules
1. All new modules must use Liminal's existing `LLMClient` for AI calls (never call APIs directly)
2. All new modules must use `Gallery` for persistence (never write custom file I/O except for module-specific data)
3. All new modules must follow Liminal's TypeScript conventions (ESM, strict mode, no `any`)
4. All new modules must have corresponding test files in `test/`
5. All new CLI commands must be wired into `bin/liminal` and `src/compost/cli.ts` as appropriate

### Testing Requirements
- Port test suites from source repos where they exist
- Write new tests for ports from repos without test coverage
- Add integration tests for each phase's wiring
- Run `pnpm test` after every module — zero regression tolerance

---

## Totals

| Metric | Count |
|--------|-------|
| Source repos mined | 32 (13 non-code repos excluded) |
| New files created | ~46 |
| Existing files modified | ~9 |
| Implementation phases | 7 |
| Estimated new test files | ~46 |
