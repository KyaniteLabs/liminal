import { describe, it, expect, afterEach } from 'vitest';
import {
  verdictFromMeasure,
  layersToDemote,
  gateEnabled,
  DEMOTED_OPACITY_FACTOR,
} from '../../../src/composition/CompositeRenderGate.js';

const measure = (meanLuminance: number, brightFraction = 0.3, darkFraction = 0.1) => ({
  meanLuminance,
  brightFraction,
  darkFraction,
});

describe('CompositeRenderGate', () => {
  describe('verdictFromMeasure', () => {
    it('flags washed-out frames at the calibrated threshold', () => {
      expect(verdictFromMeasure(measure(0.93))).toBe('washout'); // dusk-bloom class
      expect(verdictFromMeasure(measure(0.8))).toBe('washout'); // boundary inclusive
      expect(verdictFromMeasure(measure(0.79))).toBe('ok');
    });

    it('flags crushed frames only when bright focal content is absent', () => {
      expect(verdictFromMeasure(measure(0.05, 0.0))).toBe('too-dark');
      expect(verdictFromMeasure(measure(0.1, 0.019))).toBe('too-dark'); // boundary inclusive
      // Legit dark design: dark ground WITH bright focal content passes —
      // the calibration that stops kinetic typography being forced into mud.
      expect(verdictFromMeasure(measure(0.05, 0.1))).toBe('ok');
    });

    it('passes balanced frames', () => {
      expect(verdictFromMeasure(measure(0.47))).toBe('ok'); // the graded showpiece
    });

    it('flags mid-grey mud when the spread collapses with no anchors (fog-audit calibration)', () => {
      // Flat slate stack: mid luminance, no darks, no highlights, std 9.
      expect(verdictFromMeasure({ meanLuminance: 0.48, brightFraction: 0.01, darkFraction: 0.0, brightnessStd: 9 })).toBe('muddy');
      // Same stats without a measured std: conservative, stays ok.
      expect(verdictFromMeasure(measure(0.48, 0.01, 0.0))).toBe('ok');
      // Healthy spread at the same luminance stays ok.
      expect(verdictFromMeasure({ meanLuminance: 0.48, brightFraction: 0.01, darkFraction: 0.0, brightnessStd: 28 })).toBe('ok');
      // Dark-anchored frames are never mud regardless of spread.
      expect(verdictFromMeasure({ meanLuminance: 0.4, brightFraction: 0.01, darkFraction: 0.3, brightnessStd: 9 })).toBe('ok');
    });
  });

  describe('layersToDemote', () => {
    it('demotes lightening blends (and overlay) on washout, never the base layer', () => {
      expect(layersToDemote('washout', ['screen', 'screen', 'lighten', 'overlay', 'normal'])).toEqual([1, 2, 3]);
    });

    it('demotes darkening blends on too-dark, never the base layer', () => {
      expect(layersToDemote('too-dark', ['multiply', 'multiply', 'darken', 'screen'])).toEqual([1, 2]);
    });

    it('squeezes every non-base layer on mud so the base value structure shows through', () => {
      expect(layersToDemote('muddy', ['normal', 'screen', 'normal', 'overlay'])).toEqual([1, 2, 3]);
    });

    it('returns nothing for ok frames or when no blend is in the failed direction', () => {
      expect(layersToDemote('ok', ['screen', 'screen'])).toEqual([]);
      expect(layersToDemote('washout', ['normal', 'multiply', 'difference'])).toEqual([]);
      expect(layersToDemote('too-dark', ['normal', 'screen', 'lighten'])).toEqual([]);
    });
  });

  describe('gate config', () => {
    const saved = process.env.SINTER_COMPOSITE_GATE;
    afterEach(() => {
      if (saved === undefined) delete process.env.SINTER_COMPOSITE_GATE;
      else process.env.SINTER_COMPOSITE_GATE = saved;
    });

    it('is on by default and disabled by SINTER_COMPOSITE_GATE=0', () => {
      delete process.env.SINTER_COMPOSITE_GATE;
      expect(gateEnabled()).toBe(true);
      process.env.SINTER_COMPOSITE_GATE = '0';
      expect(gateEnabled()).toBe(false);
    });

    it('keeps demoted layers translucent rather than occluding the stack', () => {
      expect(DEMOTED_OPACITY_FACTOR).toBe(0.75);
    });
  });
});
