import { describe, expect, it } from 'vitest';
import { moonlitGardenPreset } from '../../../packages/sing/src/presets/moonlitGarden.js';
import { validateSingPreset, SEMANTIC_CHANNELS } from '../../../packages/audio-core/src/PresetSchema.js';

describe('moonlitGardenPreset', () => {
  const preset = moonlitGardenPreset();

  it('is a valid Sing preset', () => {
    const result = validateSingPreset(preset);
    expect(result.ok).toBe(true);
  });

  it('is a GLSL fragment shader with an entry point', () => {
    expect(preset.shader.language).toBe('glsl-fragment');
    expect(preset.shader.source).toContain('void main()');
    expect(preset.shader.source).toContain('gl_FragColor');
    expect(preset.shader.source).toContain('precision mediump float;');
  });

  it('declares the semantic uniforms its shader consumes', () => {
    const src = preset.shader.source;
    for (const u of ['u_hue', 'u_value', 'u_shimmer', 'u_coverage', 'u_spawn', 'u_scale', 'u_complexity', 'u_flow', 'u_focalY', 'u_glow']) {
      expect(src).toContain(`uniform float ${u};`);
    }
  });

  it('only binds valid semantic channels', () => {
    for (const mapping of preset.mappings) {
      if (mapping.source === 'semantic') {
        expect(SEMANTIC_CHANNELS).toContain(mapping.channel);
      }
    }
  });
});
