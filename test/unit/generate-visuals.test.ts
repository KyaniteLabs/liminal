import { describe, it, expect } from 'vitest';
/**
 * generateVisuals API tests
 *
 * TDD: generateVisuals({ prompt, platform?, audioInput? }) returns { code }
 * - platform 'hydra': code contains osc or .out()
 * - with audioInput: code references fft or bpm
 */

import { generateVisuals } from '../../src/generateVisuals.js';

describe('generateVisuals', () => {
  it('returns object with code string', async () => {
    const result = await generateVisuals({ prompt: 'reactive' });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('code');
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('with platform "hydra" returns code containing osc or .out()', async () => {
    const result = await generateVisuals({
      prompt: 'reactive',
      platform: 'hydra'
    });
    const code = result.code;
    const hasOsc = /osc\s*\(/.test(code);
    const hasOut = /\.out\s*\(/.test(code);
    expect(hasOsc || hasOut).toBe(true);
  });

  it('with audioInput returns code that references fft or bpm', async () => {
    const result = await generateVisuals({
      prompt: 'reactive',
      platform: 'hydra',
      audioInput: { fft: [0.1, 0.2], bpm: 120 }
    });
    const code = result.code;
    const hasFft = /\bfft\b/.test(code);
    const hasBpm = /\bbpm\b/.test(code);
    expect(hasFft || hasBpm).toBe(true);
  });

  it('with platform "p5" returns valid p5-style code', async () => {
    const result = await generateVisuals({
      prompt: 'reactive',
      platform: 'p5'
    });
    const code = result.code;
    expect(code).toMatch(/function\s+setup\s*\(|function\s+draw\s*\(|setup\s*\(|draw\s*\(/);
  });

  it('with platform "p5" and audioInput returns code referencing fft or bpm when provided', async () => {
    const result = await generateVisuals({
      prompt: 'reactive',
      platform: 'p5',
      audioInput: { bpm: 128 }
    });
    const code = result.code;
    const hasFft = /\bfft\b/.test(code);
    const hasBpm = /\bbpm\b/.test(code);
    expect(hasFft || hasBpm).toBe(true);
  });

  it('prompt "glitch" returns distinct Hydra code (glitch-like)', async () => {
    const result = await generateVisuals({ prompt: 'glitch', platform: 'hydra' });

    expect(result.code?.length).toBeGreaterThan(0);
    expect(result.code).toMatch(/noise|pixelate|repeat|modulate|glitch/i);
  });

  it('prompt "reactive" returns distinct Hydra code', async () => {
    const result = await generateVisuals({ prompt: 'reactive', platform: 'hydra' });

    expect(result.code?.length).toBeGreaterThan(0);
    expect(result.code).toMatch(/reactive|osc|out/i);
  });

  it('falls back to template when LLM is not configured', async () => {
    const result = await generateVisuals({ prompt: 'glitch', platform: 'hydra' });
    expect(result.code).toContain('.out()');
  });

  it('template fallback works for p5 platform', async () => {
    const result = await generateVisuals({ prompt: 'particles', platform: 'p5' });
    expect(result.code).toMatch(/setup|draw/);
  });
});
