import { describe, expect, it } from 'vitest';
import { mapSingPresetUniforms, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';
import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';
import { OneEuroFilter } from '../../../packages/audio-core/src/dsp/OneEuroFilter.js';
import type { SemanticVisualState } from '../../../packages/audio-core/src/SemanticMapper.js';

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
}

function semantic(shimmer: number): SemanticVisualState {
  return {
    palette: { hue: 0, saturation: 0, value: 0, accentHue: 0 },
    form: { family: 0, complexity: 0, symmetry: 0, sharpness: 0 },
    motion: { flow: 0, turbulence: 0, shimmer },
    texture: { grain: 0, glow: 0, softness: 0 },
    density: { coverage: 0, spawn: 0 },
    composition: { scale: 0, focalY: 0, depth: 0 },
  };
}

function frame(shimmer: number, t: number): SingUniformFrame {
  return {
    rms: 0, pitchHz: 0, centroid: 0, spectralFlux: 0, onset: 0,
    voiced: 0, confidence: 0, elapsedSeconds: t, semantic: semantic(shimmer),
  };
}

const preset = createSingPreset({
  id: 'p', name: 'P', shader: 'x',
  mappings: [{ source: 'semantic', channel: 'motion.shimmer', target: 'u_shimmer', curve: 'linear' }],
});

describe('binder smoothing', () => {
  it('applies per-uniform one-euro smoothing when a smoothers map is provided', () => {
    const smoothers = new Map<string, OneEuroFilter>();
    const raw = [0.2, 0.85, 0.25, 0.8, 0.3, 0.78, 0.32, 0.76];
    const out = raw.map((s, i) =>
      mapSingPresetUniforms(preset, frame(s, 1 + i * 0.016), undefined, smoothers).get('u_shimmer') as number,
    );
    expect(variance(out.slice(1))).toBeLessThan(variance(raw.slice(1)));
    expect(smoothers.has('u_shimmer')).toBe(true);
  });

  it('falls back to EMA (first call returns the mapped value) when no smoothers map', () => {
    expect(mapSingPresetUniforms(preset, frame(0.5, 0)).get('u_shimmer')).toBeCloseTo(0.5, 5);
  });
});
