import { describe, it, expect } from 'vitest';
import { frequencyToMidi, frequencyToNoteName, midiToFrequency, clampFrequency } from '../../../src/audio/PitchUtils.js';

describe('PitchUtils', () => {
  it('frequencyToMidi(440) === 69', () => expect(frequencyToMidi(440)).toBe(69));
  it('frequencyToNoteName(440) === "A4"', () => expect(frequencyToNoteName(440)).toBe('A4'));
  it('frequencyToMidi(261.63) ~ 60 (C4)', () => expect(frequencyToMidi(261.63)).toBeCloseTo(60, 0));
  it('frequencyToNoteName(261.63) === "C4"', () => expect(frequencyToNoteName(261.63)).toBe('C4'));
  it('midiToFrequency(69) === 440', () => expect(midiToFrequency(69)).toBeCloseTo(440, 1));
  it('midiToFrequency(60) ~ 261.63', () => expect(midiToFrequency(60)).toBeCloseTo(261.63, 1));
  it('clampFrequency clamps to [20, 8000]', () => {
    expect(clampFrequency(10)).toBe(20);
    expect(clampFrequency(20000)).toBe(8000);
    expect(clampFrequency(440)).toBe(440);
  });
  it('frequencyToNoteName handles edge cases', () => {
    expect(frequencyToNoteName(20)).not.toBeNull();
    expect(frequencyToNoteName(8000)).not.toBeNull();
  });
});
