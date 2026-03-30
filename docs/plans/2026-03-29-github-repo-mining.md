# GitHub Repo Mining Plan for Liminal

> **Date**: 2026-03-29
> **status**: PLANNING
> **scope**: Mine 45 GitHub repos for algorithms, patterns, and features to integrate into Liminal

---

## Context

Liminal is a self-recursive creative coding agent (`src/` with 31 modules, 187 tests). Your GitHub has 45 non-fork repos containing battle-tested implementations of nearly every algorithm Liminal needs — from evolutionary systems to audio pipelines to multi-agent architectures. This plan maps specific source code from each repo to specific files and interfaces in Liminal, organized into 7 implementation phases.

### Existing Liminal Infrastructure (Build On These)

| Module | Key Files | What Exists |
|--------|-----------|-------------|
| Evolution | `MapElites.ts` (2D grid), `NoveltyArchive.ts` (K-NN, no persistence), `AestheticModel.ts` (K-NN predictor) | Basic quality-diversity, no persistence in novelty, 2D only |
| Core | `RalphLoop.ts` (static run), `CreativeEvaluator.ts` (5-dim scoring), `Scavenger/DNAExtractor.ts` | Main loop, evaluation |
| LLM | `LLMClient.ts` (5 providers, caching, retry) | Multi-provider client |
| Compost | `CompostMill.ts`, `CompostSoup.ts`, `SeedBank.ts`, `CollisionEngine.ts` | Full pipeline, LLM-driven evolution |
| Swarm | `SwarmOrchestrator.ts` (4 modes), `personas.ts` (5 personas), `MiningEngine.ts` | Multi-model |
| Routing | `SmartRouter.ts`, `RoutingData.ts` | Backward-compatible routing |
| Gallery | `Gallery.ts` (JSON persistence, organism support) | Full persistence |
| Audio | `types.ts`, `AudioToVisualMapper.ts`, `PitchUtils.ts` | Basic audio analysis |
| Aesthetic | `types.ts`, `critics/ColorHarmonyCritic.ts`, `LayoutCritic.ts`, `TypographyCritic.ts` | Quality critics |
| Generators | `p5/`, `glsl/`, `three/`, `remotion/` | Domain generators |
| Chat | `types.ts` (Domain type = 7 values), `ChatCLI.tsx`, `GuidanceEngine.ts` | Interview-driven sessions |

---

## Phase 1: Enhanced Evolutionary Engine

> **Goal**: Supercharge compost soup with quality-diversity optimization from hydra-creative-agent + EvoLab
> **Priority**: HIGHEST — this is the core differentiator

### 1.1 Upgrade MapElites to N-Dimensional BehaviorGrid

**Source**: `hydra-creative-agent/src/hydra/creative/map_elites.py`
**Target**: `src/evolution/MapElites.ts`

Current MapElites is hardcoded 2D (`dims?: [number, number]` defaults to `[10, 10]`). Port to N-dimensional grid supporting:
- Variable dimensions (4-8 axes): technique complexity, confidence, alternative count, parameter count, novelty, emotion
etc.)
- Multi-resolution grid (coarse grid for exploration, fine grid for exploitation)
- `insert()` with configurable behavior vector length
- `sample()` method for parent selection (currently missing)
- `getCoverage()`, `getDiversity()` metrics
- Adaptive resolution based on coverage density

**Source algorithms to port**:
- `BehaviorGrid` class with configurable dimensions per cell
- Coverage tracking (fraction of occupied cells)
- Behavior diversity metric (average pairwise distance between occupied cells)
- Evolutionary parent selection from unoccupied cells

### 1.2 Add Persistence to NoveltyArchive
**Source**: `hydra-creative-agent/src/hydra/creative/novelty_archive.py`
**Target**: `src/evolution/NoveltyArchive.ts`

