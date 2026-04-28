import { describe, it, expect } from 'vitest';
/**
 * generateMusic API tests
 *
 * TDD: generateMusic({ prompt, platform }) returns code for the chosen platform.
 * - platform 'strudel' -> Strudel/Tidal pattern (mini-notation or runnable on strudel.repl.co)
 * - platform 'p5-webaudio' -> p5.js code with createOscillator / Web Audio
 */

import { generateMusic } from '../../src/music/generateMusic.js';

describe('generateMusic', () => {
  it('returns object with code string', async () => {
    const result = await generateMusic({ prompt: 'test' });
    expect(result).toHaveProperty('code');
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });

  it('generateMusic({ prompt: "ambient", platform: "strudel" }) returns code containing Strudel/Tidal pattern', async () => {
    const result = await generateMusic({ prompt: 'ambient', platform: 'strudel' });

    expect(result.code?.length).toBeGreaterThan(0);
    // Strudel uses mini-notation (e.g. "c3 e3 g3") or patterns like s2, n, stack, etc.
    const hasStrudelOrTidalPattern =
      /s2|mini|notation|stack|slow|fast|n\(|sequence|sound|strudel|tidal/i.test(result.code) ||
      /["'].*[a-g][#b]?\d.*["']/.test(result.code) ||
      /\bc3\b|\be3\b|\bg3\b|~|\[.*\]/.test(result.code);
    expect(hasStrudelOrTidalPattern).toBe(true);
  });

  it('generateMusic({ prompt: "beeps", platform: "p5-webaudio" }) returns code containing createOscillator or Web Audio', async () => {
    const result = await generateMusic({ prompt: 'beeps', platform: 'p5-webaudio' });

    expect(result.code?.length).toBeGreaterThan(0);
    const hasWebAudio =
      result.code.includes('createOscillator') ||
      (result.code.includes('AudioContext') && result.code.includes('oscillator'));
    expect(hasWebAudio).toBe(true);
  });

  it('generateMusic({ prompt: "glitch", platform: "strudel" }) returns distinct Strudel code containing glitch-like pattern', async () => {
    const result = await generateMusic({ prompt: 'glitch', platform: 'strudel' });

    expect(result.code?.length).toBeGreaterThan(0);
    expect(result.code).toMatch(/stutter|degrade|hurry|jux|glitch/i);
  });

  it('generateMusic({ prompt: "reactive", platform: "strudel" }) returns distinct Strudel code', async () => {
    const result = await generateMusic({ prompt: 'reactive', platform: 'strudel' });

    expect(result.code?.length).toBeGreaterThan(0);
    expect(result.code).toMatch(/reactive|setcps|strudel/i);
  });

  it('falls back to template when LLM is not configured', async () => {
    // Without LIMINAL_LLM_API_KEY, should use template fallback
    const result = await generateMusic({ prompt: 'ambient chill', platform: 'strudel' });
    expect(result.code).toContain('setcps');
  });

  it('template fallback works for p5-webaudio platform', async () => {
    const result = await generateMusic({ prompt: 'beeps', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
  });
});
