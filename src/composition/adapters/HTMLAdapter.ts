/**
 * HTMLAdapter - Adapter for HTML/CSS layers.
 *
 * Renders HTML/CSS content in a container and exposes DOM elements
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** Instance data for HTML layer */
interface HTMLLayerInstance {
  /** Container element */
  container: HTMLElement;
  /** Map of element IDs to elements */
  elements: Map<string, Element>;
  /** Extracted styles */
  styles: string[];
  /** Cleanup function */
  cleanup?: () => void;
}

/**
 * Adapter for HTML/CSS layers.
 * 
 * Renders HTML and CSS content to a container, providing:
 * - DOM element references for cross-layer communication
 * - Computed style access
 * - HTML validation and sanitization
 * - Import from visual layers for reactive styling
 */
export class HTMLAdapter implements LayerAdapter {
  private instances = new Map<string, HTMLLayerInstance>();

  /**
   * Render HTML/CSS layer into a container.
   * 
   * @param layer - The layer to render
   * @param container - Container element
   * @param context - Render context with state and settings
   * @returns Instance with container, elements, and styles
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): HTMLLayerInstance {
    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = String(layer.config.zIndex);

    // Parse and sanitize HTML
    const { html, styles } = this.parseHTML(layer.code);
    
    // Set innerHTML (sanitized)
    wrapper.innerHTML = html;

    // Collect element references
    const elements = new Map<string, Element>();
    const allElements = wrapper.querySelectorAll('[id]');
    allElements.forEach(el => {
      const id = el.getAttribute('id');
      if (id) {
        elements.set(id, el);
      }
    });

    // Apply imported values if context available
    if (context) {
      this.applyImports(layer, wrapper, context);
    }

    // Append to container
    container.appendChild(wrapper);

    // Create instance
    const instance: HTMLLayerInstance = {
      container: wrapper,
      elements,
      styles,
    };

    // Store instance
    this.instances.set(layer.id, instance);

    return instance;
  }

  /**
   * Parse HTML content, extracting styles and sanitizing.
   * 
   * @param code - Raw HTML/CSS code
   * @returns Parsed HTML and extracted styles
   */
  private parseHTML(code: string): { html: string; styles: string[] } {
    const styles: string[] = [];
    
    // Extract style tags
    let cleanCode = code;
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match: RegExpExecArray | null;
    
    while ((match = styleRegex.exec(code)) !== null) {
      styles.push(match[1].trim());
    }
    
    // Remove style tags from HTML (they'll be handled separately)
    cleanCode = code.replace(styleRegex, '');
    
    // Sanitize - remove script tags
    cleanCode = this.sanitizeHTML(cleanCode);
    
    return { html: cleanCode.trim(), styles };
  }

  /**
   * Sanitize HTML by removing script tags and dangerous attributes.
   * 
   * @param html - HTML to sanitize
   * @returns Sanitized HTML
   */
  private sanitizeHTML(html: string): string {
    // Remove script tags and their content
    let sanitized = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove on* event handlers (for security in some contexts)
    // Note: Currently allowing inline handlers per requirements
    
    return sanitized;
  }

  /**
   * Apply imported values from other layers.
   * 
   * @param layer - Current layer
   * @param wrapper - Wrapper element
   * @param context - Render context
   */
  private applyImports(layer: Layer, wrapper: HTMLElement, context: RenderContext): void {
    const imports = context.state.get<Record<string, unknown>>(`__imports_${layer.id}`);
    if (!imports) return;

    // Apply imported values as CSS custom properties for reactive styling
    Object.entries(imports).forEach(([key, value]) => {
      if (typeof value === 'number') {
        wrapper.style.setProperty(`--import-${key}`, String(value));
      } else if (typeof value === 'string') {
        wrapper.style.setProperty(`--import-${key}`, value);
      }
    });
  }

