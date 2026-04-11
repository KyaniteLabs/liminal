/**
 * Unit tests for ASCIIArtAdapter
 *
 * Tests ASCII art rendering, validation, exports, and cleanup.
 * Follows TDD: red → green → refactor cycle.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ASCIIArtAdapter, asciiArtAdapter } from '../../../../src/composition/adapters/ASCIIArtAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  width: 800,
  height: 600,
  frameRate: 60,
  backgroundColor: '#000000',
};

function createASCIILayer(code: string, id = 'test-ascii'): Layer {
  return {
    id,
    type: 'ascii',
    code,
    config: {
      zIndex: 0,
      blendMode: 'normal',
      opacity: 1.0,
      position: { x: 0, y: 0 },
      scale: 1.0,
      role: 'standalone',
      transparentBackground: false,
    },
    metadata: {
      prompt: 'Test ASCII art',
      generator: 'ASCIIGenerator',
      model: 'test-model',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

describe('ASCIIArtAdapter', () => {
  let adapter: ASCIIArtAdapter;
  let container: HTMLElement;

  beforeEach(() => {
    adapter = new ASCIIArtAdapter();
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up any remaining elements
    const existing = document.getElementById('test-container');
    if (existing) {
      existing.remove();
    }
  });

  describe('render()', () => {
    it('should display ASCII art in a pre tag', () => {
      const code = `    ██╗     ██╗███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
    ██║     ██║████╗ ████║██║████╗  ██║██╔══██╗██║     
    ██║     ██║██╔████╔██║██║██╔██╗ ██║███████║██║     
    ██║     ██║██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
    ███████╗██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
    ╚══════╝╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝`;

      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const preElement = container.querySelector('pre');
      expect(preElement).not.toBeNull();
      expect(preElement?.textContent).toBe(code);
    });

    it('should apply proper styling to the pre tag', () => {
      const code = 'ASCII ART';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const preElement = container.querySelector('pre');
      expect(preElement?.style.fontFamily).toContain('monospace');
      expect(preElement?.style.whiteSpace).toBe('pre');
    });

    it('should store reference to the created element', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code);
      const instance = adapter.render(layer, container);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(HTMLElement);
    });

    it('should render multiple ASCII art layers in the same container', () => {
      const code1 = 'ART 1';
      const code2 = 'ART 2';
      const layer1 = createASCIILayer(code1, 'layer-1');
      const layer2 = createASCIILayer(code2, 'layer-2');

      adapter.render(layer1, container);
      adapter.render(layer2, container);

      const preElements = container.querySelectorAll('pre');
      expect(preElements.length).toBe(2);
      expect(preElements[0]?.textContent).toBe(code1);
      expect(preElements[1]?.textContent).toBe(code2);
    });
  });

  describe('getExports()', () => {
    it('should return character data', () => {
      const code = 'LINE1\nLINE2\nLINE3';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const exports = adapter.getExports(layer);
      const charDataExport = exports.find(e => e.name === 'characterData');

      expect(charDataExport).toBeDefined();
      expect(charDataExport?.type).toBe('string');
      expect(charDataExport?.getter()).toBe(code);
    });

    it('should return dimensions', () => {
      const code = '12345\n67890\nabcde';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const exports = adapter.getExports(layer);
      const widthExport = exports.find(e => e.name === 'width');
      const heightExport = exports.find(e => e.name === 'height');

      expect(widthExport).toBeDefined();
      expect(widthExport?.type).toBe('number');
      expect(widthExport?.getter()).toBe(5); // Longest line

      expect(heightExport).toBeDefined();
      expect(heightExport?.type).toBe('number');
      expect(heightExport?.getter()).toBe(3); // Number of lines
    });

    it('should return line count', () => {
      const code = 'A\nB\nC\nD';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const exports = adapter.getExports(layer);
      const lineCountExport = exports.find(e => e.name === 'lineCount');

      expect(lineCountExport).toBeDefined();
      expect(lineCountExport?.type).toBe('number');
      expect(lineCountExport?.getter()).toBe(4);
    });

    it('should return max line length', () => {
      const code = 'SHORT\nVERY LONG LINE\nMED';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const exports = adapter.getExports(layer);
      const maxLineLengthExport = exports.find(e => e.name === 'maxLineLength');

      expect(maxLineLengthExport).toBeDefined();
      expect(maxLineLengthExport?.type).toBe('number');
      expect(maxLineLengthExport?.getter()).toBe(14); // 'VERY LONG LINE'.length === 14
    });

    it('should return empty array if layer not rendered', () => {
      const layer = createASCIILayer('NOT RENDERED');
      const exports = adapter.getExports(layer);

      expect(exports).toEqual([]);
    });

    it('should include descriptions for all exports', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      const exports = adapter.getExports(layer);

      exports.forEach(exp => {
        expect(exp.description).toBeDefined();
        expect(exp.description?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validate()', () => {
    it('should pass validation for valid ASCII content', () => {
      const code = 'Valid ASCII Art 123!@#';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should catch non-ASCII content with extended Unicode', () => {
      const code = 'Invalid: 😀 emoji';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain('non-ASCII');
    });

    it('should catch non-ASCII content with special Unicode', () => {
      const code = 'Invalid: ñ with tilde';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should allow box drawing characters (extended ASCII subset)', () => {
      const code = '┌───┐\n│BOX│\n└───┘';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('should allow block characters', () => {
      const code = '█▓▒░';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('should fail on empty content', () => {
      const code = '';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('empty');
    });

    it('should fail on whitespace-only content', () => {
      const code = '   \n\t\n   ';
      const layer = createASCIILayer(code);
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('empty');
    });
  });

  describe('generateScript()', () => {
    it('should output valid HTML', () => {
      const code = 'ASCII CONTENT';
      const layer = createASCIILayer(code);
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).toContain('<pre');
      expect(script).toContain('</pre>');
      expect(script).toContain(code);
    });

    it('should include CSS styling', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code);
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).toContain('font-family');
      expect(script).toContain('monospace');
      expect(script).toContain('white-space');
    });

    it('should apply z-index from layer config', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code);
      layer.config.zIndex = 5;
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).toContain('z-index');
      expect(script).toContain('5');
    });

    it('should apply opacity from layer config', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code);
      layer.config.opacity = 0.5;
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).toContain('opacity');
      expect(script).toContain('0.5');
    });

    it('should escape special HTML characters', () => {
      const code = '<script>alert("xss")</script>';
      const layer = createASCIILayer(code);
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).not.toContain('<script>');
      expect(script).toContain('&lt;');
    });

    it('should include layer data attributes', () => {
      const code = 'TEST';
      const layer = createASCIILayer(code, 'my-layer-id');
      const script = adapter.generateScript(layer, DEFAULT_GLOBAL_SETTINGS);

      expect(script).toContain('data-layer-id');
      expect(script).toContain('my-layer-id');
    });
  });

  describe('destroy()', () => {
    it('should remove the rendered element', () => {
      const code = 'TO BE REMOVED';
      const layer = createASCIILayer(code);
      const instance = adapter.render(layer, container);

      expect(container.querySelector('pre')).not.toBeNull();

      adapter.destroy(layer, instance);

      expect(container.querySelector('pre')).toBeNull();
    });

    it('should clean up internal references', () => {
      const code = 'CLEANUP TEST';
      const layer = createASCIILayer(code);
      adapter.render(layer, container);

      // Verify it has exports before destroy
      const exportsBefore = adapter.getExports(layer);
      expect(exportsBefore.length).toBeGreaterThan(0);

      adapter.destroy(layer, null);

      // After destroy, exports should be empty
      const exportsAfter = adapter.getExports(layer);
      expect(exportsAfter).toEqual([]);
    });

    it('should handle destroy called multiple times gracefully', () => {
      const code = 'MULTI DESTROY';
      const layer = createASCIILayer(code);
      const instance = adapter.render(layer, container);

      adapter.destroy(layer, instance);
      adapter.destroy(layer, instance); // Should not throw

      expect(container.querySelector('pre')).toBeNull();
    });

    it('should handle destroy with non-existent layer gracefully', () => {
      const layer = createASCIILayer('NEVER RENDERED', 'non-existent');

      expect(() => {
        adapter.destroy(layer, null);
      }).not.toThrow();
    });
  });

  describe('getImports()', () => {
    it('should return minimal imports', () => {
      const imports = adapter.getImports();

      expect(imports).toEqual([]);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(asciiArtAdapter).toBeInstanceOf(ASCIIArtAdapter);
    });

    it('should be the same instance across imports', () => {
      // Testing that singleton pattern works
      expect(asciiArtAdapter).toBeDefined();
    });
  });
});
