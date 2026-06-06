/**
 * SemanticMapper — translates a rich voice frame (+ vibrato) into a perceptual
 * visual state that presets bind to. This is the expressive vocabulary: voice
 * dimensions → palette / form / motion / texture / density / composition, so
 * singing drives rich mutation instead of scaling a single uniform.
 *
 * Output channels are all normalized 0–1 (hue is a normalized turn, 0–1 wrapped).
 */
import { pitchClassToHue } from './PitchColorMapper.js';
import { formantsToGeometry, type PhonemeCategory } from './FormantAnalyzer.js';
import type { VoiceFeatureFrame } from './VoiceFeatureStream.js';
import type { VibratoEstimate } from './dsp/VibratoTracker.js';

export interface SemanticVisualState {
  palette: { hue: number; saturation: number; value: number; accentHue: number };
  form: { family: number; complexity: number; symmetry: number; sharpness: number };
  motion: { flow: number; turbulence: number; shimmer: number };
  texture: { grain: number; glow: number; softness: number };
  density: { coverage: number; spawn: number };
  composition: { scale: number; focalY: number; depth: number };
}

/** Vowel category → a normalized "form family" position (0–1). */
const VOWEL_FAMILY: Record<PhonemeCategory, number> = {
  'closed-front': 0,
  'open-front': 1 / 3,
  'open-back': 2 / 3,
  'closed-back': 1,
  neutral: 0.5,
};

const RMS_MIN = 0.015;
const RMS_MAX = 0.16;
const VIBRATO_MAX_DEPTH_CENTS = 60;
const VIBRATO_MAX_RATE_HZ = 8;

export function mapVoiceToSemantic(
  frame: VoiceFeatureFrame,
  vibrato: VibratoEstimate = { rate: 0, depth: 0 },
): SemanticVisualState {
  const rmsNorm = norm(frame.rms, RMS_MIN, RMS_MAX);
  const voiced = frame.voiced ? 1 : 0;
  const brightness = clamp01(frame.brightness);
  const breathiness = clamp01(frame.breathiness);
  const hue = wrap01(safe(pitchClassToHue(frame.pitchClass)) / 360);
  const geometry = formantsToGeometry(frame.formants);
  const octaveNorm = norm(frame.octave, 2, 6);
  const shimmer = clamp01((safe(vibrato.depth) / VIBRATO_MAX_DEPTH_CENTS) * (safe(vibrato.rate) / VIBRATO_MAX_RATE_HZ));

  return {
    palette: {
      hue,
      saturation: clamp01(0.35 + 0.5 * voiced),
      value: clamp01(0.3 + 0.7 * brightness),
      accentHue: wrap01(hue + 0.5),
    },
    form: {
      family: VOWEL_FAMILY[frame.vowel] ?? 0.5,
      complexity: clamp01(frame.formants?.openness ?? 0.5),
      symmetry: clamp01(frame.confidence),
      sharpness: clamp01(1 - geometry.roundness),
    },
    motion: {
      flow: rmsNorm,
      turbulence: breathiness,
      shimmer,
    },
    texture: {
      grain: breathiness,
      glow: brightness,
      softness: clamp01(geometry.roundness),
    },
    density: {
      coverage: rmsNorm,
      spawn: frame.onset ? 1 : 0,
    },
    composition: {
      scale: octaveNorm,
      focalY: clamp01(0.2 + 0.6 * octaveNorm),
      depth: rmsNorm,
    },
  };
}

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function norm(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function wrap01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
}
