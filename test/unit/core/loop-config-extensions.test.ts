import { describe, it, expect } from 'vitest';
import { normalizeOptions } from '../../../src/core/LoopConfig.js';
import type { RenderOptions } from '../../../src/types/options/RenderOptions.js';

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

    expect(opts.aestheticConfig?.preset).toBe('cinematic');
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
    expect(opts.visualMappingParams).not.toBeNull();
  });

  it('defaults aestheticConfig to empty object', () => {
    const opts = normalizeOptions({});
    expect(opts.aestheticConfig).toEqual({});
  });
});

describe('LoopConfig RenderOptions integration', () => {
  it('accepts render option with canvas dimensions', () => {
    const render: RenderOptions = {
      canvas: { width: 1920, height: 1080 },
    };
    const opts = normalizeOptions({ render });

    expect(opts.render?.canvas).toEqual({ width: 1920, height: 1080 });
  });

  it('accepts render option with recording config', () => {
    const render: RenderOptions = {
      recording: { enabled: true, duration: 10, fps: 60, format: 'mp4' },
    };
    const opts = normalizeOptions({ render });
    expect(opts.render.recording).toEqual({
      enabled: true,
      duration: 10,
      fps: 60,
      format: 'mp4',
    });
  });

  it('accepts render option with preview config', () => {
    const render: RenderOptions = {
      preview: { enabled: true, port: 8080, autoOpen: false },
    };
    const opts = normalizeOptions({ render });
    expect(opts.render.preview).toEqual({
      enabled: true,
      port: 8080,
      autoOpen: false,
    });
  });

  it('defaults render to full defaults when not provided', () => {
    const opts = normalizeOptions({});
    expect(opts.render).toEqual({
      canvas: { width: 800, height: 600 },
      recording: { enabled: false, duration: 5, fps: 30, format: 'webm' },
      preview: { enabled: false, port: 3000, autoOpen: true },
    });
  });

  it('accepts full render options', () => {
    const render: RenderOptions = {
      canvas: { width: 800, height: 600 },
      recording: { enabled: false, duration: 5, fps: 30, format: 'webm' },
      preview: { enabled: false, port: 3000, autoOpen: true },
    };
    const opts = normalizeOptions({ render });
    expect(opts.render).toEqual(render);
  });

  it('preserves partial render options, filling defaults', () => {
    const render: RenderOptions = {
      canvas: { width: 100 },
    };
    const opts = normalizeOptions({ render });
    expect(opts.render.canvas).toEqual({ width: 100, height: 600 });
    expect(opts.render.recording).toEqual({ enabled: false, duration: 5, fps: 30, format: 'webm' });
    expect(opts.render.preview).toEqual({ enabled: false, port: 3000, autoOpen: true });
  });
});
