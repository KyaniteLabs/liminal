/**
 * P5Adapter - Adapter for p5.js layers.
 *
 * Renders p5.js sketches in a container and exposes sketch properties
 * for cross-layer communication.
 *
 * SECURITY: User code runs in a sandboxed context with dangerous patterns blocked.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';
import { getCanvasCompositeOp } from '../utils/blendModes.js';
import { Logger } from '../../utils/Logger.js';

/**
 * Sanitize user code to block dangerous patterns.
 * Returns sanitized code and list of blocked patterns found.
 */
function sanitizeUserCode(code: string): { sanitized: string; blocked: string[] } {
  const blocked: string[] = [];

  // Define dangerous patterns that could lead to XSS or arbitrary code execution
  const dangerousPatterns = [
    { pattern: /window\s*[\[.]/gi, name: 'window access' },
    { pattern: /document\s*[\[.]/gi, name: 'document access' },
    { pattern: /fetch\s*\(/gi, name: 'fetch API' },
    { pattern: /eval\s*\(/gi, name: 'eval()' },
    { pattern: /new\s+Function\s*\(/gi, name: 'Function constructor' },
    { pattern: /setTimeout\s*\(\s*['"`]/gi, name: 'setTimeout with string' },
    { pattern: /setInterval\s*\(\s*['"`]/gi, name: 'setInterval with string' },
    { pattern: /import\s*\(/gi, name: 'dynamic import()' },
    { pattern: /importScripts\s*\(/gi, name: 'importScripts()' },
    { pattern: /XMLHttpRequest/gi, name: 'XMLHttpRequest' },
    { pattern: /WebSocket/gi, name: 'WebSocket' },
    { pattern: /Worker/gi, name: 'Web Worker' },
    { pattern: /localStorage/gi, name: 'localStorage' },
    { pattern: /sessionStorage/gi, name: 'sessionStorage' },
    { pattern: /indexedDB/gi, name: 'indexedDB' },
    { pattern: /open\s*\(\s*['"`]/gi, name: 'window.open()' },
    { pattern: /location\s*[=.]/gi, name: 'location access' },
    { pattern: /parent\s*[\[.]/gi, name: 'parent access' },
    { pattern: /top\s*[\[.]/gi, name: 'top access' },
  ];

  // Check for each dangerous pattern
  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(code)) {
      blocked.push(name);
    }
  }

  // Remove script tags (case-insensitive, handles whitespace)
  let sanitized = code.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove javascript: protocol handlers
  sanitized = sanitized.replace(/javascript:/gi, 'blocked:');

  // Remove data: URLs that could execute JavaScript
  sanitized = sanitized.replace(/data:text\/javascript[^,]*/gi, 'blocked:');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

  return { sanitized, blocked };
}

/**
 * Create a safe console object that only allows logging.
 */
function createSafeConsole(): Console {
  return {
    ...console,
    // Ensure only logging methods are available
    debug: console.debug,
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    // Disable dangerous console methods
    clear: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    profile: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    profileEnd: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    timeStamp: () => {},
  } as Console;
}

/** p5.js sketch instance */
interface P5Instance {
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
}

/** p5 constructor type */
type P5Constructor = new (sketch: (p: P5Instance) => void, container: HTMLElement) => P5Instance;

export class P5Adapter implements LayerAdapter {
  private p5Module?: { default: P5Constructor };
  private instances = new Map<string, P5Instance>();

  /**
   * Load p5.js module dynamically.
   */
  initialize(): void {
    if (!this.p5Module) {
      // In browser, p5 is global
      if (typeof window !== 'undefined' && (window as unknown as { p5: P5Constructor }).p5) {
        this.p5Module = { default: (window as unknown as { p5: P5Constructor }).p5 };
      }
      // Note: p5 is browser-only, no Node.js import
    }
  }

  render(layer: Layer, container: HTMLElement, context?: RenderContext): P5Instance {
    const p5 = this.p5Module?.default;
    if (!p5) {
      throw new Error('p5.js not loaded. Call async initialize() first.');
    }

    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '100%';
    container.appendChild(canvasContainer);

    // Get settings from context
    const settings = context?.settings;
    const width = settings?.width || 800;
    const height = settings?.height || 600;

    // Create p5 instance
    let instance: P5Instance | undefined;
    
    const sketch = (p: P5Instance) => {
      instance = p;
      
      // Store reference for exports
      this.instances.set(layer.id, p);
      
      // Wrap user's code in a function that sets up p5 globals
      const userCode = layer.code;
      
      p.setup = () => {
        p.canvas = p.createCanvas(width, height).elt as HTMLCanvasElement;
        
        // Apply blend mode to canvas context
        const ctx = p.canvas.getContext('2d');
        if (ctx && layer.config.blendMode !== 'normal') {
          ctx.globalCompositeOperation = getCanvasCompositeOp(layer.config.blendMode);
        }
        
        // Execute user setup code if present
        if (userCode.includes('function setup')) {
          const setupMatch = userCode.match(/function\s+setup\s*\(\)\s*\{([\s\S]*?)\}/);
          if (setupMatch) {
            try {
              // Sanitize and execute in sandboxed context
              const { sanitized, blocked } = sanitizeUserCode(setupMatch[1]);
              if (blocked.length > 0) {
                Logger.warn('P5Adapter', `Blocked ${blocked.length} dangerous patterns in setup:`, blocked);
              }
              const setupFn = new Function('p', 'console', 'Math', '"use strict";\n' + sanitized);
              setupFn(p, createSafeConsole(), Math);
            } catch (e) {
              Logger.error('P5Adapter', 'Error in setup:', e);
            }
          }
        }
      };
      
      p.draw = () => {
        // Execute user draw code if present
        if (userCode.includes('function draw')) {
          const drawMatch = userCode.match(/function\s+draw\s*\(\)\s*\{([\s\S]*?)\}/);
          if (drawMatch) {
            try {
              // Sanitize and execute in sandboxed context
              const { sanitized, blocked } = sanitizeUserCode(drawMatch[1]);
              if (blocked.length > 0) {
                Logger.warn('P5Adapter', `Blocked ${blocked.length} dangerous patterns in draw:`, blocked);
              }
              const drawFn = new Function('p', 'console', 'Math', '"use strict";\n' + sanitized);
              drawFn(p, createSafeConsole(), Math);
            } catch (e) {
              Logger.error('P5Adapter', 'Error in draw:', e);
            }
          }
        }
      };
    };

    // Create p5 instance
    new p5(sketch, canvasContainer);
    
    return instance!;
  }

  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];
    
    return [
      {
        name: 'mouseX',
        type: 'number',
        getter: () => instance.mouseX,
        description: 'Current mouse X position',
      },
      {
        name: 'mouseY',
        type: 'number',
        getter: () => instance.mouseY,
        description: 'Current mouse Y position',
      },
      {
        name: 'pmouseX',
        type: 'number',
        getter: () => instance.pmouseX,
        description: 'Previous mouse X position',
      },
      {
        name: 'pmouseY',
        type: 'number',
        getter: () => instance.pmouseY,
        description: 'Previous mouse Y position',
      },
      {
        name: 'frameCount',
        type: 'number',
        getter: () => instance.frameCount,
        description: 'Number of frames drawn',
      },
      {
        name: 'millis',
        type: 'number',
        getter: () => instance.millis(),
        description: 'Milliseconds since sketch started',
      },
      {
        name: 'canvas',
        type: 'canvas',
        getter: () => instance.canvas,
        description: 'Canvas element',
      },
      {
        name: 'width',
        type: 'number',
        getter: () => instance.width,
        description: 'Canvas width',
      },
      {
        name: 'height',
        type: 'number',
        getter: () => instance.height,
        description: 'Canvas height',
      },
    ];
  }

  getImports(): Import[] {
    // P5 layers are typically self-contained
    return [];
  }

  destroy(layer: Layer, _instance: unknown): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      instance.remove();
      this.instances.delete(layer.id);
    }
  }

  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!layer.code.includes('function setup')) {
      errors.push('Missing setup() function');
    }
    if (!layer.code.includes('function draw')) {
      errors.push('Missing draw() function');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  generateScript(layer: Layer, _settings: GlobalSettings): string {
    return `
<!-- p5.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<script>
(function() {
  const container = document.createElement('div');
  container.className = 'layer';
  container.style.zIndex = ${layer.config.zIndex};
  document.getElementById('composition').appendChild(container);
  
  new p5(function(sketch) {
${layer.code.split('\n').map(line => '    ' + line).join('\n')}
  }, container);
})();
</script>`;
  }
}

/** Singleton instance */
export const p5Adapter = new P5Adapter();