Current archive has no save/load — data is lost between runs. Add:
- `save(filePath)` / `load(filePath)` methods (JSON serialization)
- Exponential decay sparseness metric (from hydra's `sparseness()`)
- Capacity-bounded deque with configurable k

### 1.3 Add Decay to AestheticModel
**Source**: `hydra-creative-agent/src/hydra/memory/aesthetic_model.py`
**Target**: `src/evolution/AestheticModel.ts`

Current model has no forgetting. Add:
- Recency-weighted decay for old ratings
- Configurable forgetting half-life
- Importance-based pruning when capacity exceeded

### 1.4 Implement TraitSynergy System for Creative Dimensions
**Source**: `EvoLab/src/genetics/TraitSynergies.ts`
**Target**: `src/evolution/TraitSynergies.ts` (NEW)

Port EvoLab's 12 trait synergies to creative dimensions:
- Define creative trait categories: novelty, complexity, emotion, coherence, energy, subtlety, rhythm, contrast, harmony, depth
- Define interconnections: increasing energy decreases subtlety (-30%), complexity increases contrast (+20%)
- Define emergent synergy bonuses:
  - **Visionary** = novelty + emotion → +15% quality boost
  - **Cinematic** = rhythm + depth → +10% narrative coherence
  - **Minimalist** = subtlety + harmony → +20% aesthetic score
  - **Baroque** = complexity + contrast → +15% visual impact
  - **Ambient** = harmony + depth → +25% immersive quality
  - **Chaotic** = energy + novelty → -10% coherence (trade-off)

### 1.5 Implement SpeciationSystem for Creative Outputs
**Source**: `EvoLab/src/genetics/SpeciationSystem.ts`
**Target**: `src/evolution/SpeciationSystem.ts` (NEW)

When creative outputs diverge enough, automatically speciate them:
- Genetic distance threshold (configurable, default 0.4)
- Phylogenetic tree tracking (parent → child relationships)
- Creative species name generation (art-inspired: "Abstract Impressionist #3", "Glitch Romantic #7")
- Extinction detection (outputs with no descendants after N generations)
- Lineage visualization data export (for D3.js rendering)

### 1.6 Implement SelectionPressure for Creative Constraints
**Source**: `EvoLab/src/genetics/SelectionPressure.ts`
**Target**: `src/evolution/SelectionPressure.ts` (NEW)

Map creative constraints to environmental fitness:
- Axes: genre, mood, style, technique, domain
- Each axis has optimal value and tolerance-based fitness curve
- Composite fitness is multiplicative across all axes
- Survival probability = fitness score
- Used by CompostSoup to evaluate whether a mutation fits the target creative environment

### 1.7 Port PerlinNoise for Creative Space Exploration
**source**: `EvoLab/src/genetics/PerlinNoise.ts`
**Target**: `src/utils/PerlinNoise.ts` (NEW)

Smooth navigation of creative parameter spaces:
- Full Perlin noise with seeded permutation tables
- Octave noise with configurable octaves and persistence
- Use in CompostSoup: replace random mutation with Perlin-guided exploration
- 2D and 3D noise for navigating behavior vectors

### 1.8 Upgrade MutationEngine with Beneficial Bias
**source**: `EvoLab/src/genetics/MutationEngine.ts`
**target**: `src/evolution/MutationEngine.ts` (NEW)

Port mutation mechanics:
- Per-trait mutation with configurable rate (15%) and magnitude (±15%)
- Beneficial bias: 10% probability of slight positive push
- Super mutations: rare large-effect mutations with multiplier
- Player-directed modifications: spend "creative points" to guide evolution
- Trait interconnection enforcement after every mutation

### 1.9 Wire into CompostSoup
**Target**: `src/compost/CompostSoup.ts`

Modify `runCycle()` to use:
- `SelectionPressure` for fitness evaluation (instead of raw LLM scoring)
- `TraitSynergies` for emergent quality bonuses
- `SpeciationSystem` for tracking creative lineages
- `PerlinNoise` for smooth parameter exploration
- `MutationEngine` for structured mutations (instead of random seed selection)
- N-dimensional `MapElites` for quality-diversity tracking

---

## Phase 2: Voice + Audio Pipeline

> **Goal**: Complete voice-to-visual pipeline from voice-to-scultpure-app + VoxForge + noise.sh
> **Priority**: HIGH — aligns with existing voice/aesthetic roadmap

### 2.1 Port Voice-to-Shape Mapping
**source**: `voice-to-scultpure-app/src/lib/engine/physicsMapping.ts`
**target**: `src/audio/VoiceToShapeMapper.ts` (NEW)

Port audio-frame-to-generative-output mapping:
- Voice energy → parameter intensity
- Pitch → parameter position (semitone logarithmic scaling)
- Beat detection → impulse deformation (1.2x multiplier with exponential decay)
- Noise gate for silence below threshold
- Formant estimation (F1 openness, F2 frontness) → phonetic geometry

### 2.2 Port Pitch-to-Color Harmony
**source**: `voice-to-scultpure-app/src/lib/audio/audioTheory.ts`
**target**: `src/audio/PitchColorMapper.ts` (NEW)

Musical harmony becomes visual harmony:
- Raw Hz → MIDI note number conversion
- Pitch class to HSL color wheel mapping (12 notes = 30° hue steps)
- C=Red, D=Orange, E=Yellow, F=Green, G=Cyan, G#=Blue, A=Purple, A#=Magenta, Bb=Violet, B=Rose
- Scale quantization (snap pitch to nearest scale degree)
- Mood-based color temperature modulation

### 2.3 Port Multi-Method Pitch Detection
**source**: `VoxForge/lib/audio/pitch-detector.ts`
**target**: `src/audio/PitchDetector.ts` (NEW or enhance existing)

Sophisticated pitch detection pipeline:
- Hann windowing (4096-sample windows, 75% overlap, 256-sample hop)
- Pre-emphasis filter
- Noise profile building from quiet sections
- Multi-method detection with confidence scoring
- Musical post-processing (quantization, smoothing)

### 2.4 Port Prosody Engine
**source**: `noise.sh/internal/app/theory/prosody_engine.go` → convert Go to TypeScript
**target**: `src/audio/ProsodyEngine.ts` (NEW)

Rhythmic text analysis for visual timing:
- Stress lexicon for English words (monosyllabic, trochaic, iambic, dactylic patterns)
- Syllable count per line
- Meter detection (iambic, trochaic, anapestic, dactylic)
- Rhythmic weight per line (for driving visual beat intensity)

### 2.5 Port Mood-to-Palette Mapping
**source**: `noise.sh/internal/app/theory/harmony.go` → convert Go to TypeScript
**target**: `src/audio/MoodPaletteMapper.ts` (NEW)

Mood drives both musical AND visual output:
- happy → C Major + warm bright palette
- sad → A Minor + cool muted palette
- tense → E Phrygian + sharp angular palette
- chill → D Dorian + smooth earth-tone palette
- dreamy → F Lydian + ethereal light palette

### 2.6 Port BPM + Key Detection
**source**: `VoxForge/lib/audio/pitch-detector.ts`, `VoxForge/lib/audio/music-generator.ts`
**target**: `src/audio/BPMKeyDetector.ts` (NEW)

Auto-detect tempo and musical key from audio input:
- BPM detection with confidence scoring
- Key detection (major/minor/relative)
- Integration with existing `PitchUtils.ts`

### 2.7 Port Tone.js Backing Track Generation
**source**: `VoxForge/lib/audio/music-generator.ts`
**target**: `src/audio/BackingTrackGenerator.ts` (NEW)

Generate full arrangements from detected melody:
- Drum patterns (simple/moderate/busy via Tone.MembraneSynth/NoiseSynth/MetalSynth)
- Bass lines (sawtooth following detected key)
- Chord progressions (PolySynth with triangle waves)
- Stem export (individual WAV tracks)

### 2.8 Wire into AudioToVisualMapper
**target**: `src/audio/AudioToVisualMapper.ts`

Enhance the existing mapper to use:
- `VoiceToShapeMapper` for audio→parameter mapping
- `PitchColorMapper` for musically-grounded palettes
- `ProsodyEngine` for text-rhythm-to-visual-timing
- `MoodPaletteMapper` for mood-driven palette selection
- `BPMKeyDetector` for tempo and key context

 Feed into `generateMusicToVisual` in `src/musicToVisual/`

---

## Phase 3: Music Theory Engine

> **Goal**: Complete generative music system from Generative-Score-Lab + lyrics-engine
> **Priority**: HIGH — enhances music/strudel/hydra domains

### 3.1 Port Euclidean Rhythm Generator (Bjorklund's Algorithm)
**source**: `Generative-Score-Lab/src/generators/euclidean.ts`
**target**: `src/music/EuclideanRhythm.ts` (NEW)

Distribute N pulses evenly across M steps:
- Full Bjorklund's algorithm implementation
- Rotation support for pattern variation
- Role-specific mapping (kick, snare, hi-hat, perc)
- Integration with Strudel domain generator

### 3.2 Port Markov Chain Music Generator
**source**: `Generative-Score-Lab/src/generators/markov.ts`
**target**: `src/music/MarkovChain.ts` (NEW)

Train on user input for evolving sequences:
- Order-1 to Order-4 Markov chains
- Transition matrix (Map of state → Map of nextNote -> probability)
- Probabilistic generation by walking the chain
- Fallback to random seed notes when no transitions found

### 3.3 Port Scale + Chord System (14 Scale Types)
**source**: `Generative-Score-Lab/src/theory/scales.ts`, `chords.ts`
**target**: `src/music/TheoryEngine.ts` (NEW)

Complete music theory engine:
- 14 scale types: major, minor, dorian, phrygian, lydian, mixolydian, aeolian, locrian, harmonic minor, melodic minor, pentatonic major, pentatonic minor, blues, chromatic
- MIDI note conversion
- Scale quantization (snap to nearest scale note)
- Chord intervals: major, minor, diminished, augmented, major7, minor7, dominant7
- Chord progression patterns

### 3.4 Port Arpeggiator (5 Modes)
**source**: `Generative-Score-Lab/src/generators/arpeggiator.ts`
**target**: `src/music/Arpeggiator.ts` (NEW)

Five arpeggiation modes:
- up, down, upDown, downUp, random
- Configurable notesPerBeat and octaveRange (1-4 octaves)
- Integration with scale/chord system

### 3.5 Port Rhyme Engine
**source**: `lyrics-engine/lyrics/rhyme_engine.py` → port to TypeScript
**target**: `src/music/RhymeEngine.ts` (NEW)

Text creative tools:
- Perfect rhyme detection (pronouncing dictionary approach)
- Slant rhyme via vowel sound extraction (ARPAbet codes)
- Multi-syllable rhyme matching
- Rhyme scoring: 1.0 (perfect), 0.7 (slant), 0.0 (none)
- Context-aware suggestion ranking

### 3.6 Port Syllable Counter
**source**: `lyrics-engine/lyrics/syllable_counter.py` → port to TypeScript
**target**: `src/music/SyllableCounter.ts` (NEW)

Enforce poetic constraints:
- Primary: hyphenation-based counting
- Fallback: vowel group counting with 'y' handling
- Pattern analysis (per-word syllable counts)
- Constraint validation (target ± tolerance)
- Correction suggestions (expand/contract synonyms)

### 3.7 Port Song Structure Templates
**source**: `lyrics-engine/lyrics/structure.py` → port to TypeScript
**target**: `src/music/StructureTemplates.ts` (NEW)

Creative scaffolds:
- 5 templates: pop, rap, ballad, punk, singer-songwriter
- Generalize to "creative structure templates" for any domain:
  - Visual: sketch → develop → refine → polish
  - Music: intro -> verse → chorus -> bridge → outro
  - Video: establish → build → climax → resolve → credits
- `CreativeSection` type with configurable parameters

### 3.8 Wire into Music Domain
**target**: `src/music/generateMusic.ts`, `src/generators/strudel/`

Integrate all music components:
- `TheoryEngine` for scale/chord knowledge
- `EuclideanRhythm` for rhythmic patterns
- `MarkovChain` for melodic evolution
- `Arpeggiator` for chord voicings
- `RhymeEngine` for text generation in compost
- `SyllableCounter` for text constraint enforcement
- `StructureTemplates` for composition scaffolding

---

## Phase 4: Prompt Architecture + Creative Intelligence

> **Goal**: Sophisticated multi-persona prompt system + user preference learning
> **Priority**: MEDIUM-HIGH

### 4.1 Port 8-Specialized Prompt Architecture
**source**: `Print-OS/caedoapi/ai/prompts.py` → port patterns to TypeScript
**target**: `src/prompts/specialized/` (NEW directory)

8 persona-based prompt modules:
- `evaluation.ts` — temperature 0.25, strict quality assessment
- `forensics.ts` — temperature 0.2, failure analysis for creative output
- `chat.ts` — temperature 0.55, conversational creative guidance
- `summary.ts` — temperature 0.5, concise output summarization
- `marketing.ts` — temperature 0.8, creative description/presentation
- `scheduling.ts` — temperature 0.3, task planning
- `consultant.ts` — temperature 0.6, creative direction
- `design.ts` — temperature 0.3, precise code generation

Each prompt module includes:
- Persona definition (role, expertise, blind spots)
- Temperature tuning
- Anti-hallucination protocol
- JSON schema for structured output
- Grounding requirements
- Forbidden claims/patterns

### 4.2 Port Memory Extraction Service (User Preferences)
**source**: `Print-OS/caedoapi/services/memory_service.py` → port to TypeScript
**target**: `src/brain/CreativePreferenceExtractor.ts` (NEW)

Learn what users like over time:
- Analyze generation history and feedback
- Extract preferences per category (style, color, technique, complexity, mood)
- Importance scoring (0-1) per preference
- Persistent to disk as JSON
- Feed into `PromptEnhancer` and `ContextBuilder`

 for personalized generation

### 4.3 Port Ambiguity Detection
**source**: `FlowCLI/src/flowcli/core/ambiguity.py` → port to TypeScript
**target**: `src/core/AmbiguityDetector.ts` (NEW)

Detect vague creative prompts:
- 4 ambiguity types: vague terms, missing context, contradictions, multiple approaches
- Severity rating (low/medium/high)
- Suggested clarifying questions per type
- Integration into `ChatCLI.tsx` interview flow
 automatic clarification when prompt is vague

### 4.4 Port Cross-Domain Crossover
**source**: `hydra-creative-agent/src/hydra/creative/crossover.py` → port to TypeScript
**target**: `src/evolution/CrossDomainCrossover.ts` (NEW)

Transfer techniques between domains:
- Domain-specific mapping dictionaries (musicↂvisual, code→music, etc.)
- `combineReasoning()` for blending multiple sources
- Integration with `CompostSoup` for cross-pollination between seeds of different domains

### 4.5 Port Symbolic Creative Language
**source**: `hydra-creative-agent/src/hydra/creative/symbolic_language.py` → port to TypeScript
**target**: `src/brain/SymbolicCreativeLanguage.ts` (NEW)

Emergent vocabulary of reusable creative techniques:
- `CreativeSymbol` type with effectiveness tracking (recency-weighted fitness decay)
- Three composition strategies: sequential ("then"), parallel ("and"), hierarchical (base + modifiers)
- Cross-domain symbol transfer
- Vocabulary pruning (remove low-effectiveness symbols)
- Persistent to disk as JSON
- Feed into `CompostMill` as a creative technique vocabulary

### 4.6 Port Prompt Evolution
**source**: `hydra-creative-agent/src/hydra/creative/prompt_evolution.py` → port to TypeScript
**target**: `src/evolution/PromptEvolution.ts` (NEW)

Evolve prompts based on output quality:
- Treat prompts as genotypes (system_prompt, user_prompt_template, parameters)
- Selection: keep top 50% by fitness
- Crossover: word-level splitting and recombination
- Mutation: synonym replacement, numeric adjustment
- Fitness history tracking per prompt lineage
- Integration with `RalphLoop` — prompts evolve across iterations

### 4.7 Wire into Core Systems
**target**: `src/core/RalphLoop.ts`, `src/brain/PromptEnhancer.ts`

Enhance existing systems:
- `RalphLoop.run()`: add `AmbiguityDetector` pre-check on user prompts
- `PromptEnhancer`: integrate `CreativePreferenceExtractor` for personalized enhancement
- `ContextBuilder`: integrate `SymbolicCreativeLanguage` for technique vocabulary injection

---

## Phase 5: Multi-Agent Creative Critique

> **Goal**: Replace single evaluator with deliberating agent panel
> **Priority**: MEDIUM

### 5.1 Implement Creative Board Orchestrator
**source**: `CEO_Agents/src/orchestrator.ts` → port patterns
**target**: `src/collab/CreativeBoard.ts` (NEW)

Multi-agent deliberation for creative evaluation:
- Orchestrator manages multi-round deliberation
- Board members respond in parallel
- Perspectives are synthesized
- Decision: continue deliberation or produce evaluation memo
- Token usage and cost tracking

### 5.2 Define Creative Board Agents
**source**: `CEO_Agents/src/agent.ts` (markdown + frontmatter pattern)
**target**: `src/collab/board-agents/` (NEW directory)

Specialized creative evaluation agents:
- `TheMinimalist.md` — values simplicity, negative space, restraint. Judges on unnecessary complexity
- `TheExpressionist.md` — values emotion, movement, impact. Judges on emotional resonance
- `TheTechnician.md` — values correctness, efficiency, elegance. Judges on code quality
- `TheCurator.md` — values coherence, narrative, intentionality. Judges on overall artistic vision
- `TheInnovator.md` — values novelty, surprise, boundary-pushing. Judges on originality

Each agent defined in markdown with:
- Role, purpose, evaluation lens, key concerns
- Temperament, reasoning patterns, evaluation heuristics
- Domain expertise (specialized per generator domain)

### 5.3 Port Expertise Accumulation
**source**: `CEO_Agents/src/orchestrator.ts` expertise store pattern
**target**: `src/collab/ExpertiseStore.ts` (NEW)

Learn from deliberation rounds:
- Extract insights per evaluation round
- Persist for future sessions
- Three extraction modes: truncate, hybrid (key sentences), LLM summarization
- Integration with `CreativePreferenceExtractor` from Phase 4

### 5.4 Port Structured Evaluation Memos
**source**: `CEO_Agents/src/orchestrator.ts` memo format
**target**: `src/collab/EvaluationMemo.ts` (NEW)

Rich evaluation output:
- Title, brief, decision
- Stances per agent (agree/disagree with reasoning)
- Tensions between agents
- Risks and opportunities
- Actions (specific improvement suggestions with priority)
- Final positions and consensus score
- Integration with `CreativeEvaluator` — replace or augment flat scoring

### 5.5 Wire into CreativeEvaluator
**target**: `src/core/CreativeEvaluator.ts`

Add optional board evaluation mode:
- When enabled, `CreativeEvaluator` delegates to `CreativeBoard` instead of heuristic scoring
- Board evaluation runs in parallel (one LLM call per agent)
- Falls back to heuristic scoring if board evaluation fails or times out
- Board memos stored in gallery alongside iterations

---

## Phase 6: MCP Server + Smart Routing

> **Goal**: Expose Liminal as an MCP server + upgrade routing
> **Priority**: MEDIUM

### 6.1 Implement Liminal MCP Server
**source**: `mcp-video` MCP architecture pattern, `DialectOS/packages/mcp-server/` circuit breaker
**target**: `src/mcp/` (NEW directory)

Expose Liminal's pipeline as MCP tools:

**Tool Categories** (50+ tools):

| Category | Tools |
|----------|-------|
| Generation | `liminal_generate`, `liminal_generate_p5`, `liminal_generate_shader`, `liminal_generate_three`, `liminal_generate_music`, `liminal_generate_hydra`, `liminal_generate_remotion` |
| Compost | `liminal_compost_add`, `liminal_compost_digest`, `liminal_compost_soup_start`, `liminal_compost_soup_stop`, `liminal_compost_seeds_list`, `liminal_compost_seeds_show` |
| Evaluation | `liminal_evaluate`, `liminal_evaluate_aesthetic`, `liminal_evaluate_novelty` |
| Gallery | `liminal_gallery_list`, `liminal_gallery_show`, `liminal_gallery_latest` |
| Evolution | `liminal_evolution_status`, `liminal_evolution_map_elites`, `liminal_evolution_speciate` |
| Audio | `liminal_audio_analyze`, `liminal_audio_pitch_detect`, `liminal_audio_to_visual` |
| Chat | `liminal_chat_start`, `liminal_chat_guide`, `liminal_chat_interview` |

Architecture:
- `server.ts` — MCP server entry point (stdio transport)
- `tools/` — Tool definitions by category
- `resources/` — MCP resources (gallery, compost status, etc.)
- `transport.ts` — stdio/SSE transport configuration

### 6.2 Port Circuit Breaker for LLM Providers
**source**: `DialectOS/packages/providers/` circuit breaker + failover
**target**: `src/llm/CircuitBreaker.ts` (NEW)

Robust LLM provider failover:
- Three states: CLOSED, OPEN, HALF_OPEN
- Failure threshold (configurable, default 5)
- Recovery timeout (configurable, default 30s)
- Automatic failover to next configured provider
- Health check endpoint per provider
- Integration with `LLMClient` — wrap each provider call

### 6.3 Port Smart Routing Engine
**source**: `Print-OS/caedoapi/domain/routing.py` → port weighted scoring
**target**: `src/routing/SmartRouter.ts` (ENHANCE existing)

Upgrade existing SmartRouter with weighted multi-dimensional scoring:
- 5 scoring dimensions:
  - `quality` (0-30): historical output quality for domain
  - `cost` (0-20): cost-efficiency score
  - `speed` (0-20): response latency score
  - `capability` (0-20): model capability match for task type
  - `reliability` (0-10): provider uptime score
- Constraints check: context window fit, domain support, feature support
- Composite score = weighted sum with configurable weights
- `route(task: GenerationTask): LLMProvider` method

### 6.4 Port ML Failure Prediction
**source**: `Print-OS/caedoapi/ml/failure_model.py` → port pattern
**target**: `src/routing/QualityPredictor.ts` (NEW)

Predict creative output quality before committing resources:
- Feature extraction from prompt/context (domain, complexity, prompt length, history)
- Quality prediction (probability of high-quality output)
- Confidence scoring
- Fallback to default routing when prediction confidence is low
- Integration with `SmartRouter` — use prediction to influence routing

### 6.5 Port Batch Processor
**source**: `Print-OS/caedoapi/services/batch_processor.py`
**target**: `src/core/BatchProcessor.ts` (NEW)

Process multiple generation tasks:
- Queue-based processing with concurrency control
- Progress callbacks
- Result aggregation
- Integration with `RalphLoop` for batch creative generation

---

## Phase 7: Supporting Features

> **Goal**: Color theory, glitch effects, style blending, creative workflow
> **Priority**: LOWER — polish and enrichment

### 7.1 Port Color Theory Engine
**source**: `Prism.sh` (Go) → port 7 harmony rules to TypeScript
**target**: `src/aesthetic/ColorTheoryEngine.ts` (NEW)

Complete color harmony system:
- 7 harmony rules: monochromatic, complementary, analogous, triadic, tetradic, split-complementary, square
- HSL generation with ±5° angle precision
- WCAG 2.1 contrast validation (AA/AAA)
- Temperature detection (warm/cool)
- 147 named colors with fuzzy search
- Integration with `ColorHarmonyCritic` — replace heuristic checks with theory-grounded validation

### 7.2 Port Glitch Effects System
**source**: `CyberWitches/js/glitchEffects.js`
**target**: `src/generators/effects/GlitchEffects.ts` (NEW)

Creative visual effects for any domain:
- Screen tearing
- Chromatic aberration (RGB channel separation)
- Scanlines (CRT effect)
- Text corruption/character flicker
- Position jitter
- Opacity flicker
- Distortion waves
- Glitchy gradients
- Integration with video pipeline (`RemotionRenderer`, `VideoExporter`)

### 7.3 Port Progressive Design Tiers
**source**: `CyberWitches` tier system
**target**: `src/evolution/ProgressiveDesignTiers.ts` (NEW)

Evolutionary refinement metaphor:
- Tier 0: raw/glitchy (maximum experimentation)
- Tier 1: emerging structure (some coherence)
- Tier 2: refined (clear artistic direction)
- Tier 3: polished (high quality, minor refinements)
- Tier 4: perfect (museum quality)
- Integration with `RalphLoop` — output tier tracked across iterations
- Tier determines: allowed mutation magnitude, exploration vs exploitation balance, quality gate thresholds

### 7.4 Port Genre/Style Blending
**source**: `GameStory-Lab` weighted blending + `GlazeLab` compatibility scoring
**target**: `src/brain/StyleBlender.ts` (NEW)

Blend art styles with compatibility awareness:
- Weighted mixing (e.g., 70% minimalist + 30% baroque)
- Style compatibility scoring (0-1, with hard rules for known clashes)
- Smart merging preserves primary style characteristics
- Blend result description for prompt enhancement

### 7.5 Port Fabrication Constraints
**source**: `voice-to-scultpure-app` constraint engine + `Pottery-App` parametric profiles
**target**: `src/core/CreativeConstraints.ts` (NEW)

Real-world constraints on creative output:
- Target platform constraints (web, print, video, mobile)
- Performance budgets (frame time, file size, complexity)
- Accessibility requirements (WCAG contrast, readable text)
- Domain-specific rules (shader compilation, p5 interactivity)

### 7.6 Port Creative Workflow Stages
**source**: `cerafica` stage-based pipeline + `research-pipeline-prod` 7-stage pipeline
**target**: `src/core/CreativeWorkflow.ts` (NEW)

Structured creative process beyond just generation:
- Stage 1: **Gather** — collect inspiration, references, constraints
- Stage 2: **Plan** — define approach, select techniques, set parameters
- Stage 3: **Generate** — run RalphLoop with enhanced context
- Stage 4: **Refine** — iterative improvement with natural language
- Stage 5: **Repurpose** — adapt output for different formats/domains
- State persisted between stages (pause/resume)

### 7.7 Port Chemistry-Inspired Generators
**source**: `GlazeLab/openglaze/core/chemistry/` UMF + compatibility
**target**: `src/generators/chemistry/` (NEW directory)

Unique generative aesthetic from ceramic chemistry:
- `ChemistryMapper.ts` — oxide percentages → visual parameters (silica=smooth gradients, iron=warm tones)
- `CompatibilityScorer.ts` — style layering compatibility (hard rules + soft scoring)
- `GlazeGenerator.ts` — chemistry-informed color and texture generation

### 7.8 Port Multi-Provider Vision Pipeline
**source**: `tarot-content-creator/server/providers/` + `Generative-Assets-Lab` image processing
**target**: `src/llm/VisionClient.ts` (NEW)

Image-to-art generation:
- Multi-provider vision AI (Gemini, OpenAI, local Ollama)
- Image upload → analysis → creative parameter extraction
- Reference image integration in `ContextBuilder`
- Image processing pipeline (resize, compress, normalize)

### 7.9 Port Gamification System
**source**: `GlazeLab` badges/streaks + `EvoLab` DNA points + `CyberWitches` element specialization
**target**: `src/core/Gamification.ts` (NEW)

Motivate creative exploration:
- Badges: "First Evolution", "Cross-Domain Pioneer", "100 Generations", "Perfect Score"
- Streaks: daily creative practice tracking
- DNA Points: spend to direct evolution toward desired traits
- Specialization trees: choose creative paths (Visual Master, Audio Alchemist, Code Artisan)

---

## Implementation Notes

### Porting Strategy
- **Python → TypeScript**: All algorithms from Python repos (hydra-creative-agent, lyrics-engine, mcp-video, FlowCLI, Print-OS, etc.) need TypeScript ports. Focus on algorithm fidelity, not line-by-line translation.
- **Go → TypeScript**: noise.sh prosody engine, Prism.sh color theory, focus.sh themes. Convert Go structs to TypeScript interfaces.
- **Reuse existing interfaces**: All new modules must integrate with Liminal's existing `LLMClient`, `Gallery`, `CompostMill`, `CreativeEvaluator`, and domain generator interfaces.

### Testing Strategy
- Port each algorithm with its original test suite adapted to Liminal's test framework
- Add integration tests for each Phase's wiring into existing systems
- Verify each Phase end-to-end: CLI command → pipeline → output

### Dependencies to Add
``json
{
  "tone": "^14.x",          // Phase 2: backing track generation (already in EvoLab/Generative-Score-Lab)
  "pronouncing": "^2.x",   // Phase 3: rhyme engine (or port algorithm without dependency)
  "pitchfinder": "^2.x"    // Phase 2: pitch detection (or port VoxForge's implementation)
}
```

### File Count Estimate
- Phase 1: 7 new files, 2 modified
- Phase 2: 6 new files, 1 modified
- Phase 3: 7 new files, 1 modified
- Phase 4: 7 new files, 2 modified
- Phase 5: 5 new files, 1 modified
- Phase 6: 5 new files, 2 modified
- Phase 7: 9 new files, 0 modified
- **Total: ~46 new files, ~9 modified files**

---

## Verification Checklist

After each phase, verify:
- [ ] `pnpm build` passes with no type errors
- [ ] `pnpm test` passes with no regressions
- [ ] New features accessible via CLI (`liminal --help` shows new commands)
- [ ] New modules wired end-to-end (input → processing → output)
- [ ] Gallery persistence works (save/load round-trip)
- [ ] LLM integration works (mock or real provider)
- [ ] No console.log leaks or TODO stubs in production code
