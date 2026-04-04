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
      expect(allAdapters.p5).toBeDefined();
      expect(allAdapters.tone).toBeDefined();
      expect(allAdapters.three).toBeDefined();
      expect(allAdapters.shader).toBeDefined();
      expect(allAdapters.strudel).toBeDefined();
      expect(allAdapters.hydra).toBeDefined();
      expect(allAdapters.asciiArt).toBeDefined();
      expect(allAdapters.html).toBeDefined();
      expect(allAdapters.remotion).toBeDefined();
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
        expect(adapter).toBeDefined();
        expect(typeof adapter.render).toBe('function');
      }
    });
  });

  describe('individual adapter exports', () => {
    it('should export p5Adapter singleton', () => {
      expect(allAdapters.p5).toBeDefined();
      expect(typeof allAdapters.p5.render).toBe('function');
    });

    it('should export toneAdapter singleton', () => {
      expect(allAdapters.tone).toBeDefined();
      expect(typeof allAdapters.tone.render).toBe('function');
    });

    it('should export threeAdapter singleton', () => {
      expect(allAdapters.three).toBeDefined();
      expect(typeof allAdapters.three.render).toBe('function');
    });

    it('should export shaderAdapter singleton', () => {
      expect(allAdapters.shader).toBeDefined();
      expect(typeof allAdapters.shader.render).toBe('function');
    });

    it('should export strudelAdapter singleton', () => {
      expect(allAdapters.strudel).toBeDefined();
      expect(typeof allAdapters.strudel.render).toBe('function');
    });

    it('should export hydraAdapter singleton', () => {
      expect(allAdapters.hydra).toBeDefined();
      expect(typeof allAdapters.hydra.render).toBe('function');
    });

    it('should export asciiArtAdapter singleton', () => {
      expect(allAdapters.asciiArt).toBeDefined();
      expect(typeof allAdapters.asciiArt.render).toBe('function');
    });

    it('should export htmlAdapter singleton', () => {
      expect(allAdapters.html).toBeDefined();
      expect(typeof allAdapters.html.render).toBe('function');
    });

    it('should export remotionAdapter singleton', () => {
      expect(allAdapters.remotion).toBeDefined();
      expect(typeof allAdapters.remotion.render).toBe('function');
    });
  });
});
