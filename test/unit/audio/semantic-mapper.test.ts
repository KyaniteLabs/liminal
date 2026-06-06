import { describe, expect, it } from 'vitest';
import { mapVoiceToSemantic, type SemanticVisualState } from '@liminal/audio-core/SemanticMapper.js';
import type { VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';
import type { FormantData } from '@liminal/audio-core/FormantAnalyzer.js';

const formants: FormantData = {
  f1: 500,
  f2: 1500,
  openness: 0.5,
  frontness: 0.5,
  phonemeCategory: 'neutral',
};

function frame(overrides: Partial<VoiceFeatureFrame> = {}): VoiceFeatureFrame {
  return {
    rms: 0.08,
    pitchHz: 220,
    centroid: 0.4,
    spectralFlux: 0.01,
    onset: false,
    voiced: true,
    confidence: 0.9,
    pitchClass: 0,
    octave: 4,
    brightness: 0.5,
    breathiness: 0.2,
    formants,
    vowel: 'neutral',
    capturedAt: 0,
    spectrum: new Float32Array(0),
    ...overrides,
  };
}

function allChannels(s: SemanticVisualState): number[] {
  return [
    ...Object.values(s.palette),
    ...Object.values(s.form),
    ...Object.values(s.motion),
    ...Object.values(s.texture),
    ...Object.values(s.density),
    ...Object.values(s.composition),
  ];
}

describe('mapVoiceToSemantic', () => {
  it('rotates palette hue with pitch class (class 6 → hue 0.5)', () => {
    expect(mapVoiceToSemantic(frame({ pitchClass: 0 })).palette.hue).toBeCloseTo(0, 5);
    expect(mapVoiceToSemantic(frame({ pitchClass: 6 })).palette.hue).toBeCloseTo(0.5, 5);
  });

  it('fires density.spawn on an onset and not otherwise', () => {
    expect(mapVoiceToSemantic(frame({ onset: true })).density.spawn).toBe(1);
    expect(mapVoiceToSemantic(frame({ onset: false })).density.spawn).toBe(0);
  });

  it('raises motion.shimmer with vibrato depth and rate', () => {
    const still = mapVoiceToSemantic(frame(), { rate: 0, depth: 0 });
    const wobble = mapVoiceToSemantic(frame(), { rate: 6, depth: 40 });
    expect(still.motion.shimmer).toBe(0);
    expect(wobble.motion.shimmer).toBeGreaterThan(0.4);
  });

  it('maps brightness to palette value and texture glow', () => {
    const dark = mapVoiceToSemantic(frame({ brightness: 0 }));
    const bright = mapVoiceToSemantic(frame({ brightness: 1 }));
    expect(bright.palette.value).toBeGreaterThan(dark.palette.value);
    expect(bright.texture.glow).toBeGreaterThan(dark.texture.glow);
  });

  it('keeps every channel within [0,1]', () => {
    for (const v of allChannels(mapVoiceToSemantic(frame({ rms: 1, brightness: 1, breathiness: 1 })))) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('produces finite, clamped output even for NaN/Infinity inputs', () => {
    const s = mapVoiceToSemantic(frame({ rms: NaN, brightness: Infinity, pitchClass: NaN, octave: NaN }));
    for (const v of allChannels(s)) expect(Number.isFinite(v)).toBe(true);
  });
});
