import { describe, expect, it } from 'vitest';
import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';
import {
  mapSingPresetUniforms,
  stabilizeSingFrame,
  type SingUniformFrame,
} from '../../../packages/sing/src/render/pipeline.js';

describe('Sing frame conditioning', () => {
  const quietFrame: SingUniformFrame = {
    rms: 0.012,
    pitchHz: 0,
    centroid: 0.2,
    spectralFlux: 0.0005,
    onset: 0,
    voiced: 0,
    confidence: 0,
    elapsedSeconds: 1,
  };

  it('normalizes ordinary mic energy into a useful visual range and smooths frame changes', () => {
    const first = stabilizeSingFrame({
      ...quietFrame,
      rms: 0.08,
      pitchHz: 240,
      spectralFlux: 0.01,
      onset: 1,
      voiced: 1,
      confidence: 0.7,
    });
    const second = stabilizeSingFrame({ ...quietFrame, elapsedSeconds: 1.02 }, first);

    expect(first.rms).toBeGreaterThan(0.3);
    expect(first.spectralFlux).toBeGreaterThan(0.2);
    expect(first.onset).toBe(1);
    expect(second.rms).toBeGreaterThan(0.05);
    expect(second.onset).toBeGreaterThan(0);
    expect(second.pitchHz).toBe(240);
  });

  it('applies default smoothing to mapped uniforms when presets omit it', () => {
    const preset = createSingPreset({
      id: 'smooth',
      name: 'Smooth',
      shader: 'void main() { gl_FragColor = vec4(1.0); }',
      mappings: [
        { feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 },
      ],
    });

    const hot = mapSingPresetUniforms(preset, { ...quietFrame, rms: 1 });
    const cold = mapSingPresetUniforms(preset, { ...quietFrame, rms: 0 }, hot);

    expect(cold.get('u_energy')).toBeGreaterThan(0);
    expect(cold.get('u_energy')).toBeLessThan(1);
  });
});
