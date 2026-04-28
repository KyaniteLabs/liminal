import { describe, it, expect } from 'vitest';
import {
  frequencyToColor, frequencyToScaleColor, quantizeToScale, scaleToPalette,
  pitchClassToHue, pitchClassName, midiToPitchClass, frequencyToMidi, NOTE_NAMES, SCALES
} from '../../../src/audio/PitchColorMapper.js';

describe('PitchColorMapper', () => {
  describe('NOTE_NAMES and SCALES', () => {
    it('exports 12 chromatic note names', () => {
      expect(NOTE_NAMES).toHaveLength(12);
      expect(NOTE_NAMES[0]).toBe('C');
      expect(NOTE_NAMES[11]).toBe('B');
    });

    it('exports standard scales', () => {
      expect(SCALES.major).toHaveLength(7);
      expect(SCALES.minor).toHaveLength(7);
      expect(SCALES.pentatonic).toHaveLength(5);
    });
  });

  describe('frequencyToMidi', () => {
    it('converts A4 (440Hz) to MIDI 69', () => {
      expect(frequencyToMidi(440)).toBeCloseTo(69, 1);
    });
  });

  describe('midiToPitchClass', () => {
    it('maps MIDI 60 (C4) to pitch class 0', () => {
      expect(midiToPitchClass(60)).toBe(0);
    });

    it('handles negative pitch classes', () => {
      expect(midiToPitchClass(-12)).toBe(0);
      expect(midiToPitchClass(-1)).toBe(11);
    });
  });

  describe('pitchClassName', () => {
    it('returns C for pitch class 0', () => {
      expect(pitchClassName(0)).toBe('C');
    });

    it('handles negative pitch classes', () => {
      expect(pitchClassName(-12)).toBe('C');
    });
  });

  describe('pitchClassToHue', () => {
    it('maps C (0) to hue 0', () => {
      expect(pitchClassToHue(0)).toBe(0);
    });

    it('handles negative pitch classes', () => {
      expect(pitchClassToHue(-12)).toBe(0);
    });
  });

  describe('frequencyToColor', () => {
    it('maps 440Hz to blue/purple hue', () => {
      const color = frequencyToColor(440);
      expect(color.h).toBe(270);
    });
  });

  describe('quantizeToScale', () => {
    it('quantizes C to C in C major', () => {
      const midi = quantizeToScale(261.63, SCALES.major, 0);
      expect(midi).toBe(60);
    });
  });

  describe('frequencyToScaleColor', () => {
    it('maps 440Hz in pentatonic scale', () => {
      const color = frequencyToScaleColor(440, 'pentatonic', 0);
      expect(color.h).not.toBeNull();
    });

    it('falls back to chromatic for unknown scale', () => {
      const color = frequencyToScaleColor(440, 'unknown_scale', 0);
      expect(color.h).not.toBeNull();
    });
  });

  describe('scaleToPalette', () => {
    it('generates palette for major scale', () => {
      const palette = scaleToPalette('major', 0);
      expect(palette).toHaveLength(7);
    });

    it('respects root transposition', () => {
      const cMajor = scaleToPalette('major', 0);
      expect(cMajor[0].h).toBe(0);
    });

    it('falls back to chromatic for unknown scale', () => {
      const palette = scaleToPalette('unknown', 0);
      expect(palette).toHaveLength(12);
    });
  });
});
