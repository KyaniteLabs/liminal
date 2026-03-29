import type { AudioFeatures, PitchData, TimbreData, VisualMappingParams } from './types.js';
import { frequencyToScaleColor, scaleToPalette, type HSLColor } from './PitchColorMapper.js';
import { estimateFormants, formantsToGeometry } from './FormantAnalyzer.js';
import { detectBPM, detectKey } from './BPMKeyDetector.js';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min), 0, 1);
}

const DEFAULT_TIMBRE: TimbreData = { brightness: 0.5, roughness: 0.3, warmth: 0.5, noisiness: 0.2 };

export function mapToVisualParams(
  features: AudioFeatures,
  pitch: PitchData | null,
  timbre: TimbreData = DEFAULT_TIMBRE,
  /** Accumulated RMS history for BPM detection (optional) */
  rmsHistory?: number[],
  /** Hop duration in seconds between RMS frames (default 0.01) */
  hopDuration?: number,
): VisualMappingParams {
  // --- Palette: pitch-color mapping with scale quantization ---
  const keyResult = detectKey(Array.from(features.chroma));
  const scaleName = keyResult.mode === 'minor' ? 'minor' : 'major';
  const paletteColors: HSLColor[] = pitch
    ? [
        frequencyToScaleColor(pitch.frequency, scaleName, keyResult.root),
        frequencyToScaleColor(pitch.frequency * 1.5, scaleName, keyResult.root),  // fifth up
        frequencyToScaleColor(pitch.frequency * 1.25, scaleName, keyResult.root), // third up
      ]
    : scaleToPalette(scaleName, keyResult.root);

  const saturationBase = normalize(1 - features.spectralFlatness, 0, 1);
  const lightnessBase = normalize(features.spectralCentroid, 500, 8000);

  const palette = {
    hues: paletteColors.map(c => c.h / 360),  // normalize 0-360 → 0-1
    saturations: paletteColors.map((c, i) =>
      i === 0 ? clamp(saturationBase * 0.8 + 0.1, 0, 1) : clamp(c.s * 0.9, 0, 1)
    ),
    lightness: paletteColors.map((c, i) =>
      clamp(lightnessBase * 0.4 + c.l * 0.4 + i * 0.05, 0, 1)
    ),
  };

  // Motion
  const turbulence = normalize(features.spectralFlux, 0, 1);
  const speed = normalize(features.rms * 3, 0, 1);  // RMS-proportional speed
  const rhythm: 'smooth' | 'pulsing' | 'chaotic' =
    turbulence < 0.3 ? 'smooth' : turbulence < 0.7 ? 'pulsing' : 'chaotic';

  const motion = { speed, turbulence, rhythm };

  // Form: formant analysis for shape modulation
  const formants = estimateFormants(features.mfcc);
  const geometry = formantsToGeometry(formants);

  const form = {
    complexity: normalize(timbre.noisiness * 0.3 + geometry.taperRatio * 0.3 + formants.openness * 0.4, 0, 1),
    sharpness: normalize(1 - features.spectralFlatness, 0, 1),
    scale: normalize(features.rms, 0, 1),
  };

  // Dynamics
  const dynamics = {
    energy: normalize(features.rms, 0, 1),
    envelope: [features.rms, features.energy, features.loudness / -60].map(v => clamp(v, 0, 1)),
    onsets: [] as number[]
  };

  // Composition: BPM/key for structural decisions
  const tempo = rmsHistory && rmsHistory.length >= 10
    ? detectBPM(rmsHistory, hopDuration ?? 0.01)
    : null;

  const composition = {
    focalWeight: clamp(normalize(features.rms + features.spectralFlux, 0, 2), 0, 1),
    balance: clamp(0.5 + (1 - Math.abs(features.spectralCentroid / 8000 - 0.5)) * 0.3, 0, 1),
  };

  // Suppress unused-variable warnings for tempo/key metadata
  void tempo;
  void keyResult;

  return { palette, motion, form, dynamics, composition };
}
