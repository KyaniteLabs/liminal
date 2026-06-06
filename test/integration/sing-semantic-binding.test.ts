import { describe, expect, it } from 'vitest';
import { mapVoiceToSemantic } from '../../packages/audio-core/src/SemanticMapper.js';
import type { VoiceFeatureFrame } from '../../packages/audio-core/src/VoiceFeatureStream.js';
import type { FormantData } from '../../packages/audio-core/src/FormantAnalyzer.js';
import { createSingPreset } from '../../packages/audio-core/src/PresetSchema.js';
import { mapSingPresetUniforms, type SingUniformFrame } from '../../packages/sing/src/render/pipeline.js';

const formants: FormantData = {
  f1: 700, f2: 1200, openness: 0.7, frontness: 0.3, phonemeCategory: 'open-back',
};

function voiceFrame(): VoiceFeatureFrame {
  return {
    rms: 0.09, pitchHz: 370, centroid: 0.4, spectralFlux: 0.01, onset: true,
    voiced: true, confidence: 0.9, pitchClass: 6, octave: 4, brightness: 0.6,
    breathiness: 0.2, formants, vowel: 'open-back', capturedAt: 0, spectrum: new Float32Array(0),
  };
}

function singFrame(semantic: ReturnType<typeof mapVoiceToSemantic>): SingUniformFrame {
  return {
    rms: 0, pitchHz: 0, centroid: 0, spectralFlux: 0, onset: 0,
    voiced: 0, confidence: 0, elapsedSeconds: 0, semantic,
  };
}

describe('Sing semantic binding (SemanticMapper → binder)', () => {
  it('flows mapper output through the binder to the bound uniform', () => {
    // pitch class 6 → palette.hue 0.5
    const semantic = mapVoiceToSemantic(voiceFrame(), { rate: 6, depth: 40 });
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [
        { source: 'semantic', channel: 'palette.hue', target: 'u_hue', curve: 'linear' },
        { source: 'semantic', channel: 'density.spawn', target: 'u_spawn', curve: 'linear' },
      ],
    });
    const uniforms = mapSingPresetUniforms(preset, singFrame(semantic));
    expect(uniforms.get('u_hue')).toBeCloseTo(semantic.palette.hue, 5);
    expect(uniforms.get('u_hue')).toBeCloseTo(0.5, 5);
    // onset:true in the voice frame → density.spawn 1 → u_spawn 1
    expect(uniforms.get('u_spawn')).toBeCloseTo(1, 5);
  });

  it('feeds the default vocabulary uniforms from the mapper state', () => {
    const semantic = mapVoiceToSemantic(voiceFrame(), { rate: 6, depth: 40 });
    const preset = createSingPreset({
      id: 'p', name: 'P', shader: 'x',
      mappings: [{ feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 }],
    });
    const uniforms = mapSingPresetUniforms(preset, singFrame(semantic));
    // u_shimmer comes from the default mapping reading motion.shimmer (>0 for this vibrato)
    expect(uniforms.get('u_shimmer') as number).toBeGreaterThan(0);
  });
});
