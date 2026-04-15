/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HydraAdapter } from '../../../../src/composition/adapters/HydraAdapter.js';
import type { Layer } from '../../../../src/composition/types.js';

function createLayer(code: string): Layer {
  return {
    id: 'hydra-security-layer',
    type: 'hydra',
    code,
    config: {
      zIndex: 1,
      blendMode: 'normal',
      opacity: 1,
      position: { x: 0, y: 0 },
      scale: 1,
    },
    metadata: {
      prompt: 'hydra security',
      generator: 'test',
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

function installMockHydra(): void {
  class MockHydra {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    stop = vi.fn();
    start = vi.fn();
    setResolution = vi.fn();
    src = vi.fn(() => this);
    o0 = { src: vi.fn() };
    o1 = { src: vi.fn() };
    o2 = { src: vi.fn() };
    o3 = { src: vi.fn() };

    constructor(options: { canvas: HTMLCanvasElement; width?: number; height?: number }) {
      this.canvas = options.canvas;
      this.width = options.width ?? 800;
      this.height = options.height ?? 600;
    }
  }

  Object.defineProperty(window, 'Hydra', {
    configurable: true,
    value: MockHydra,
  });
}

describe('HydraAdapter security', () => {
  let adapter: HydraAdapter;
  let container: HTMLElement;

  beforeEach(() => {
    installMockHydra();
    adapter = new HydraAdapter();
    container = document.createElement('div');
    adapter.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'Hydra');
    Reflect.deleteProperty(window, '__hydraMarker');
  });

  it('executes benign Hydra code', () => {
    const layer = createLayer('globalThis.__hydraMarker = "ran";');

    adapter.render(layer, container);

    expect((window as unknown as { __hydraMarker?: string }).__hydraMarker).toBe('ran');
  });

  it('blocks browser escape hatches before execution', () => {
    const fetchSpy = vi.fn();
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchSpy });
    const layer = createLayer('fetch("https://evil.test"); globalThis.__hydraMarker = "unsafe";');

    adapter.render(layer, container);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect((window as unknown as { __hydraMarker?: string }).__hydraMarker).toBeUndefined();
  });

  it('blocks string-based dynamic execution', () => {
    const layer = createLayer('setTimeout("alert(1)", 0); globalThis.__hydraMarker = "unsafe";');

    adapter.render(layer, container);

    expect((window as unknown as { __hydraMarker?: string }).__hydraMarker).toBeUndefined();
  });
});
