/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreeAdapter } from '../../../../src/composition/adapters/ThreeAdapter.js';
import type { Layer } from '../../../../src/composition/types.js';

function createLayer(code: string): Layer {
  return {
    id: 'three-security-layer',
    type: 'three',
    code,
    config: {
      zIndex: 1,
      blendMode: 'normal',
      opacity: 1,
      position: { x: 0, y: 0 },
      scale: 1,
    },
    metadata: {
      prompt: 'three security',
      generator: 'test',
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

function installMockThree(): void {
  class Scene {
    children: unknown[] = [];
    add = vi.fn((obj: unknown) => this.children.push(obj));
    remove = vi.fn();
  }
  class PerspectiveCamera {
    position = { x: 0, y: 0, z: 0 };
    lookAt = vi.fn();
  }
  class WebGLRenderer {
    domElement = document.createElement('canvas');
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    setClearColor = vi.fn();
  }
  class Mesh {
    rotation = { x: 0, y: 0, z: 0 };
    constructor(public geometry: unknown, public material: unknown) {}
  }

  Object.defineProperty(window, 'THREE', {
    configurable: true,
    value: {
      Scene,
      PerspectiveCamera,
      WebGLRenderer,
      BoxGeometry: class BoxGeometry {},
      MeshBasicMaterial: class MeshBasicMaterial {
        constructor(public params: unknown) {}
      },
      Mesh,
      Color: class Color {
        constructor(public color: string | number) {}
      },
    },
  });
}

describe('ThreeAdapter security', () => {
  let adapter: ThreeAdapter;
  let container: HTMLElement;
  let rafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    installMockThree();
    adapter = new ThreeAdapter();
    container = document.createElement('div');
    adapter.initialize();
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'THREE');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Reflect.deleteProperty(window as any, '__trackObject');
  });

  it('blocks browser escape hatches before execution', () => {
    const fetchSpy = vi.fn();
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchSpy });
    const layer = createLayer('fetch("https://evil.test"); const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0xff0000 }));');

    const result = adapter.render(layer, container) as { objects: unknown[] };

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.objects).toHaveLength(0);
  });

  it('cleans up the object tracking global after generated code throws', () => {
    const layer = createLayer('throw new Error("boom");');

    adapter.render(layer, container);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__trackObject).toBeUndefined();
  });

  it('starts the render loop for safe code', () => {
    const layer = createLayer('camera.position.z = 5;');

    adapter.render(layer, container);

    expect(rafSpy).toHaveBeenCalled();
  });
});
