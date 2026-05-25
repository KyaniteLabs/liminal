/**
 * Audio feature types for the Liminal audio analysis pipeline.
 *
 * These types define the data structures produced by audio analysis
 * (Meyda, pitchfinder) and consumed by the audio-to-visual mapper.
 */

/** Core audio features extracted from a single analysis frame. */
export interface AudioFeatures {
  /** Root mean square amplitude (0-1). */
  rms: number;
  /** Total signal energy. */
  energy: number;
  /** Spectral centroid in Hz (brightness indicator). */
  spectralCentroid: number;
  /** Spectral flatness (0 = tonal, 1 = noisy). */
  spectralFlatness: number;
  /** Zero crossing rate (noisiness indicator). */
  zcr: number;
  /** Mel-frequency cepstral coefficients. */
  mfcc: number[];
  /** Perceived loudness in dB. */
  loudness: number;
  /** Rate of spectral change between frames. */
  spectralFlux: number;
  /** Chroma vector (12 pitch classes). */
  chroma: Float32Array;
  /** Perceptual sharpness (0-1). */
  perceptualSharpness: number;
}

/** Pitch detection result for a single frame. */
export interface PitchData {
  /** Detected fundamental frequency in Hz. */
  frequency: number;
  /** Clarity/confidence of pitch detection (0-1). */
  clarity: number;
  /** MIDI note number (69 = A4). */
  midi: number;
  /** Human-readable note name (e.g. "A4", "C#3"). */
  noteName: string;
}

/** Timbre characteristics derived from spectral features. */
export interface TimbreData {
  /** Brightness: ratio of high-frequency energy (0-1). */
  brightness: number;
  /** Roughness: sensory dissonance measure (0-1). */
  roughness: number;
  /** Warmth: low-frequency emphasis (0-1). */
  warmth: number;
  /** Noisiness: noise-to-tone ratio (0-1). */
  noisiness: number;
}

/** Complete audio analysis result for a single frame. */
export interface AudioAnalysisResult {
  /** Core spectral/temporal features. */
  features: AudioFeatures;
  /** Pitch detection result, or null if no clear pitch. */
  pitch: PitchData | null;
  /** Timbre characteristics. */
  timbre: TimbreData;
  /** Timestamp of this analysis frame in ms. */
  timestamp: number;
}

/** Visual mapping palette parameters. */
export interface PaletteParams {
  /** Hue values (0-1 range). */
  hues: number[];
  /** Saturation values (0-1 range). */
  saturations: number[];
  /** Lightness values (0-1 range). */
  lightness: number[];
}

/** Visual mapping motion parameters. */
export interface MotionParams {
  /** Movement speed (0-1). */
  speed: number;
  /** Turbulence/chaos factor (0-1). */
  turbulence: number;
  /** Motion rhythm style. */
  rhythm: 'smooth' | 'pulsing' | 'chaotic';
}

/** Visual mapping form parameters. */
export interface FormParams {
  /** Shape complexity (0-1). */
  complexity: number;
  /** Edge sharpness (0 = soft, 1 = hard). */
  sharpness: number;
  /** Scale factor (0-1). */
  scale: number;
}

/** Visual mapping dynamics parameters. */
export interface DynamicsParams {
  /** Overall energy level (0-1). */
  energy: number;
  /** Amplitude envelope samples. */
  envelope: number[];
  /** Onset timestamps in ms. */
  onsets: number[];
}

/** Visual mapping composition parameters. */
export interface CompositionParams {
  /** Focal point visual weight (0-1). */
  focalWeight: number;
  /** Left-right balance (0 = left, 0.5 = center, 1 = right). */
  balance: number;
}

/** Mapped visual parameters derived from audio analysis. */
export interface VisualMappingParams {
  /** Color palette mapping. */
  palette: PaletteParams;
  /** Motion/animation mapping. */
  motion: MotionParams;
  /** Shape/form mapping. */
  form: FormParams;
  /** Dynamics/energy mapping. */
  dynamics: DynamicsParams;
  /** Composition/layout mapping. */
  composition: CompositionParams;
}
