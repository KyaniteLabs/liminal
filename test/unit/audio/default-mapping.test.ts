import { describe, expect, it } from 'vitest';
import { mapSingPresetUniforms, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';
import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';
import type { SemanticVisualState } from '../../../packages/audio-core/src/SemanticMapper.js';

const semanticState: SemanticVisualState = {
  palette: { hue: 0.7, saturation: 0.5, value: 0.5, accentHue: 0.2 },
  form: { family: 0.3, complexity: 0.4, symmetry: 0.9, sharpness: 0.6 },
  motion: { flow: 0.5, turbulence: 0.2, shimmer: 0.8 },
  texture: { grain: 0.2, glow: 0.5, softness: 0.5 },
  density: { coverage: 0.6, spawn: 1 },
  composition: { scale: 0.5, focalY: 0.5, depth: 0.6 },
};

function frame(): SingUniformFrame {
  return {
    rms: 0, pitchHz: 0, centroid: 0, spectralFlux: 0, onset: 0,
    voiced: 0, confidence: 0, elapsedSeconds: 0, semantic: semanticState,
  };
}

describe('default semantic mapping', () => {
  it('yields the full semantic uniform set even when a preset declares only one raw mapping', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 }],
    });
    const v = mapSingPresetUniforms(preset, frame());
    expect(v.has('u_hue')).toBe(true);
    expect(v.get('u_shimmer')).toBeCloseTo(0.8, 5); // default motion.shimmer applied
    expect(v.get('u_spawn')).toBeCloseTo(1, 5);
  });

  it('lets an explicit mapping override the default for the same target', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ source: 'semantic', channel: 'palette.value', target: 'u_hue', curve: 'linear' }],
    });
    const v = mapSingPresetUniforms(preset, frame());
    expect(v.get('u_hue')).toBeCloseTo(0.5, 5); // palette.value (override), not palette.hue 0.7
  });
});