  /**
   * Get exports for this layer.
   * 
   * @param layer - Layer to get exports for
   * @returns Array of exports
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'container',
        type: 'object',
        getter: () => instance.container,
        description: 'Container element for this HTML layer',
      },
      {
        name: 'elements',
        type: 'object',
        getter: () => instance.elements,
        description: 'Map of ID -> Element for all elements with IDs',
      },
      {
        name: 'computedStyles',
        type: 'object',
        getter: () => this.getComputedStyles(instance.container),
        description: 'Computed CSS styles for the container',
      },
    ];
  }

  /**
   * Get computed styles for an element.
   * 
   * @param element - Element to get styles for
   * @returns Object with computed styles
   */
  private getComputedStyles(element: Element): Record<string, string> {
    if (typeof window === 'undefined') return {};
    
    const computed = window.getComputedStyle(element);
    const styles: Record<string, string> = {};
    
    // Get commonly used properties
    const properties = [
      'width', 'height', 'top', 'left', 'right', 'bottom',
      'backgroundColor', 'color', 'fontSize', 'opacity',
      'transform', 'zIndex',
    ];
    
    properties.forEach(prop => {
      styles[prop] = computed.getPropertyValue(prop);
    });
    
    return styles;
  }

  /**
   * Get imports needed by this layer.
   * 
   * HTML layers can import from visual layers for reactive styling.
   * 
   * @returns Array of imports
   */
  getImports(): Import[] {
    return [
      {
        from: 'p5',
        name: 'mouseX',
        as: 'mouseX',
        required: false,
      },
      {
        from: 'p5',
        name: 'mouseY',
        as: 'mouseY',
        required: false,
      },
      {
        from: 'p5',
        name: 'frameCount',
        as: 'frameCount',
        required: false,
      },
      {
        from: 'three',
        name: 'cameraX',
        as: 'cameraX',
        required: false,
      },
      {
        from: 'three',
        name: 'cameraY',
        as: 'cameraY',
        required: false,
      },
    ];
  }

  /**
   * Destroy/cleanup layer instance.
   * 
   * @param layer - Layer to destroy
   * @param instance - Instance to clean up
   */
  destroy(layer: Layer, instance: unknown): void {
    const htmlInstance = instance as HTMLLayerInstance | null;
    
    if (htmlInstance?.container?.parentNode) {
      htmlInstance.container.parentNode.removeChild(htmlInstance.container);
    }
    
    if (htmlInstance?.cleanup) {
      htmlInstance.cleanup();
    }
    
    this.instances.delete(layer.id);
  }

  /**
   * Validate HTML content.
   * 
   * @param layer - Layer to validate
   * @returns Validation result
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code.trim();

    // Check for empty content
    if (!code) {
      errors.push('HTML content is empty');
      return { valid: false, errors };
    }

    // Check for script tags (security)
    if (/<script/i.test(code)) {
      errors.push('script tags are not allowed for security');
    }

    // Check for basic tag balance using regex
    const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    const stack: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(code)) !== null) {
      const isClosing = match[1] === '/';
      const tagName = match[2].toLowerCase();

      // Skip self-closing tags
      const isSelfClosing = /\/>$/.test(match[0]) || 
        ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'].includes(tagName);

      if (isSelfClosing) continue;

      if (isClosing) {
        const lastTag = stack.pop();
        if (lastTag !== tagName) {
          errors.push(`Mismatched tags: expected </${lastTag}>, found </${tagName}>`);
        }
      } else {
        stack.push(tagName);
      }
    }

    // Unclosed tags
    if (stack.length > 0) {
      errors.push(`Unclosed tags: ${stack.join(', ')}`);
    }

    // Try DOM parsing if available (browser environment)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'text/html');
      
      // Check for parse errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        errors.push('HTML parsing error detected');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone HTML script for export.
   * 
   * @param layer - Layer to generate script for
   * @param settings - Global settings
   * @returns HTML script string
   */
  generateScript(layer: Layer, _settings: GlobalSettings): string {
    const { html, styles } = this.parseHTML(layer.code);
    
    const styleBlock = styles.length > 0 
      ? `<style>${styles.join('\n')}</style>` 
      : '';

    return `
<!-- HTML Layer: ${layer.id} -->
<div class="layer" style="z-index: ${layer.config.zIndex}; position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
  ${styleBlock}
  ${html}
</div>`;
  }
}

/** Singleton instance */
export const htmlAdapter = new HTMLAdapter();
