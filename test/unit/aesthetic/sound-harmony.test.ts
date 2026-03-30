import { describe, it, expect } from 'vitest';
import { analyzeSoundHarmony } from '../../../src/aesthetic/critics/SoundHarmonyCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from '../../../src/aesthetic/types.js';

describe('SoundHarmonyCritic', () => {
  it('passes code with harmonious frequencies (major chord)', () => {
    const code = "osc1.frequency.value = 261.63; osc2.frequency.value = 329.63; osc3.frequency.value = 392.00;"; // C4, E4, G4
    const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.5);
  });

  it('warns about tritone dissonance', () => {
    const code = "osc1.frequency.value = 261.63; osc2.frequency.value = 369.99;"; // C4, F#4 = tritone
    const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.some(v => v.rule === 'dissonance')).toBe(true);
  });

  it('warns about excessive gain', () => {
    const code = "gainNode.gain.value = 0.95;";
    const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.some(v => v.rule === 'excessive-gain')).toBe(true);
  });

  it('neutral score when no audio', () => {
    const code = "rect(10, 10, 100, 100);";
    const report = analyzeSoundHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBe(0.5);
  });
});
