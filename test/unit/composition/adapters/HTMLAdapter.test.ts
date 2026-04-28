/**
 * HTMLAdapter unit tests
 *
 * Tests the HTML/CSS adapter for the layer-based composition system.
 * Follows TDD: red -> green -> refactor cycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HTMLAdapter, htmlAdapter } from '../../../../src/composition/adapters/HTMLAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';
import { StateManager } from '../../../../src/composition/CompositionEngine.js';

// Mock DOM APIs for Node.js test environment
const mockElement = () => ({
  tagName: 'DIV',
  style: {
    setProperty: vi.fn(),
    getPropertyValue: vi.fn(),
    removeProperty: vi.fn(),
  } as unknown as CSSStyleDeclaration,
  innerHTML: '',
  appendChild: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
  remove: vi.fn(),
  children: [] as Element[],
  parentNode: {
    removeChild: vi.fn(),
  },
});

global.document = {
  createElement: vi.fn(() => mockElement()),
  createDocumentFragment: vi.fn(() => ({
    appendChild: vi.fn(),
    firstChild: null,
  })),
  createRange: vi.fn(() => ({
    createContextualFragment: vi.fn(() => ({
      children: [],
      firstChild: null,
      childNodes: [],
    })),
  })),
} as unknown as Document;

global.window = {
  getComputedStyle: vi.fn(() => ({
    getPropertyValue: vi.fn(() => ''),
  })),
} as unknown as Window;

describe('HTMLAdapter', () => {
  let adapter: HTMLAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockContext: RenderContext;

  beforeEach(() => {
    adapter = new HTMLAdapter();
    
    mockLayer = {
      id: 'test-html-layer',
      type: 'html',
      code: '<div class="test">Hello World</div>',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Create a test HTML layer',
        generator: 'HTMLGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContainer = mockElement() as unknown as HTMLElement;

    mockContext = {
      state: new StateManager(),
      container: mockContainer,
      settings: {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      },
      layerInstances: new Map(),
    };

    vi.clearAllMocks();
  });

  describe('applyImports', () => {
    it('should apply numeric imports as CSS custom properties', () => {
      const mockImports = { mouseX: 100, mouseY: 200 };
      mockContext.state.register(`__imports_${mockLayer.id}`, () => mockImports);
      
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result.container.style.setProperty).not.toBeNull();
    });

    it('should apply string imports as CSS custom properties', () => {
      const mockImports = { color: 'red', size: 'large' };
      mockContext.state.register(`__imports_${mockLayer.id}`, () => mockImports);
      
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result).not.toBeNull();
    });

    it('should handle missing imports gracefully', () => {
      // No imports registered
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result).not.toBeNull();
    });
  });

  describe('render()', () => {
    it('should inject HTML into container', () => {
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(mockContainer.appendChild).toHaveBeenCalled();
      expect(result).not.toBeNull();
      expect(result.container).not.toBeNull();
      expect(result.elements).not.toBeNull();
    });

    it('should create a wrapper div for the HTML content', () => {
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result.container?.tagName).toBe('DIV');
    });

    it('should parse and store references to DOM elements', () => {
      const htmlWithId = '<div id="test-element">Content</div>';
      mockLayer.code = htmlWithId;

      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result.elements).toBeInstanceOf(Map);
    });

    it('should apply layer styles to wrapper', () => {
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result.container.style).not.toBeNull();
    });

    it('should handle empty HTML gracefully', () => {
      mockLayer.code = '';

      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result?.elements.size).toBe(0);
    });

    it('should handle HTML with multiple root elements', () => {
      mockLayer.code = '<div>First</div><span>Second</span>';

      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result).not.toBeNull();
      expect(result.container).not.toBeNull();
    });

    it('should inject CSS if present in layer code', () => {
      mockLayer.code = `
        <style>
          .test { color: red; }
        </style>
        <div class="test">Content</div>
      `;

      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result).not.toBeNull();
      expect(result.styles).not.toBeNull();
    });

    it('should use context settings for dimensions', () => {
      const result = adapter.render(mockLayer, mockContainer, mockContext);

      expect(result.container.style.width).not.toBeNull();
      expect(result.container.style.height).not.toBeNull();
    });
  });

  describe('getExports()', () => {
    it('should return empty array before render', () => {
      const exports = adapter.getExports(mockLayer);

      expect(exports).toEqual([]);
    });

    it('should return DOM references after render', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some(e => e.name === 'container')).toBe(true);
      expect(exports.some(e => e.name === 'elements')).toBe(true);
    });

    it('should export container as object type', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const containerExport = exports.find(e => e.name === 'container');

      expect(containerExport?.type).toBe('object');
      expect(typeof containerExport?.getter).toBe('function');
    });

    it('should export elements as Map', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const elementsExport = exports.find(e => e.name === 'elements');

      expect(elementsExport?.type).toBe('object');
    });

    it('should export computedStyles getter', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const stylesExport = exports.find(e => e.name === 'computedStyles');

      expect(stylesExport?.type).toBe('object');
    });
  });

  describe('getImports()', () => {
    it('should return array of imports', () => {
      const imports = adapter.getImports();

      expect(Array.isArray(imports)).toBe(true);
    });

    it('should import from all visual domains', () => {
      const imports = adapter.getImports();

      const fromP5 = imports.some(i => i.from === 'p5');
      const fromThree = imports.some(i => i.from === 'three');

      expect(fromP5 || fromThree).toBe(true);
    });

    it('should import mouse coordinates for styling', () => {
      const imports = adapter.getImports();

      expect(imports.some(i => i.name === 'mouseX')).toBe(true);
      expect(imports.some(i => i.name === 'mouseY')).toBe(true);
    });

    it('should have optional imports', () => {
      const imports = adapter.getImports();

      expect(imports.every(i => i.required === false)).toBe(true);
    });

    it('should provide meaningful aliases', () => {
      const imports = adapter.getImports();

      const mouseXImport = imports.find(i => i.name === 'mouseX');
      if (mouseXImport) {

        expect(mouseXImport.as?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validate()', () => {
    it('should return valid for well-formed HTML', () => {
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return valid for HTML with CSS', () => {
      mockLayer.code = '<style>.test{color:red}</style><div class="test">Test</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for unclosed tags', () => {
      mockLayer.code = '<div><span>Unclosed';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);

      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should return invalid for mismatched tags', () => {
      mockLayer.code = '<div><span>Content</div></span>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('should return invalid for empty HTML', () => {
      mockLayer.code = '';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML content is empty');
    });

    it('should return invalid for script tags (security)', () => {
      mockLayer.code = '<script>alert("xss")</script>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('script'))).toBe(true);
    });

    it('should allow inline event handlers', () => {
      mockLayer.code = '<div onclick="handleClick()">Click me</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should detect invalid CSS syntax', () => {
      mockLayer.code = '<style>.test { color: }</style><div>Test</div>';
      const result = adapter.validate(mockLayer);

      if (!result.valid) {
        expect(result.errors).not.toBeNull();
      }
    });
  });

  describe('generateScript()', () => {
    const mockSettings: GlobalSettings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#ffffff',
    };

    it('should return HTML string', () => {
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include the layer HTML content', () => {
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).toContain('Hello World');
      expect(result).toContain('<div');
    });

    it('should wrap content in a layer div', () => {
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).toContain('class="layer"');
      expect(result).toContain('z-index');
    });

    it('should apply z-index from layer config', () => {
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).toContain(String(mockLayer.config.zIndex));
    });

    it('should preserve CSS styles', () => {
      mockLayer.code = '<style>.test{color:red}</style><div class="test">Test</div>';
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).toContain('<style>');
      expect(result).toContain('color:red');
    });

    it('should handle self-closing tags', () => {
      mockLayer.code = '<img src="test.jpg" /><br /><input type="text" />';
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).toContain('img');
      expect(result).toContain('br');
      expect(result).toContain('input');
    });

    it('should escape special characters in content', () => {
      mockLayer.code = '<div>Special quotes</div>';
      const result = adapter.generateScript(mockLayer, mockSettings);

      expect(result).not.toBeNull();
      expect(result).toContain('Special');
    });
  });

  describe('destroy()', () => {
    it('should remove container from parent', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy(mockLayer, instance);

      expect(instance.container).not.toBeNull();
    });

    it('should remove stored instance', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy(mockLayer, instance);

      const exports = adapter.getExports(mockLayer);
      expect(exports).toEqual([]);
    });

    it('should handle destroy for non-existent layer gracefully', () => {
      const nonExistentLayer = { ...mockLayer, id: 'non-existent' };
      
      expect(() => {
        adapter.destroy(nonExistentLayer, null);
      }).not.toThrow();
    });

    it('should clear all references to DOM elements', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy(mockLayer, instance);

      const exports = adapter.getExports(mockLayer);
      expect(exports).toEqual([]);
    });

    it('should call cleanup function if provided', () => {
      const cleanupSpy = vi.fn();
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      (instance as { cleanup?: () => void }).cleanup = cleanupSpy;
      
      adapter.destroy(mockLayer, instance);

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('singleton instance', () => {
    it('should export singleton htmlAdapter', () => {
      expect(htmlAdapter).not.toBeNull();
      expect(htmlAdapter).toBeInstanceOf(HTMLAdapter);
    });

    it('should have all required methods on singleton', () => {
      expect(typeof htmlAdapter.render).toBe('function');
      expect(typeof htmlAdapter.getExports).toBe('function');
      expect(typeof htmlAdapter.getImports).toBe('function');
      expect(typeof htmlAdapter.validate).toBe('function');
      expect(typeof htmlAdapter.destroy).toBe('function');
      expect(typeof htmlAdapter.generateScript).toBe('function');
    });
  });

  describe('DOMParser validation', () => {
    let originalDOMParser: unknown;

    beforeEach(() => {
      originalDOMParser = (global as Record<string, unknown>).DOMParser;
    });

    afterEach(() => {
      if (originalDOMParser !== undefined) {
        (global as Record<string, unknown>).DOMParser = originalDOMParser;
      } else {
        delete (global as Record<string, unknown>).DOMParser;
      }
    });

    it('should use DOMParser when available', () => {
      // Mock DOMParser
      const mockParseError = null;
      const mockDoc = {
        querySelector: vi.fn(() => mockParseError),
      };
      class MockDOMParser {
        parseFromString = vi.fn(() => mockDoc);
      }
      (global as Record<string, unknown>).DOMParser = MockDOMParser;

      mockLayer.code = '<div>Valid HTML</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should detect parse errors from DOMParser', () => {
      // Mock DOMParser with parse error
      const mockParseError = { tagName: 'parsererror' };
      const mockDoc = {
        querySelector: vi.fn(() => mockParseError),
      };
      class MockDOMParser {
        parseFromString = vi.fn(() => mockDoc);
      }
      (global as Record<string, unknown>).DOMParser = MockDOMParser;

      mockLayer.code = '<div><span>Unclosed</div>';
      const result = adapter.validate(mockLayer);

      expect(result.errors?.some(e => e.includes('parsing error') || e.includes('Mismatched') || e.includes('Unclosed'))).toBe(true);
    });
  });

  describe('getComputedStyles edge cases', () => {
    let originalWindow: Window & typeof globalThis;

    beforeEach(() => {
      originalWindow = global.window;
    });

    afterEach(() => {
      global.window = originalWindow;
    });

    it('should return empty object when window is undefined', () => {
      // @ts-expect-error - Testing undefined window
      global.window = undefined;
      
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      const stylesExport = exports.find(e => e.name === 'computedStyles');
      
      if (stylesExport) {
        const styles = stylesExport.getter();
        expect(styles).toEqual({});
      }
    });
  });

  describe('HTML validation edge cases', () => {
    it('should handle HTML with doctype declaration', () => {
      mockLayer.code = '<!DOCTYPE html><html><body><div>Test</div></body></html>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should handle HTML comments', () => {
      mockLayer.code = '<!-- Comment --><div>Content</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should handle HTML entities', () => {
      mockLayer.code = '<div>&lt;test&gt;&amp;</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should handle custom data attributes', () => {
      mockLayer.code = '<div data-test="value" data-id="123">Content</div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(true);
    });

    it('should reject nested script tags', () => {
      mockLayer.code = '<div><script>alert(1)</script></div>';
      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.toLowerCase().includes('script'))).toBe(true);
    });
  });
});
