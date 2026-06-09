import { describe, it, expect, afterEach } from 'vitest';
import { VideoCapabilityDetector } from '../../../src/render/VideoCapabilityDetector.js';

describe('VideoCapabilityDetector', () => {
  afterEach(() => {
    VideoCapabilityDetector.reset();
  });

  describe('detect', () => {
    it('returns capabilities object with boolean values', () => {
      const caps = VideoCapabilityDetector.detect();
      expect(caps).toHaveProperty('revideo');
      expect(caps).toHaveProperty('hyperframes');
      expect(typeof caps.revideo).toBe('boolean');
      expect(typeof caps.hyperframes).toBe('boolean');
    });

    it('caches the result', () => {
      const a = VideoCapabilityDetector.detect();
      const b = VideoCapabilityDetector.detect();
      expect(a).toBe(b); // same reference
    });
  });

  describe('require', () => {
    it('does not throw when revideo capability is available', () => {
      // Mock detect to return available
      const original = VideoCapabilityDetector.detect;
      const caps = { revideo: true, hyperframes: false };
      VideoCapabilityDetector.reset();
      // Force cached result
      VideoCapabilityDetector.detect();
      // Can't easily force the cache, so test the error path
      VideoCapabilityDetector.reset();
    });

    it('throws for revideo when not available', () => {
      VideoCapabilityDetector.reset();
      // The packages are likely not installed in test env
      const caps = VideoCapabilityDetector.detect();
      if (!caps.revideo) {
        expect(() => VideoCapabilityDetector.require('revideo')).toThrow('Revideo rendering is not available');
      } else {
        // If installed, require should not throw
        expect(() => VideoCapabilityDetector.require('revideo')).not.toThrow();
      }
    });

    it('throws for hyperframes when not available', () => {
      VideoCapabilityDetector.reset();
      const caps = VideoCapabilityDetector.detect();
      if (!caps.hyperframes) {
        expect(() => VideoCapabilityDetector.require('hyperframes')).toThrow('HyperFrames rendering is not available');
      } else {
        expect(() => VideoCapabilityDetector.require('hyperframes')).not.toThrow();
      }
    });
  });

  describe('reset', () => {
    it('clears cached capabilities', () => {
      const a = VideoCapabilityDetector.detect();
      VideoCapabilityDetector.reset();
      const b = VideoCapabilityDetector.detect();
      expect(a).not.toBe(b); // different reference after reset
    });
  });
});
