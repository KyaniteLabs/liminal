# Changelog

All notable changes to this project will be documented in this file.

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
