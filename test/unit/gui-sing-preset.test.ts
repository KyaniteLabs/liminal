import { describe, expect, it } from 'vitest';
import {
  buildSingInstrumentUrl,
  buildStudioSingPreset,
  selectCurrentSingShader,
} from '../../gui/src/gui/singPreset';

describe('Studio Sing preset handoff', () => {
  const shader = 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }';

  it('uses the current generated GLSL artifact instead of archive or seed fallbacks', () => {
    expect(selectCurrentSingShader({
      currentCode: shader,
      archiveCode: 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }',
    })).toBe(shader);

    expect(selectCurrentSingShader({
      currentCode: 'function setup() { createCanvas(400, 400); }',
      archiveCode: shader,
    })).toBeNull();
  });

  it('encodes the generated preset into the Sing launch URL', () => {
    const preset = buildStudioSingPreset({
      source: shader,
      prompt: 'aurora ribbons',
      now: new Date('2026-05-14T04:00:00.000Z'),
    });
    const url = buildSingInstrumentUrl(preset);

    expect(url).toContain('http://127.0.0.1:5176/?preset=');
    const encoded = new URL(url).searchParams.get('preset');
    expect(encoded).toMatch(/^data:application\/json/);

    const decoded = JSON.parse(decodeURIComponent(encoded!.split(',')[1]));
    expect(decoded.name).toBe('aurora ribbons');
    expect(decoded.shader.source).toBe(shader);
    expect(decoded.mappings.every((mapping: { smoothing?: number }) => typeof mapping.smoothing === 'number')).toBe(true);
  });
});
