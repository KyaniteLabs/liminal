import { describe, it, expect } from 'vitest';
import { normalizeOptions } from '../../../src/core/LoopConfig.js';

describe('LoopConfig audio + aesthetic extensions', () => {
  it('accepts useAestheticGuardrails option', () => {
    const opts = normalizeOptions({ useAestheticGuardrails: true });
    expect(opts.useAestheticGuardrails).toBe(true);
  });

  it('defaults useAestheticGuardrails to false', () => {
    const opts = normalizeOptions({});
    expect(opts.useAestheticGuardrails).toBe(false);
  });

  it('accepts aestheticConfig with preset', () => {
    const opts = normalizeOptions({ aestheticConfig: { preset: 'cinematic' } });
    expect(opts.aestheticConfig).toBeDefined();
    expect(opts.aestheticConfig.preset).toBe('cinematic');
  });

  it('accepts visualMappingParams option', () => {
    const params = {
      palette: { hues: [0.1], saturations: [0.5], lightness: [0.6] },
      motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' as const },
      form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 },
      dynamics: { energy: 0.8, envelope: [] as number[], onsets: [] as number[] },
      composition: { focalWeight: 0.6, balance: 0.5 }
    };
    const opts = normalizeOptions({ visualMappingParams: params });
    expect(opts.visualMappingParams).toBeDefined();
  });

  it('defaults aestheticConfig to empty object', () => {
    const opts = normalizeOptions({});
    expect(opts.aestheticConfig).toEqual({});
  });
});
