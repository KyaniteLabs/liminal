# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added — Self-Hosting Task Ledger (Phase 9–10)
- `src/ledger/` — Complete task management system with corpus, runner, and verifier
- TaskRunner: Executes tasks from corpus with shell-free security (`execFileSync`)
- TaskVerifier: Validates results with metacharacter guard + prefix whitelist
- Task corpus: Curated task definitions with approval workflow
- CLI: `liminal ledger list|show|run|verify|accept|reject|status`
- Autonomous development conveyor: Phase 10 pipeline for self-directed task execution

### Added — LiminalFS (Filesystem Substrate)
- `src/fs/` — Unified filesystem facade over ProjectStore, EventStore, AssetStore
- SeedFSAdapter, TraceFSAdapter, GalleryFSAdapter: Bridge existing modules to LiminalFS
- LoopPersistence: RalphLoop writes generation runs to LiminalFS
- OrganismLoop: Wired to LiminalFS for persistent organism state
- CLI: `liminal fs artifacts|refs|runs` subcommands

### Added — Guardrails M12–M18
- Compliance guardrails layer (correctness, hygiene, observation, remediation)
- `src/guardrails/` restructured into domain-specific subdirectories
- 7 new guardrail rules covering runtime health, accessibility, and semantic checks

### Added — Thinking-Trace Feedback Loop
- ReasoningCapture: Extracts model thinking from LLM responses
- ThinkingSeparation: Keeps generator and harness thinking in separate namespaces
- MetaHarnessIntegration: Analyzes generator thinking to improve prompts and routing
- ModelBehaviorPatterns: Long-term pattern detection across sessions

### Added — DF3 Phases 6–8
- Intuition scoring dimension (`--intuition` flag)
- Entropy measurement for generation diversity
- Evolution-based generation improvement

### Changed
- Structured logger replaces console.log throughout harness and core modules
- CI pipeline optimized: removed setup-node, enabled caches, switched to thread pool
- Bubble Tea TUI is now the primary interactive interface
- Coverage ratchet targeting 70% across all metrics (currently ~68.6% statements)

### Fixed
- repairAdvice dropout in multi-candidate RalphLoop evaluation
- Strudel regex typo causing false validation failures
- Candidate telemetry using filtered-array position instead of original index
- `rankCandidates` crash on empty evaluations
- SQLite runtime DB accidentally tracked in git

### Removed
- Archaeology pipeline extracted to separate `dev-archaeology` repo
- Stale root-level audit reports moved to `docs/internal/`

---

## [2.1.0] - 2026-04-01

### Added — Meta-Harness (Self-Improving Infrastructure)
- FailureLogger: Captures all failures with rich context (model, domain, prompt, error, thinking)
  - Auto-saves to `~/.liminal/failures/{id}.json`
  - FailureRecord schema: id, timestamp, sessionId, model, domain, prompt, code, error, errorType, validationErrors, thinking, duration
- PatternDetector: Analyzes failures to detect recurring patterns
  - 6 known patterns from dogfooding: qwen-thinking-trap, glsl-undefined-function, tone-hallucinated-api, strudel-tidal-confusion, ascii-timeout, html-404-error
  - Pattern interface with detector functions, occurrence tracking, affected models/domains
- HarnessUpdater: Applies adaptations based on detected patterns
  - Automatic adaptation tracking with HarnessAdaptation interface
  - Report generation with harnessUpdater.generateReport()
- Exports via `src/harness/index.ts`: failureLogger, patternDetector, harnessUpdater

### Added — Model-Specific Adaptations
- Qwen model detection and simplified prompts
  - Auto-detects Qwen models via model name matching
  - Uses simplified system/user prompts to avoid "thinking trap"
  - Extracts code from thinking field if response is empty
- Ollama native API support
  - Added `apiStyle: 'ollama'` config option
  - Bypasses OpenAI-compatible endpoint issues
  - Direct `/api/generate` endpoint usage

### Added — Domain Validation Enhancements
- GLSL semantic validation
  - Catches undefined functions (noise, fbm, hash without definitions)
  - Detects invalid operators (`%` instead of mod())
  - Function call vs definition tracking
- Tone.js API whitelist validation
  - Validates Tone.* class names against known API
  - Catches hallucinated classes (Reverberator, DrivingPattern, ReverbNode)
  - Suggests closest valid class names
- Strudel prompt with working examples and anti-patterns
  - 5 working code examples
  - Anti-patterns section: NEVER use Haskell `$`, NEVER write `d1 $`, NEVER bare `s("bd")`
  - Distinguishes Strudel JavaScript from TidalCycles Haskell

### Changed — Generator Architecture
- **BREAKING**: Removed all template fallbacks from P5Generator
  - Deleted: ParticleSystem, CellularAutomata, FlowField templates
  - P5Generator now forces LLM path exclusively
  - All p5 generation uses P5GeneratorLLM with model-specific prompts
- Raised confidence scores for domain routing
  - three.js: 0.5 → 0.95
  - strudel: 0.6 → 0.95
  - Prevents misrouting to generic generators

### Fixed
- Qwen3.5 family complete failure on complex prompts
  - Root cause: "thinking trap" consuming all tokens without outputting code
  - Solution: Simplified prompts for Qwen models
- ASCII generator 404 errors on some models
- HTML generator endpoint routing issues
- GLSL generator using undefined noise functions
- Tone.js generator hallucinating non-existent APIs
- Strudel generator confusing TidalCycles vs Strudel syntax

### Documentation
- Added comprehensive Meta-Harness section to architecture docs

---

## [0.2.0] - 2026-03-29

