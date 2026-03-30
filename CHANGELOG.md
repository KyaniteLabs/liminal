# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-03-29

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
- VoiceToShapeMapper: energy→radius, pitch→height (semitone log scaling), onset→radial bump
- PitchColorMapper: 12 pitch classes → 30° chromatic-circle hue steps, 8 scale palettes, quantization
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
- generateMusic barrel re-exports all music modules via MusicTheory object

### Added — Prompt Architecture + Creative Intelligence
- Evaluation prompt: 5-dimension scoring (technical/aesthetic/novelty/emergence/interestingness) with anti-hallucination
- Chat prompt: creative coding assistant with grounding rules and structured JSON responses
- Design prompt: CLARIFY/DELIVERY modes with performance constraints
- CreativePreferenceExtractor: keyword-based style/color/technique extraction with confidence scoring
- AmbiguityDetector: 4 detection strategies (vague terms, missing context, contradictions, multiple approaches)
- CrossDomainCrossover: bidirectional technique transfer between visual/audio/code/music/shader/3d
- SymbolicCreativeLanguage: emergent vocabulary with effectiveness tracking, 3 composition strategies
- PromptEnhancer: preference-aware enhancement using CreativePreferenceExtractor
- RalphLoop: pre-generation ambiguity check with severity-based warning logging

### Added — Multi-Agent Creative Critique
- CreativeBoard: 3-agent heuristic deliberation panel (Minimalist/Expressionist/Technician)
- Board agents: TheMinimalist.md, TheExpressionist.md, TheTechnician.md persona definitions
- EvaluationMemo: builder-pattern structured evaluation reports with formatMemo() and summarizeMemos()
- CreativeEvaluator.assessWithBoard(): blends 60% baseline + 40% board aggregate score
- Board deliberation: tension extraction, consensus points, risk identification, recommended actions

### Added — Smart Routing + Circuit Breaker
- CircuitBreaker: provider failover with closed/open/half-open state machine
- QualityPredictor: heuristic model routing based on prompt complexity and domain history
- BatchProcessor: generic queue-based processor with concurrency control and retry support

### Added — Supporting Creative Features
- ColorExtractor: hex/rgb/hsl/named color parsing from code strings
- ColorTheoryEngine: 7 harmony rules (monochromatic/analogous/complementary/split-complementary/triadic/tetradic/square)
- GlitchEffects: p5.js glitch effect code generation (scanlines, chromatic aberration, distortion, noise)
- ProgressiveDesignTiers: 5-tier progression (glitch→basic→functional→refined→perfect) with score thresholds
- StyleBlender: weighted style profile mixing with interpolation
- CreativeConstraints: web/mobile/print constraint presets with validation
- CreativeWorkflow: 4-stage pipeline (gather→plan→create→refine)

### Changed
- CompostSoup: integrated FitnessCombiner and N-dim MAP-Elites
- AudioToVisualMapper: pitch now uses chromatic-circle mapping instead of linear frequency scaling
- PromptLibrary: 36 prompts registered (added chat.assistant, audio.voice-to-visual, aesthetic.constraints)
- All prompts at version 2.0.0

## [0.1.0.0] - 2026-03-29

### Added
- Voice/singing audio input pipeline (Meyda + pitchfinder)
  - AudioAnalyzer orchestrator chaining extract, pitch detection, timbre extraction
  - AudioToVisualMapper mapping audio features to visual parameters (hue, energy, rhythm)
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

### Changed
- Existing ConversationManager test updated to account for new interview discovery questions
