import { describe, it, expect } from 'vitest';
import { mapVoiceToShape, mapVoiceToShapeSequence } from '../../../src/audio/VoiceToShapeMapper.js';

describe('VoiceToShapeMapper', () => {
  describe('mapVoiceToShape', () => {
    it('maps silent audio to minimum radius', () => {
      const shape = mapVoiceToShape(0, 0, 0, 0.5, false);
      expect(shape.baseRadius).toBe(0.1);
    });

    it('maps high RMS to larger radius', () => {
      const quietShape = mapVoiceToShape(0.1, 440, 0.1, 0.5, false);
      const loudShape = mapVoiceToShape(0.9, 440, 0.9, 0.5, false);
      expect(loudShape.baseRadius).toBeGreaterThan(quietShape.baseRadius);
    });

    it('maps higher pitch to taller shape', () => {
      const lowShape = mapVoiceToShape(0.5, 220, 0.5, 0.5, false);
      const highShape = mapVoiceToShape(0.5, 880, 0.5, 0.5, false);
      expect(highShape.height).toBeGreaterThan(lowShape.height);
    });

    it('maps warmth to fold count', () => {
      const coldShape = mapVoiceToShape(0.5, 440, 0.5, 0, false);
      const warmShape = mapVoiceToShape(0.5, 440, 0.5, 1, false);
      expect(coldShape.profile.foldCount).toBe(3);
      expect(warmShape.profile.foldCount).toBe(12);
    });

    it('maps low warmth to high roughness', () => {
      const shape = mapVoiceToShape(0.5, 440, 0.5, 0, false);
      expect(shape.roughness).toBe(1);
    });

    it('maps high warmth to low roughness', () => {
      const shape = mapVoiceToShape(0.5, 440, 0.5, 1, false);
      expect(shape.roughness).toBe(0);
    });
  });

  describe('mapVoiceToShapeSequence', () => {
    it('returns empty array for empty input', () => {
      const shapes = mapVoiceToShapeSequence([], 0.3);
      expect(shapes).toHaveLength(0);
    });

    it('maps sequence of frames to shapes', () => {
      const frames = [
        { rms: 0.1, frequency: 220, energy: 0.1, warmth: 0.3, isOnset: false },
        { rms: 0.5, frequency: 440, energy: 0.5, warmth: 0.5, isOnset: true },
        { rms: 0.9, frequency: 880, energy: 0.9, warmth: 0.8, isOnset: false },
      ];
      const shapes = mapVoiceToShapeSequence(frames, 0.3);
      expect(shapes).toHaveLength(3);
    });
  });
});