### Added — LIR Evaluation Integration
- GeneratedCodeParser: wraps CodeParser for ephemeral generated code parsing into LIRCodeToken[]
- lirEnabled flag in LoopOptions, cascading to compost config when set
- AestheticCritic dual-path: LIR-aware critique when lirTokens available, regex fallback otherwise
- CreativeEvaluator.assessWithLIR(): overlays LIR metrics (LOC, complexity, nesting, call graph) on regex baseline
- ScoringEngine and AestheticStrategy thread lirContext through evaluation pipeline
- RalphLoop wires GeneratedCodeParser after code generation, passes LIR context to all critics

### Added — Enhanced Evolutionary Engine
- FitnessCombiner: multi-axis weighted fitness (novelty 40%, quality 30%, technical 20%, diversity 10%)
- MAP-Elites N-dimensional: upgraded from 2D to N-dim quality-diversity optimization
- PerlinNoise utility: gradient noise for natural parameter variation in evolutionary search

### Added — Voice + Audio Pipeline
- VoiceToShapeMapper: energy->radius, pitch->height (semitone log scaling), onset->radial bump
- PitchColorMapper: 12 pitch classes -> 30 degree chromatic-circle hue steps, 8 scale palettes, quantization
- FormantAnalyzer: MFCC-based F1/F2 estimation, phoneme-to-geometry mapping
- PitchDetector: autocorrelation F0 with pre-emphasis and Hann windowing
- BPMKeyDetector: onset autocorrelation tempo detection, Krumhansl-Schmuckler key detection
- AudioToVisualMapper updated: pitch-class palettes, formant complexity, tempo/composition mapping

### Added — Music Theory Engine
- EuclideanRhythm: Bjorklund's algorithm for polyrhythmic pattern generation
- MarkovChain: order 1-4 transition matrix melody generation from seed melodies
- TheoryEngine: 14 scales, 7 chord types, MIDI conversion, quantization, diatonic progressions
- Arpeggiator: 5 modes (up/down/upDown/downUp/random) with configurable params
- RhymeEngine: vowel-group-based rhyme classification and scoring
- SyllableCounter: syllable constraint validation for lyric generation
- StructureTemplates: 5 song structure templates (pop/rap/ballad/punk/singer-songwriter)

### Added — Prompt Architecture + Creative Intelligence
- Evaluation prompt: 5-dimension scoring with anti-hallucination
- Chat prompt: creative coding assistant with grounding rules and structured JSON responses
- Design prompt: CLARIFY/DELIVERY modes with performance constraints
- CreativePreferenceExtractor: keyword-based style/color/technique extraction
- AmbiguityDetector: 4 detection strategies
- CrossDomainCrossover: bidirectional technique transfer between domains
- SymbolicCreativeLanguage: emergent vocabulary with effectiveness tracking

### Added — Multi-Agent Creative Critique
- CreativeBoard: 3-agent heuristic deliberation panel (Minimalist/Expressionist/Technician)
- EvaluationMemo: builder-pattern structured evaluation reports
- CreativeEvaluator.assessWithBoard(): blends 60% baseline + 40% board aggregate score

### Added — Smart Routing + Circuit Breaker
- CircuitBreaker: provider failover with closed/open/half-open state machine
- QualityPredictor: heuristic model routing based on prompt complexity and domain history
- BatchProcessor: generic queue-based processor with concurrency control and retry support

### Added — Supporting Creative Features
- ColorTheoryEngine: 7 harmony rules
- GlitchEffects: p5.js glitch effect code generation
- ProgressiveDesignTiers: 5-tier progression with score thresholds
- StyleBlender: weighted style profile mixing with interpolation
- CreativeConstraints: web/mobile/print constraint presets
- CreativeWorkflow: 4-stage pipeline (gather/plan/create/refine)

---

## [0.1.0] - 2026-03-29

### Added
- Voice/singing audio input pipeline (Meyda + pitchfinder)
  - AudioAnalyzer orchestrator chaining extract, pitch detection, timbre extraction
  - AudioToVisualMapper mapping audio features to visual parameters
  - Audio feature types (AudioFeatures, PitchData, TimbreData, AudioAnalysisResult, VisualMappingParams)
  - Pitch utility functions (frequency/MIDI/note name conversion, frequency clamping)
- Aesthetic guardrails system (4 static critics + orchestrator)
  - ColorHarmonyCritic: hex/rgb/hsl/named color extraction, harmony analysis
  - LayoutCritic: canvas dimension extraction, position validation, centering detection
  - TypographyCritic: font size bounds, unloaded font detection
  - SoundHarmonyCritic: frequency extraction, interval consonance, gain warning
  - AestheticCritic orchestrator running all critics with aggregated scoring
  - AestheticStrategy ScoringStrategy plugin for ScoringEngine
  - 5 preset profiles: minimalist, vibrant, cinematic, playful, free
- RalphLoop integration: aesthetic quality gate applies score penalties and violation feedback
- LoopConfig extensions: useAestheticGuardrails, aestheticConfig, visualMappingParams options
- ContextBuilder: audio-derived visual parameter injection into generation context
- CLI flags: --voice, --voice-file, --aesthetic, --aesthetic-config
- Prompt library entries: audio.voice-to-visual, aesthetic.constraints
- CreativeBrief extensions: audioPreference, designConstraints, visualParameters fields
- InterviewPhase: audioPreference + aestheticPreset discovery questions
- Domain type extended with 'voice'
- Barrel exports for all audio and aesthetic modules from src/index.ts
- Dependencies: meyda, pitchfinder
