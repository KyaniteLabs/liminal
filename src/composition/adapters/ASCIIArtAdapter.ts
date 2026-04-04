/**
 * ASCIIArtAdapter - Adapter for ASCII art layers.
 *
 * Renders ASCII art in a container using preformatted text,
 * exposes character data and dimensions for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** ASCII art instance tracking */
interface ASCIIInstance {
  element: HTMLPreElement;
  code: string;
  width: number;
  height: number;
  lineCount: number;
  maxLineLength: number;
}

export class ASCIIArtAdapter implements LayerAdapter {
  private instances = new Map<string, ASCIIInstance>();

  /**
   * Initialize the adapter. ASCII art requires no external dependencies.
   */
  async initialize(): Promise<void> {
    // ASCII art is self-contained, no initialization needed
    return Promise.resolve();
  }

  /**
   * Render ASCII art into a container.
   * Creates a pre element with monospace styling for proper ASCII display.
   */
  render(layer: Layer, container: HTMLElement, _context?: RenderContext): HTMLPreElement {
    const code = layer.code;

    // Calculate dimensions
    const lines = code.split('\n');
    const lineCount = lines.length;
    const maxLineLength = Math.max(...lines.map(line => line.length));

    // Create pre element for ASCII art
    const preElement = document.createElement('pre');
    preElement.textContent = code;
    preElement.style.fontFamily = 'monospace, "Courier New", Courier';
    preElement.style.whiteSpace = 'pre';
    preElement.style.margin = '0';
    preElement.style.padding = '10px';
    preElement.style.zIndex = String(layer.config.zIndex);
    preElement.dataset.layerId = layer.id;

    container.appendChild(preElement);

    // Store instance info
    const instance: ASCIIInstance = {
      element: preElement,
      code,
      width: maxLineLength,
      height: lineCount,
      lineCount,
      maxLineLength,
    };
    this.instances.set(layer.id, instance);

    return preElement;
  }

  /**
   * Get exports for cross-layer communication.
   * Exports: character data, dimensions, line count, max line length.
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'characterData',
        type: 'string',
        getter: () => instance.code,
        description: 'Raw ASCII art character data',
      },
      {
        name: 'width',
        type: 'number',
        getter: () => instance.width,
        description: 'Width in characters (longest line)',
      },
      {
        name: 'height',
        type: 'number',
        getter: () => instance.height,
        description: 'Height in lines',
      },
      {
        name: 'lineCount',
        type: 'number',
        getter: () => instance.lineCount,
        description: 'Number of lines in the ASCII art',
      },
      {
        name: 'maxLineLength',
        type: 'number',
        getter: () => instance.maxLineLength,
        description: 'Length of the longest line',
      },
    ];
  }

  /**
   * Get imports required by this layer.
   * ASCII art layers are self-contained and require no imports.
   */
  getImports(): Import[] {
    return [];
  }

  /**
   * Destroy/cleanup layer instance.
   * Removes the rendered pre element and clears internal references.
   */
  destroy(layer: Layer, _instance: unknown): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      instance.element.remove();
      this.instances.delete(layer.id);
    }
  }

  /**
   * Validate ASCII art content.
   * Checks for valid ASCII characters and non-empty content.
   * Allows standard ASCII (0-127) and common extended ASCII for box drawing.
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code;

    // Check for empty content
    if (!code || code.trim().length === 0) {
      errors.push('ASCII art content is empty');
      return { valid: false, errors };
    }

    // Check for non-ASCII characters
    // Allow: standard ASCII (0-127) + box drawing chars (U+2500-U+257F) + block chars (U+2580-U+259F)
    const allowedExtendedChars = /[\u2500-\u257F\u2580-\u259F]/;
    const nonASCIIChars = new Set<string>();

    for (const char of code) {
      const codePoint = char.codePointAt(0) || 0;
      // Standard ASCII: 0-127
      const isStandardASCII = codePoint >= 0 && codePoint <= 127;
      // Extended ASCII for box drawing and block characters
      const isExtendedASCII = allowedExtendedChars.test(char);

      if (!isStandardASCII && !isExtendedASCII) {
        nonASCIIChars.add(char);
      }
    }

    if (nonASCIIChars.size > 0) {
      const chars = Array.from(nonASCIIChars).slice(0, 5).join(', ');
      const more = nonASCIIChars.size > 5 ? ` and ${nonASCIIChars.size - 5} more` : '';
      errors.push(`ASCII art contains non-ASCII characters: ${chars}${more}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone script for HTML export.
   * Creates a pre element with proper styling and the ASCII art content.
   */
  generateScript(layer: Layer, _settings: GlobalSettings): string {
    const escapedCode = this.escapeHTML(layer.code);
    const { zIndex, opacity } = layer.config;

    return `
<!-- ASCII Art Layer: ${layer.id} -->
<pre data-layer-id="${layer.id}" style="
  font-family: monospace, 'Courier New', Courier;
  white-space: pre;
  margin: 0;
  padding: 10px;
  z-index: ${zIndex};
  opacity: ${opacity};
">${escapedCode}</pre>`;
  }

  /**
   * Escape HTML special characters to prevent XSS.
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/** Singleton instance */
export const asciiArtAdapter = new ASCIIArtAdapter();
