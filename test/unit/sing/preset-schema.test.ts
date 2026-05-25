import { describe, expect, it } from 'vitest';
import {
  createSingPreset,
  validateSingPreset,
  type SingPresetArtifact,
} from '../../../packages/audio-core/src/PresetSchema.js';

describe('Sing preset schema', () => {
  it('creates a portable preset artifact with shader and mapping contracts', () => {
    const preset = createSingPreset({
      id: 'voice-bloom',
      name: 'Voice Bloom',
      shader: 'void main() { gl_FragColor = vec4(1.0); }',
      mappings: [
        { feature: 'rms', target: 'u_energy', curve: 'easeOut', min: 0, max: 2 },
        { feature: 'pitchHz', target: 'u_pitch', curve: 'linear', min: 80, max: 900 },
      ],
    });

    expect(preset.schemaVersion).toBe(1);
    expect(preset.instrument).toBe('sing');
    expect(preset.shader.language).toBe('glsl-fragment');
    expect(preset.mappings).toHaveLength(2);
    expect(validateSingPreset(preset).ok).toBe(true);
  });

  it('rejects presets that cannot drive the standalone instrument', () => {
    const invalid = {
      schemaVersion: 1,
      instrument: 'liminal-studio',
      id: 'bad',
      name: 'Bad',
      shader: { language: 'glsl-fragment', source: '' },
      mappings: [],
    } satisfies Partial<SingPresetArtifact>;

    const result = validateSingPreset(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('instrument');
    }
  });
});
