import { describe, expect, it } from 'vitest';
import { mapSingPresetUniforms, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';
import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';
import type { SemanticVisualState } from '../../../packages/audio-core/src/SemanticMapper.js';

function frame(semantic?: SemanticVisualState): SingUniformFrame {
  return {
    rms: 0, pitchHz: 0, centroid: 0, spectralFlux: 0, onset: 0,
    voiced: 0, confidence: 0, elapsedSeconds: 0, semantic,
  };
}

const semanticState: SemanticVisualState = {
  palette: { hue: 0.7, saturation: 0.5, value: 0.5, accentHue: 0.2 },
  form: { family: 0.3, complexity: 0.4, symmetry: 0.9, sharpness: 0.6 },
  motion: { flow: 0.5, turbulence: 0.2, shimmer: 0.8 },
  texture: { grain: 0.2, glow: 0.5, softness: 0.5 },
  density: { coverage: 0.6, spawn: 1 },
  composition: { scale: 0.5, focalY: 0.5, depth: 0.6 },
};

describe('PresetBinder — semantic + raw', () => {
  it('binds a semantic channel value to its uniform', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ source: 'semantic', channel: 'palette.hue', target: 'u_hue', curve: 'linear' }],
    });
    expect(mapSingPresetUniforms(preset, frame(semanticState)).get('u_hue')).toBeCloseTo(0.7, 5);
  });

  it('defaults a semantic target to 0 when frame.semantic is absent (no throw)', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ source: 'semantic', channel: 'motion.shimmer', target: 'u_shimmer' }],
    });
    expect(mapSingPresetUniforms(preset, frame()).get('u_shimmer')).toBe(0);
  });

  it('still binds a legacy raw feature mapping', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 }],
    });
    expect(mapSingPresetUniforms(preset, { ...frame(), rms: 0.5 }).get('u_energy')).toBeCloseTo(0.5, 5);
  });
});
