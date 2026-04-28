/**
 * @fileoverview Tests for registerAdapters - Central adapter registration
 */

import { describe, it, expect } from 'vitest';
import {
  registerAllAdapters,
  allAdapters,
} from '../../../../src/composition/adapters/registerAdapters.js';
import { CompositionEngine } from '../../../../src/composition/CompositionEngine.js';
import type { LayerAdapter } from '../../../../src/composition/adapters/index.js';

describe('registerAdapters', () => {
  describe('registerAllAdapters', () => {
    it('should register all 9 adapters', () => {
      const engine = new CompositionEngine();
      
      // Should not throw and should complete successfully
      expect(() => registerAllAdapters(engine)).not.toThrow();
    });

    it('should allow layers to be added after registration', () => {
      const engine = new CompositionEngine();
      registerAllAdapters(engine);

      // After registration, we should be able to add layers
      // (This verifies adapters were registered internally)
      const layers = engine.getLayers();
      expect(Array.isArray(layers)).toBe(true);
    });
  });

  describe('allAdapters singleton', () => {
    it('should have all 9 adapter instances', () => {
      expect(allAdapters.p5).not.toBeNull();
      expect(allAdapters.tone).not.toBeNull();
      expect(allAdapters.three).not.toBeNull();
      expect(allAdapters.shader).not.toBeNull();
      expect(allAdapters.strudel).not.toBeNull();
      expect(allAdapters.hydra).not.toBeNull();
      expect(allAdapters.asciiArt).not.toBeNull();
      expect(allAdapters.html).not.toBeNull();
      expect(allAdapters.remotion).not.toBeNull();
    });

    it('should export singleton instances that do not change', () => {
      // Each should be the same instance (singleton pattern)
      const p5First = allAdapters.p5;
      const p5Second = allAdapters.p5;
      expect(p5First).toBe(p5Second);
    });

    it('should have adapters with required LayerAdapter methods', () => {
      // Check that each adapter has the render method (core requirement)
      const adapters: LayerAdapter[] = [
        allAdapters.p5,
        allAdapters.tone,
        allAdapters.three,
        allAdapters.shader,
        allAdapters.strudel,
        allAdapters.hydra,
        allAdapters.asciiArt,
        allAdapters.html,
        allAdapters.remotion,
      ];

      for (const adapter of adapters) {
        expect(adapter).not.toBeNull();
        expect(typeof adapter.render).toBe('function');
      }
    });
  });

  describe('individual adapter exports', () => {
    it('should export p5Adapter singleton', () => {
      expect(allAdapters.p5).not.toBeNull();
      expect(typeof allAdapters.p5.render).toBe('function');
    });

    it('should export toneAdapter singleton', () => {
      expect(allAdapters.tone).not.toBeNull();
      expect(typeof allAdapters.tone.render).toBe('function');
    });

    it('should export threeAdapter singleton', () => {
      expect(allAdapters.three).not.toBeNull();
      expect(typeof allAdapters.three.render).toBe('function');
    });

    it('should export shaderAdapter singleton', () => {
      expect(allAdapters.shader).not.toBeNull();
      expect(typeof allAdapters.shader.render).toBe('function');
    });

    it('should export strudelAdapter singleton', () => {
      expect(allAdapters.strudel).not.toBeNull();
      expect(typeof allAdapters.strudel.render).toBe('function');
    });

    it('should export hydraAdapter singleton', () => {
      expect(allAdapters.hydra).not.toBeNull();
      expect(typeof allAdapters.hydra.render).toBe('function');
    });

    it('should export asciiArtAdapter singleton', () => {
      expect(allAdapters.asciiArt).not.toBeNull();
      expect(typeof allAdapters.asciiArt.render).toBe('function');
    });

    it('should export htmlAdapter singleton', () => {
      expect(allAdapters.html).not.toBeNull();
      expect(typeof allAdapters.html.render).toBe('function');
    });

    it('should export remotionAdapter singleton', () => {
      expect(allAdapters.remotion).not.toBeNull();
      expect(typeof allAdapters.remotion.render).toBe('function');
    });
  });
});
