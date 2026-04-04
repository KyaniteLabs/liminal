/**
 * StrudelAdapter Tests - TDD: RED, GREEN, REFACTOR
 *
 * Tests for the StrudelAdapter that handles live coding music patterns.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrudelAdapter, strudelAdapter } from '../../../../src/composition/adapters/StrudelAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import { DEFAULT_GLOBAL_SETTINGS } from '../../../../src/composition/types.js';

// Mock Strudel module
declare global {
  interface Window {
    strudel: {
      repl: {
        evaluate: (code: string) => Promise<{ pattern: unknown }>;
        stop: () => void;
        getPattern: () => unknown;
        getBpm: () => number;
        getCycle: () => number;
      };
      Pattern: unknown;
    };
  }
}

describe('StrudelAdapter', () => {
  let adapter: StrudelAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockGlobalSettings: GlobalSettings;

  beforeEach(() => {
    adapter = new StrudelAdapter();
    
    mockLayer = {
      id: 'test-strudel-layer',
      type: 'strudel',
      code: `
$: s("bd sd")
$: note("c3 eb3 g3")
bpm(120)
      `,
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'test strudel pattern',
        generator: 'StrudelGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = document.createElement('div');
    mockGlobalSettings = { ...DEFAULT_GLOBAL_SETTINGS };

    // Setup global Strudel mock
    (globalThis as unknown as { window: typeof window }).window = {
      strudel: {
        repl: {
          evaluate: vi.fn().mockResolvedValue({ pattern: { query: vi.fn() } }),
          stop: vi.fn(),
          getPattern: vi.fn().mockReturnValue({ query: vi.fn() }),
          getBpm: vi.fn().mockReturnValue(120),
          getCycle: vi.fn().mockReturnValue(0.5),
        },
        Pattern: vi.fn(),
      },
    } as unknown as typeof window;
  });

  describe('render()', () => {
    it('should initialize Strudel pattern and return instance', async () => {
      const result = adapter.render(mockLayer, mockContainer);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('pattern');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('bpm', 120);
    });

    it('should throw error if Strudel is not loaded', () => {
      // Remove strudel from window
      delete (globalThis as unknown as { window: { strudel?: unknown } }).window.strudel;
      
      expect(() => adapter.render(mockLayer, mockContainer))
        .toThrow('Strudel not loaded. Call initialize() first.');
    });

    it('should create controls container with start/stop buttons', async () => {
      adapter.render(mockLayer, mockContainer);
      
      const controls = mockContainer.querySelector('div');
      expect(controls).toBeDefined();
      
      const startBtn = mockContainer.querySelector(`#strudel-start-${mockLayer.id}`);
      const stopBtn = mockContainer.querySelector(`#strudel-stop-${mockLayer.id}`);
      
      expect(startBtn).toBeDefined();
      expect(stopBtn).toBeDefined();
    });

    it('should evaluate pattern code when rendering', async () => {
      const strudel = (globalThis as unknown as { window: typeof window }).window.strudel;
      
      adapter.render(mockLayer, mockContainer);
      
      expect(strudel.repl.evaluate).toHaveBeenCalled();
    });

    it('should store instance info for later retrieval', async () => {
      const instance = adapter.render(mockLayer, mockContainer);
      
      // Verify instance is stored by checking exports work
      const exports = adapter.getExports(mockLayer);
      expect(exports).toBeDefined();
      expect(exports.length).toBeGreaterThan(0);
    });
  });

  describe('getExports()', () => {
    beforeEach(() => {
      adapter.render(mockLayer, mockContainer);
    });

    it('should return pattern export', () => {
      const exports = adapter.getExports(mockLayer);
      
      const patternExport = exports.find(e => e.name === 'pattern');
      expect(patternExport).toBeDefined();
      expect(patternExport?.type).toBe('object');
      expect(typeof patternExport?.getter).toBe('function');
    });

    it('should return BPM export', () => {
      const exports = adapter.getExports(mockLayer);
      
      const bpmExport = exports.find(e => e.name === 'bpm');
      expect(bpmExport).toBeDefined();
      expect(bpmExport?.type).toBe('number');
      expect(bpmExport?.getter()).toBe(120);
    });

    it('should return cycle position export', () => {
      const exports = adapter.getExports(mockLayer);
      
      const cycleExport = exports.find(e => e.name === 'cyclePosition');
      expect(cycleExport).toBeDefined();
      expect(cycleExport?.type).toBe('number');
    });

    it('should return isPlaying export', () => {
      const exports = adapter.getExports(mockLayer);
      
      const playingExport = exports.find(e => e.name === 'isPlaying');
      expect(playingExport).toBeDefined();
      expect(playingExport?.type).toBe('boolean');
    });

    it('should return elapsed time export', () => {
      const exports = adapter.getExports(mockLayer);
      
      const timeExport = exports.find(e => e.name === 'elapsedTime');
      expect(timeExport).toBeDefined();
      expect(timeExport?.type).toBe('number');
    });

    it('should return empty array if layer has not been rendered', () => {
      const unrenderedLayer = { ...mockLayer, id: 'unrendered' };
      const exports = adapter.getExports(unrenderedLayer);
      
      expect(exports).toEqual([]);
    });
  });

  describe('getImports()', () => {
    it('should import from Tone (bpm sync)', () => {
      const imports = adapter.getImports(mockLayer);
      
      const bpmImport = imports.find(i => i.name === 'bpm' && i.from === 'tone');
      expect(bpmImport).toBeDefined();
      expect(bpmImport?.as).toBe('syncBpm');
    });

    it('should import from Tone (isPlaying)', () => {
      const imports = adapter.getImports(mockLayer);
      
      const playingImport = imports.find(i => i.name === 'isPlaying' && i.from === 'tone');
      expect(playingImport).toBeDefined();
      expect(playingImport?.as).toBe('tonePlaying');
    });

    it('should import from p5 (visual triggers)', () => {
      const imports = adapter.getImports(mockLayer);
      
      const frameImport = imports.find(i => i.name === 'frameCount' && i.from === 'p5');
      expect(frameImport).toBeDefined();
      expect(frameImport?.as).toBe('syncFrame');
    });

    it('should import mouseX from p5 for reactive audio', () => {
      const imports = adapter.getImports(mockLayer);
      
      const mouseXImport = imports.find(i => i.name === 'mouseX' && i.from === 'p5');
      expect(mouseXImport).toBeDefined();
      expect(mouseXImport?.as).toBe('modulationX');
    });

    it('should import mouseY from p5 for reactive audio', () => {
      const imports = adapter.getImports(mockLayer);
      
      const mouseYImport = imports.find(i => i.name === 'mouseY' && i.from === 'p5');
      expect(mouseYImport).toBeDefined();
      expect(mouseYImport?.as).toBe('modulationY');
    });
  });

  describe('validate()', () => {
    it('should validate valid Strudel code with s() pattern', () => {
      const validCode = `
$: s("bd sd")
$: note("c3 eb3 g3")
bpm(120)
      `;
      
      const result = adapter.validate({ ...mockLayer, code: validCode });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate valid Strudel code with stack()', () => {
      const validCode = `
stack(
  s("bd*2, sd"),
  note("c3 eb3 g3").s("sawtooth")
).slow(2)
      `;
      
      const result = adapter.validate({ ...mockLayer, code: validCode });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject code without pattern functions', () => {
      const invalidCode = `
const x = 100;
console.log(x);
      `;
      
      const result = adapter.validate({ ...mockLayer, code: invalidCode });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Strudel code must contain pattern functions: s(), note(), stack(), or sound()');
    });

    it('should reject empty code', () => {
      const result = adapter.validate({ ...mockLayer, code: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code with non-ASCII characters', () => {
      const invalidCode = `
$: s("鼓 鈸")
$: note("c3")
      `;
      
      const result = adapter.validate({ ...mockLayer, code: invalidCode });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Strudel code contains non-ASCII characters');
    });

    it('should detect unmatched parentheses', () => {
      const invalidCode = `
$: s("bd sd"
$: note("c3"
      `;
      
      const result = adapter.validate({ ...mockLayer, code: invalidCode });
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('unmatched parentheses'))).toBe(true);
    });
  });

  describe('generateScript()', () => {
    it('should generate valid HTML with Strudel REPL', () => {
      const script = adapter.generateScript(mockLayer, mockGlobalSettings);
      
      expect(script).toContain('strudel');
      expect(script).toContain('<script');
      expect(script).toContain('</script>');
    });

    it('should include Strudel runtime from CDN', () => {
      const script = adapter.generateScript(mockLayer, mockGlobalSettings);
      
      expect(script).toContain('unpkg.com/@strudel');
    });

    it('should include the layer code in the script', () => {
      const script = adapter.generateScript(mockLayer, mockGlobalSettings);
      
      expect(script).toContain('bd sd');
      expect(script).toContain('c3 eb3 g3');
    });

    it('should include BPM setting from global settings', () => {
      const settings = { ...mockGlobalSettings, audio: { ...mockGlobalSettings.audio, enabled: true } };
      const script = adapter.generateScript(mockLayer, settings);
      
      // Should contain bpm initialization
      expect(script).toContain('bpm');
    });

    it('should wrap code in IIFE for isolation', () => {
      const script = adapter.generateScript(mockLayer, mockGlobalSettings);
      
      expect(script).toContain('(function()');
      expect(script).toContain('})()');
    });
  });

  describe('destroy()', () => {
    it('should stop audio when destroying layer', () => {
      const strudel = (globalThis as unknown as { window: typeof window }).window.strudel;
      
      adapter.render(mockLayer, mockContainer);
      adapter.destroy(mockLayer, {});
      
      expect(strudel.repl.stop).toHaveBeenCalled();
    });

    it('should remove instance from internal registry', () => {
      adapter.render(mockLayer, mockContainer);
      
      // Verify instance exists
      const exportsBefore = adapter.getExports(mockLayer);
      expect(exportsBefore.length).toBeGreaterThan(0);
      
      // Destroy and verify exports are empty
      adapter.destroy(mockLayer, {});
      const exportsAfter = adapter.getExports(mockLayer);
      expect(exportsAfter).toEqual([]);
    });

    it('should not throw if layer was not rendered', () => {
      const unrenderedLayer = { ...mockLayer, id: 'unrendered' };
      
      expect(() => adapter.destroy(unrenderedLayer, {})).not.toThrow();
    });
  });

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(strudelAdapter).toBeDefined();
      expect(strudelAdapter).toBeInstanceOf(StrudelAdapter);
    });
  });
});
