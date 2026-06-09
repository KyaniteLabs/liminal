import { describe, it, expect } from 'vitest';
import {
  frequencyToMidi,
  midiToFrequency,
  frequencyToNoteName,
  clampFrequency,
} from '../../../src/audio/PitchUtils.js';

describe('PitchUtils', () => {
  describe('frequencyToMidi', () => {
    it('maps A4 (440 Hz) to MIDI 69', () => {
      expect(frequencyToMidi(440)).toBeCloseTo(69, 5);
    });

    it('maps C4 (261.63 Hz) to MIDI 60', () => {
      expect(frequencyToMidi(261.63)).toBeCloseTo(60, 1);
    });

    it('maps an octave up (880 Hz) to MIDI 81', () => {
      expect(frequencyToMidi(880)).toBeCloseTo(81, 5);
    });

    it('maps an octave down (220 Hz) to MIDI 57', () => {
      expect(frequencyToMidi(220)).toBeCloseTo(57, 5);
    });
  });

  describe('midiToFrequency', () => {
    it('maps MIDI 69 to 440 Hz (A4)', () => {
      expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    });

    it('maps MIDI 60 to ~261.63 Hz (C4)', () => {
      expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
    });

    it('round-trips with frequencyToMidi', () => {
      const freq = 523.25; // C5
      expect(midiToFrequency(frequencyToMidi(freq))).toBeCloseTo(freq, 1);
    });
  });

  describe('frequencyToNoteName', () => {
    it('returns A4 for 440 Hz', () => {
      expect(frequencyToNoteName(440)).toBe('A4');
    });

    it('returns C4 for 261.63 Hz', () => {
      expect(frequencyToNoteName(261.63)).toBe('C4');
    });

    it('returns note for high frequency', () => {
      const name = frequencyToNoteName(2093);
      expect(name).toContain('C');
    });

    it('returns note for low frequency', () => {
      const name = frequencyToNoteName(65.41); // C2
      expect(name).toContain('C');
    });
  });

  describe('clampFrequency', () => {
    it('returns frequency within range unchanged', () => {
      expect(clampFrequency(440)).toBe(440);
    });

    it('clamps to minimum 20 Hz', () => {
      expect(clampFrequency(5)).toBe(20);
    });

    it('clamps to maximum 8000 Hz', () => {
      expect(clampFrequency(10000)).toBe(8000);
    });

    it('returns 20 for exactly minimum', () => {
      expect(clampFrequency(20)).toBe(20);
    });

    it('returns 8000 for exactly maximum', () => {
      expect(clampFrequency(8000)).toBe(8000);
    });

    it('clamps negative frequency to 20', () => {
      expect(clampFrequency(-100)).toBe(20);
    });

    it('clamps zero to 20', () => {
      expect(clampFrequency(0)).toBe(20);
    });
  });
});
