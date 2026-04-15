/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { P5Adapter } from '../../../../src/composition/adapters/P5Adapter.js';
import type { Layer } from '../../../../src/composition/types.js';

interface MockP5Instance {
  setup: () => void;
  draw: () => void;
  canvas?: HTMLCanvasElement;
  width: number;
  height: number;
  mouseX: number;
  mouseY: number;
  pmouseX: number;
  pmouseY: number;
  frameCount: number;
  millis: () => number;
  remove: () => void;
  createCanvas: (w: number, h: number) => { elt: HTMLCanvasElement };
  marker?: string;
}

function createLayer(code: string): Layer {
  return {
    id: 'p5-security-layer',
    type: 'p5',
    code,
    config: {
      zIndex: 1,
      blendMode: 'normal',
      opacity: 1,
      position: { x: 0, y: 0 },
      scale: 1,
    },
    metadata: {
      prompt: 'p5 security',
      generator: 'test',
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

function installMockP5(): void {
  class MockP5 implements MockP5Instance {
    setup = () => {};
    draw = () => {};
    canvas?: HTMLCanvasElement;
    width = 800;
    height = 600;
    mouseX = 0;
    mouseY = 0;
    pmouseX = 0;
    pmouseY = 0;
    frameCount = 0;
    marker?: string;
    millis = vi.fn(() => 0);
    remove = vi.fn();
    createCanvas = vi.fn((w: number, h: number) => {
      this.width = w;
      this.height = h;
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      return { elt: this.canvas };
    });

    constructor(sketch: (p: MockP5Instance) => void, container: HTMLElement) {
      sketch(this);
      container.appendChild(document.createElement('canvas'));
    }
  }

  Object.defineProperty(window, 'p5', {
    configurable: true,
    value: MockP5,
  });
}

describe('P5Adapter security', () => {
  let adapter: P5Adapter;
  let container: HTMLElement;

  beforeEach(() => {
    installMockP5();
    adapter = new P5Adapter();
    container = document.createElement('div');
    adapter.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'p5');
  });

  it('executes benign setup and draw bodies', () => {
    const layer = createLayer(`
      function setup() { p.marker = "setup"; }
      function draw() { p.marker = p.marker + ":draw"; }
    `);

    const instance = adapter.render(layer, container) as unknown as MockP5Instance;
    instance.setup();
    instance.draw();

    expect(instance.marker).toBe('setup:draw');
  });

  it('blocks unsafe setup body before execution', () => {
    const fetchSpy = vi.fn();
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchSpy });
    const layer = createLayer(`
      function setup() { fetch("https://evil.test"); p.marker = "unsafe"; }
      function draw() { p.marker = "draw"; }
    `);

    const instance = adapter.render(layer, container) as unknown as MockP5Instance;
    instance.setup();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(instance.marker).toBeUndefined();
  });

  it('blocks unsafe draw body before execution', () => {
    const layer = createLayer(`
      function setup() { p.marker = "setup"; }
      function draw() { setTimeout("alert(1)", 0); p.marker = "unsafe"; }
    `);

    const instance = adapter.render(layer, container) as unknown as MockP5Instance;
    instance.setup();
    instance.draw();

    expect(instance.marker).toBe('setup');
  });
});
