import { describe, it, expect } from 'vitest';
/**
 * generateMusicToVisual tests - Music-to-visual bridge API
 *
 * TDD: generateMusicToVisual('ambient glitch') returns both musicCode and visualCode;
 * audioInput is present when music generates something.
 */

import { generateMusicToVisual } from '../../src/musicToVisual/generateMusicToVisual.js';

describe('generateMusicToVisual', () => {
  it("returns both musicCode and visualCode for prompt 'ambient glitch'", async () => {
    const result = await generateMusicToVisual('ambient glitch');

    expect(result).not.toBeNull();

    expect(typeof result.musicCode).toBe('string');
    expect(result.musicCode?.length).toBeGreaterThan(0);

    expect(typeof result.visualCode).toBe('string');
    expect(result.visualCode?.length).toBeGreaterThan(0);
  });

  it('includes audioInput when music generates something', async () => {
    const result = await generateMusicToVisual('ambient glitch');

    expect(result.audioInput).not.toBeNull();
    expect(result.audioInput).toHaveProperty('bpm');
    expect(typeof (result.audioInput as { bpm?: number }).bpm).toBe('number');
    expect(result.audioInput).toHaveProperty('fft');
    expect(Array.isArray((result.audioInput as { fft?: number[] }).fft)).toBe(true);
  });

  it('accepts options with musicPlatform and visualPlatform', async () => {
    const result = await generateMusicToVisual('ambient glitch', {
      musicPlatform: 'strudel',
      visualPlatform: 'hydra',
    });

    expect(result.musicCode).not.toBeNull();
    expect(result.visualCode).not.toBeNull();
  });

  it('accepts traits (bpm, palette) and passes them to generators', async () => {
    const result = await generateMusicToVisual('ambient', {
      traits: { bpm: 90, palette: 'mono' },
    });

    expect(result.musicCode).not.toBeNull();
    expect(result.visualCode).not.toBeNull();

    expect(result.audioInput!.bpm).toBe(90);
  });
});
