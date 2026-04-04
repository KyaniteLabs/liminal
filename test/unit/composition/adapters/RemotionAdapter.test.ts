/**
 * RemotionAdapter Tests - TDD: RED Phase
 *
 * Tests for the RemotionAdapter that renders Remotion video compositions.
 * All tests should initially FAIL (RED phase of TDD).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemotionAdapter } from '../../../../src/composition/adapters/RemotionAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';

// Mock Remotion module
const mockUseCurrentFrame = vi.fn().mockReturnValue(0);
const mockAbsoluteFill = ({ children }: { children: React.ReactNode }) => children;
const mockComposition = ({ children }: { children: React.ReactNode }) => children;
const mockPlayer = vi.fn();

vi.mock('remotion', () => ({
  useCurrentFrame: () => mockUseCurrentFrame(),
  AbsoluteFill: mockAbsoluteFill,
  Composition: mockComposition,
  Player: mockPlayer,
  getRemotionEnvironment: () => ({ isStudio: false }),
  continueRender: vi.fn(),
  delayRender: vi.fn().mockReturnValue('handle'),
}));

// Test fixtures
const createMockLayer = (overrides?: Partial<Layer>): Layer => ({
  id: 'test-layer-1',
  type: 'remotion',
  code: `
import { useCurrentFrame, AbsoluteFill } from 'remotion';

export const MyComposition = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div style={{ fontSize: 64 }}>Frame {frame}</div>
    </AbsoluteFill>
  );
};
`,
  config: {
    zIndex: 1,
    blendMode: 'normal',
    opacity: 1.0,
    position: { x: 0, y: 0 },
    scale: 1.0,
  },
  metadata: {
    prompt: 'Create a test composition',
    generator: 'RemotionGenerator',
    model: 'test-model',
    generatedAt: new Date().toISOString(),
  },
  enabled: true,
  locked: false,
  ...overrides,
});

const mockGlobalSettings: GlobalSettings = {
  width: 1920,
  height: 1080,
  frameRate: 30,
  backgroundColor: '#000000',
  audio: {
    sampleRate: 44100,
    enabled: true,
    volume: 0.8,
  },
};

const createMockRenderContext = (): RenderContext => ({
  state: {
    register: vi.fn(),
    get: vi.fn(),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
    clear: vi.fn(),
  },
  container: document.createElement('div'),
  settings: mockGlobalSettings,
  layerInstances: new Map(),
});

describe('RemotionAdapter', () => {
  let adapter: RemotionAdapter;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new RemotionAdapter();
    mockContainer = document.createElement('div');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize()', () => {
    it('should initialize without errors', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should load Remotion module dynamically', async () => {
      await adapter.initialize();
      // After initialization, the adapter should have the module
      expect(adapter).toBeDefined();
    });
  });

  describe('render()', () => {
    it('should throw error if initialize() was not called', () => {
      const layer = createMockLayer();
      expect(() => adapter.render(layer, mockContainer)).toThrow(
        'Remotion not loaded. Call initialize() first.'
      );
    });

    it('should initialize Remotion player in container', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);

      // Should create a container for the Remotion player
      const playerContainer = mockContainer.querySelector('.remotion-player-container');
      expect(playerContainer).toBeTruthy();
    });

    it('should set correct dimensions from context settings', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);

      const playerContainer = mockContainer.querySelector('.remotion-player-container') as HTMLElement;
      expect(playerContainer).toBeTruthy();
    });

    it('should return an instance object', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      const instance = adapter.render(layer, mockContainer, context);

      expect(instance).toBeDefined();
      expect(typeof instance).toBe('object');
    });

    it('should store instance reference for exports', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      const instance = adapter.render(layer, mockContainer, context);

      // Instance should be trackable
      expect(instance).toBeTruthy();
    });
  });

  describe('getExports()', () => {
    it('should return empty array if layer not rendered', () => {
      const layer = createMockLayer();
      const exports = adapter.getExports(layer);
      expect(exports).toEqual([]);
    });

    it('should export frame number', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      const exports = adapter.getExports(layer);

      const frameExport = exports.find(e => e.name === 'frame');
      expect(frameExport).toBeDefined();
      expect(frameExport?.type).toBe('number');
      expect(typeof frameExport?.getter).toBe('function');
    });

    it('should export composition config', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      const exports = adapter.getExports(layer);

      const configExport = exports.find(e => e.name === 'config');
      expect(configExport).toBeDefined();
      expect(configExport?.type).toBe('object');
    });

    it('should export current playback state', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      const exports = adapter.getExports(layer);

      const isPlayingExport = exports.find(e => e.name === 'isPlaying');
      expect(isPlayingExport).toBeDefined();
      expect(isPlayingExport?.type).toBe('boolean');
    });

    it('should export duration in frames', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      const exports = adapter.getExports(layer);

      const durationExport = exports.find(e => e.name === 'durationInFrames');
      expect(durationExport).toBeDefined();
      expect(durationExport?.type).toBe('number');
    });
  });

  describe('getImports()', () => {
    it('should return imports for cross-layer composition', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      expect(Array.isArray(imports)).toBe(true);
    });

    it('should import frame count from p5 layers', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      const p5FrameImport = imports.find(
        i => i.from === 'p5' && i.name === 'frameCount'
      );
      expect(p5FrameImport).toBeDefined();
      expect(p5FrameImport?.as).toBe('syncFrame');
    });

    it('should import canvas from p5 layers', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      const p5CanvasImport = imports.find(
        i => i.from === 'p5' && i.name === 'canvas'
      );
      expect(p5CanvasImport).toBeDefined();
      expect(p5CanvasImport?.as).toBe('sourceCanvas');
    });

    it('should import audio state from tone layers', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      const toneIsPlaying = imports.find(
        i => i.from === 'tone' && i.name === 'isPlaying'
      );
      expect(toneIsPlaying).toBeDefined();
    });

    it('should mark imports as optional', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      imports.forEach(imp => {
        expect(imp.required).toBe(false);
      });
    });
  });

  describe('validate()', () => {
    it('should validate code with Remotion imports', () => {
      const layer = createMockLayer();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should catch missing Remotion imports', () => {
      const layer = createMockLayer({
        code: 'const frame = 0; export const Comp = () => <div>{frame}</div>;',
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing Remotion imports (remotion not found)');
    });

    it('should catch missing useCurrentFrame hook', () => {
      const layer = createMockLayer({
        code: `import { AbsoluteFill } from 'remotion';
export const Comp = () => <AbsoluteFill><div>Static</div></AbsoluteFill>;`,
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing useCurrentFrame hook');
    });

    it('should catch missing Composition export', () => {
      const layer = createMockLayer({
        code: `import { useCurrentFrame } from 'remotion';
const frame = useCurrentFrame();
export default () => <div>{frame}</div>;`,
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing exported Composition component');
    });

    it('should return all validation errors at once', () => {
      const layer = createMockLayer({
        code: 'const x = 1;',
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('generateScript()', () => {
    it('should generate valid HTML with Remotion player', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain('<script');
      expect(script).toContain('</script>');
    });

    it('should include Remotion bundle script', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain('remotion');
    });

    it('should set correct composition dimensions', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain(String(mockGlobalSettings.width));
      expect(script).toContain(String(mockGlobalSettings.height));
    });

    it('should include frame rate in output', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain(String(mockGlobalSettings.frameRate));
    });

    it('should wrap layer code in IIFE', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain('(function()');
      expect(script).toContain('})();');
    });

    it('should set z-index from layer config', () => {
      const layer = createMockLayer({ config: { ...createMockLayer().config, zIndex: 5 } });
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain('z-index: 5');
      expect(script).toContain('zIndex: 5');
    });

    it('should generate HTML that creates a container div', () => {
      const layer = createMockLayer();
      const script = adapter.generateScript(layer, mockGlobalSettings);

      expect(script).toContain('createElement');
      expect(script).toContain('appendChild');
    });
  });

  describe('destroy()', () => {
    it('should clean up instance on destroy', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      const instance = adapter.render(layer, mockContainer, context);
      
      // Should not throw
      expect(() => adapter.destroy(layer, instance)).not.toThrow();
    });

    it('should remove player container from DOM', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      
      const instance = adapter.render(layer, mockContainer, context);
      adapter.destroy(layer, instance);

      const playerContainer = mockContainer.querySelector('.remotion-player-container');
      // After destroy, the player should be removed or marked as destroyed
      expect(adapter.getExports(layer)).toEqual([]);
    });

    it('should handle destroy for non-existent layer', () => {
      const layer = createMockLayer({ id: 'non-existent' });
      
      // Should not throw even if layer was never rendered
      expect(() => adapter.destroy(layer, null)).not.toThrow();
    });

    it('should clean up all event listeners', async () => {
      await adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      const instance = adapter.render(layer, mockContainer, context);
      
      // Destroy should complete without errors
      expect(() => adapter.destroy(layer, instance)).not.toThrow();
    });
  });

  describe('singleton export', () => {
    it('should export remotionAdapter singleton', async () => {
      const { remotionAdapter } = await import('../../../../src/composition/adapters/RemotionAdapter.js');
      expect(remotionAdapter).toBeDefined();
      expect(remotionAdapter).toBeInstanceOf(RemotionAdapter);
    });
  });
});
