import { describe, it, expect } from 'vitest';
import { buildContextForInjection } from '../../../src/core/ContextBuilder.js';

describe('Audio context injection', () => {
  it('appends audio analysis to context when visualMappingParams provided', () => {
    const params = {
      palette: { hues: [0.1, 0.3], saturations: [0.5, 0.7], lightness: [0.6, 0.8] },
      motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' as const },
      form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 },
      dynamics: { energy: 0.8, envelope: [] as number[], onsets: [] as number[] },
      composition: { focalWeight: 0.6, balance: 0.5 }
    };
    const ctx = buildContextForInjection(1, { visualMappingParams: params } as any);
    expect(ctx).toContain('Audio-derived visual parameters');
    expect(ctx).toContain('hues');
  });

  it('does not append audio context when no params', () => {
    const ctx = buildContextForInjection(1, {});
    expect(ctx).not.toContain('Audio-derived visual parameters');
  });

  it('formats all parameter sections', () => {
    const params = {
      palette: { hues: [0.1, 0.3], saturations: [0.5], lightness: [0.6] },
      motion: { speed: 0.8, turbulence: 0.4, rhythm: 'chaotic' as const },
      form: { complexity: 0.7, sharpness: 0.3, scale: 0.5 },
      dynamics: { energy: 0.9, envelope: [0.1, 0.2], onsets: [100, 200] },
      composition: { focalWeight: 0.7, balance: 0.4 }
    };
    const ctx = buildContextForInjection(1, { visualMappingParams: params } as any);
    expect(ctx).toContain('Palette');
    expect(ctx).toContain('Motion');
    expect(ctx).toContain('Form');
    expect(ctx).toContain('Dynamics');
    expect(ctx).toContain('Composition');
  });
});
