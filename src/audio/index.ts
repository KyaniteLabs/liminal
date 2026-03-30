// Barrel exports for the audio analysis module.

export { AudioAnalyzer } from './AudioAnalyzer.js';

export type {
  AudioFeatures,
  PitchData,
  TimbreData,
  AudioAnalysisResult,
  VisualMappingParams,
  PaletteParams,
  MotionParams,
  FormParams,
  DynamicsParams,
  CompositionParams,
} from './types.js';

export { mapToVisualParams } from './AudioToVisualMapper.js';
export { extractFeatures } from './AudioExtractor.js';
export { detectPitch } from './PitchExtractor.js';
export { extractTimbre } from './TimbreExtractor.js';
export { frequencyToMidi, frequencyToNoteName, midiToFrequency, clampFrequency } from './PitchUtils.js';

// Voice + Audio Pipeline (Phase 2)
export { mapVoiceToShape, mapVoiceToShapeSequence } from './VoiceToShapeMapper.js';
export type { ShapeParams, LatheProfile } from './VoiceToShapeMapper.js';
export {
  frequencyToColor,
  frequencyToScaleColor,
  quantizeToScale,
  scaleToPalette,
  pitchClassToHue,
  pitchClassName,
  midiToPitchClass,
  NOTE_NAMES,
  SCALES,
} from './PitchColorMapper.js';
export type { HSLColor, NoteName } from './PitchColorMapper.js';
export { estimateFormants, formantsToGeometry } from './FormantAnalyzer.js';
export type { FormantData, PhonemeCategory } from './FormantAnalyzer.js';
export { detectPitch as detectPitchAC } from './PitchDetector.js';
export type { PitchDetectionResult } from './PitchDetector.js';
export { detectBPM, detectKey } from './BPMKeyDetector.js';
export type { TempoResult, KeyResult } from './BPMKeyDetector.js';
