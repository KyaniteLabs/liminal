import { describe, expect, it } from 'vitest';
import { Compositor, type CompositionSpec, type BlendMode } from '../../../src/composite/Compositor.js';

const validSpec: CompositionSpec = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 10,
  layers: [{ type: 'video', source: '/visual.mp4' }],
};

describe('Compositor', () => {
  describe('validateSpec', () => {
    it('accepts a valid spec', () => {
      expect(() => new Compositor().validateSpec(validSpec)).not.toThrow();
    });

    it('rejects empty layers array', () => {
      const spec = { ...validSpec, layers: [] };
      expect(() => new Compositor().validateSpec(spec)).toThrow('at least one layer');
    });

    it('rejects zero width', () => {
      const spec = { ...validSpec, width: 0 };
      expect(() => new Compositor().validateSpec(spec)).toThrow('must be positive');
    });

    it('rejects negative height', () => {
      const spec = { ...validSpec, height: -100 };
      expect(() => new Compositor().validateSpec(spec)).toThrow('must be positive');
    });

    it('rejects zero fps', () => {
      const spec = { ...validSpec, fps: 0 };
      expect(() => new Compositor().validateSpec(spec)).toThrow('must be positive');
    });

    it('rejects zero duration', () => {
      const spec = { ...validSpec, duration: 0 };
      expect(() => new Compositor().validateSpec(spec)).toThrow('must be positive');
    });

    it('accepts an audio layer', () => {
      const spec: CompositionSpec = {
        ...validSpec,
        layers: [{ type: 'audio', source: '/bgm.mp3', volume: 0.8 }],
      };
      expect(() => new Compositor().validateSpec(spec)).not.toThrow();
    });

    it('accepts an image layer with blend and opacity', () => {
      const spec: CompositionSpec = {
        ...validSpec,
        layers: [{ type: 'image', source: '/bg.png', blend: 'screen', opacity: 0.5, x: 10, y: 20 }],
      };
      expect(() => new Compositor().validateSpec(spec)).not.toThrow();
    });
  });

  describe('blendToCSS', () => {
    const modes: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'soft-light', 'difference'];
    modes.forEach((mode) => {
      it(`returns "${mode}" for blend mode ${mode}`, () => {
        expect(new Compositor().blendToCSS(mode)).toBe(mode);
      });
    });
  });

  describe('removed methods', () => {
    it('buildFilterGraph throws removed error', () => {
      expect(() => new Compositor().buildFilterGraph(validSpec)).toThrow('removed');
    });

    it('buildCompositeArgs throws removed error', () => {
      expect(() => new Compositor().buildCompositeArgs(validSpec, '/out.mp4')).toThrow('removed');
    });

    it('generateVideoComposition throws removed error', () => {
      expect(() => new Compositor().generateVideoComposition(validSpec)).toThrow('removed');
    });

    it('composite returns a rejected promise with removed error', async () => {
      await expect(new Compositor().composite(validSpec, '/out.mp4')).rejects.toThrow('removed');
    });
  });
});
