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
