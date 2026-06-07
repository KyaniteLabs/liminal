import { describe, expect, it } from 'vitest';
import { createSingPreset, validateSingPreset } from '@sinter/audio-core/PresetSchema.js';

const shader = 'void main() { gl_FragColor = vec4(1.0); }';

describe('PresetSchema — layered (semantic + raw) bindings', () => {
  it('accepts a semantic mapping', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader,
      mappings: [{ source: 'semantic', channel: 'palette.hue', target: 'u_hue' }],
    });
    expect(validateSingPreset(preset).ok).toBe(true);
  });

  it('accepts a legacy raw mapping with no explicit source (backward compatible)', () => {
    const preset = createSingPreset({
      id: 'p', name: 'P', shader,
      mappings: [{ feature: 'rms', target: 'u_energy', curve: 'linear', min: 0, max: 1 }],
    });
    expect(validateSingPreset(preset).ok).toBe(true);
  });

  it('rejects a semantic mapping with an unknown channel', () => {
    const result = validateSingPreset({
      schemaVersion: 1, instrument: 'sing', id: 'p', name: 'P',
      createdAt: '2026-01-01T00:00:00Z',
      shader: { language: 'glsl-fragment', source: shader },
      mappings: [{ source: 'semantic', channel: 'palette.banana', target: 'u_x' }],
      metadata: {},
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a raw mapping with a bad feature', () => {
    const result = validateSingPreset({
      schemaVersion: 1, instrument: 'sing', id: 'p', name: 'P',
      createdAt: '2026-01-01T00:00:00Z',
      shader: { language: 'glsl-fragment', source: shader },
      mappings: [{ source: 'raw', feature: 'banana', target: 'u_x', curve: 'linear', min: 0, max: 1 }],
      metadata: {},
    });
    expect(result.ok).toBe(false);
  });

  it('still requires at least one mapping', () => {
    const result = validateSingPreset({
      schemaVersion: 1, instrument: 'sing', id: 'p', name: 'P',
      createdAt: '2026-01-01T00:00:00Z',
      shader: { language: 'glsl-fragment', source: shader },
      mappings: [], metadata: {},
    });
    expect(result.ok).toBe(false);
  });
});
