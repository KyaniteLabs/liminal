/**
 * RevideoAdapter Tests
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RevideoAdapter, revideoAdapter } from '../../../../src/composition/adapters/RevideoAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';

const createMockLayer = (overrides?: Partial<Layer>): Layer => ({
  id: 'test-layer-1',
  type: 'revideo',
  code: `
import {makeScene, useTime} from '@revideo/core';
import {Circle} from '@revideo/2d';

export default makeScene(function* (view) {
  const time = useTime();
  view.add(<Circle width={100} fill="red" />);
  yield* time(2, 1);
});
`,
  config: {
    zIndex: 1,
    blendMode: 'normal',
    opacity: 1.0,
    position: { x: 0, y: 0 },
    scale: 1.0,
  },
  metadata: {
    prompt: 'Create a test scene',
    generator: 'RevideoGenerator',
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

describe('RevideoAdapter', () => {
  let adapter: RevideoAdapter;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new RevideoAdapter();
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-container';
    document.body.appendChild(mockContainer);
    vi.clearAllMocks();
  });

  afterEach(() => {
    const existing = document.getElementById('test-container');
    if (existing) {
      existing.remove();
    }
    vi.resetAllMocks();
  });

  describe('initialize()', () => {
    it('should initialize without errors', () => {
      expect(() => adapter.initialize()).not.toThrow();
    });
  });

  describe('render()', () => {
    it('should render a Revideo layer into container', () => {
      adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      const instance = adapter.render(layer, mockContainer, context);

      expect(instance).toBeDefined();
      expect(instance.scene).toBeDefined();
      expect(instance.scene.duration).toBe(2);
    });

    it('should create player container element', () => {
      adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);

      const playerContainer = mockContainer.querySelector('.revideo-player-container');
      expect(playerContainer).toBeTruthy();
    });

    it('should throw if not initialized', () => {
      const layer = createMockLayer();
      const context = createMockRenderContext();

      expect(() => adapter.render(layer, mockContainer, context)).toThrow('Revideo not initialized');
    });
  });

  describe('validate()', () => {
    it('should validate correct Revideo code', () => {
      const layer = createMockLayer();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('should fail validation for missing makeScene', () => {
      const layer = createMockLayer({
        code: `import {useTime} from '@revideo/core'; export default function() {}`,
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('makeScene'))).toBe(true);
    });

    it('should fail validation for missing export default', () => {
      const layer = createMockLayer({
        code: `import {makeScene} from '@revideo/core'; const scene = makeScene(() => {});`,
      });
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('export default'))).toBe(true);
    });
  });

  describe('getExports()', () => {
    it('should return exports for rendered layer', () => {
      adapter.initialize();
      const layer = createMockLayer();
      const context = createMockRenderContext();

      adapter.render(layer, mockContainer, context);
      const exports = adapter.getExports(layer);

      expect(exports).toBeDefined();
      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some(e => e.name === 'time')).toBe(true);
      expect(exports.some(e => e.name === 'frame')).toBe(true);
    });
  });

  describe('getImports()', () => {
    it('should return imports for cross-layer communication', () => {
      const layer = createMockLayer();
      const imports = adapter.getImports(layer);

      expect(imports).toBeDefined();
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should export singleton instance', () => {
      expect(revideoAdapter).toBeDefined();
      expect(revideoAdapter).toBeInstanceOf(RevideoAdapter);
    });
  });
});
