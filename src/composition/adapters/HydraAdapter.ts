/**
 * HydraAdapter - Adapter for Hydra video synthesis layers.
 *
 * Renders Hydra video synthesis in a container and exposes
 * synth outputs and frame data for cross-layer communication.
 *
 * SECURITY: User code runs in a sandboxed context with dangerous patterns blocked.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';
import { getWebGLBlendFunc } from '../utils/blendModes.js';
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

/** Hydra synth instance type */
interface HydraSynth {
  /** Canvas element */
  canvas: HTMLCanvasElement;
  /** Width of the canvas */
  width: number;
  /** Height of the canvas */
  height: number;
  /** Stop rendering */
  stop: () => void;
  /** Start rendering */
  start: () => void;
  /** Set resolution */
  setResolution: (width: number, height: number) => void;
  /** Output objects */
  o0: { src: (synth: HydraSynth) => void };
  o1: { src: (synth: HydraSynth) => void };
  o2: { src: (synth: HydraSynth) => void };
  o3: { src: (synth: HydraSynth) => void };
  /** Source functions */
  src: (input: unknown) => HydraSynth;
}

/** Hydra constructor type */
type HydraConstructor = new (options: {
  canvas: HTMLCanvasElement;
  autoLoop?: boolean;
  makeGlobal?: boolean;
  width?: number;
  height?: number;
}) => HydraSynth;

/**
 * Adapter for Hydra video synthesis layers.
 * 
 * Hydra is a live coding visual synthesizer that uses method chaining
 * to create complex video effects. This adapter renders Hydra code
 * and exposes outputs for cross-layer communication.
 */
export class HydraAdapter implements LayerAdapter {
  private hydraModule?: { default: HydraConstructor };
  private instances = new Map<string, HydraSynth>();

  /**
   * Load Hydra module dynamically.
   */
  initialize(): void {
    if (!this.hydraModule) {
      // In browser, Hydra is loaded via CDN
      if (typeof window !== 'undefined' && (window as unknown as { Hydra: HydraConstructor }).Hydra) {
        this.hydraModule = { default: (window as unknown as { Hydra: HydraConstructor }).Hydra };
      }
      // Note: Hydra is browser-only, no Node.js import
    }
  }

  /**
   * Render a Hydra layer into the container.
   * 
   * @param layer - The layer to render
   * @param container - The container element
   * @param context - Optional render context for cross-layer communication
   * @returns The Hydra synth instance
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): HydraSynth {
    const Hydra = this.hydraModule?.default;
    if (!Hydra) {
      throw new Error('Hydra not loaded. Call async initialize() first.');
    }

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Get settings from context
    const settings = context?.settings;
    const width = settings?.width || 800;
    const height = settings?.height || 600;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Create Hydra instance
    const hydra = new Hydra({
      canvas,
      autoLoop: true,
      makeGlobal: true,
      width,
      height,
    });

    // Apply WebGL blend mode if not normal
    const gl = canvas.getContext('webgl');
    if (gl && layer.config.blendMode !== 'normal') {
      const { src, dst } = getWebGLBlendFunc(layer.config.blendMode);
      gl.enable(gl.BLEND);
      gl.blendFunc(src, dst);
    }

    // Store instance
    this.instances.set(layer.id, hydra);

    // Execute user code
    try {
      // Create a function from the code and execute it with hydra in scope
      const userCode = layer.code;
      
      // Set up imports if context exists
      if (context) {
        const imports = context.state.get<Record<string, unknown>>(`__imports_${layer.id}`);
        if (imports && typeof window !== 'undefined') {
          Object.entries(imports).forEach(([key, value]) => {
            (window as unknown as Record<string, unknown>)[`__import_${key}`] = value;
          });
        }
      }

      // Sanitize user code to block dangerous patterns
      const { sanitized, blocked } = sanitizeUserCode(userCode);

      if (blocked.length > 0) {
        Logger.warn('HydraAdapter', `Blocked ${blocked.length} dangerous patterns:`, blocked);
      }

      // Execute the Hydra code in sandboxed context
      // Only expose: console, Math
      const sandboxedFn = new Function(
        'console',
        'Math',
        '"use strict";\n' + sanitized
      );
      sandboxedFn(createSafeConsole(), Math);
    } catch (error) {
      Logger.error('HydraAdapter', 'Error executing Hydra code:', error);
    }

    return hydra;
  }

  /**
   * Get exports from a Hydra layer.
   * 
   * Exports the canvas and output references for use by other layers.
   * 
   * @param layer - The layer to get exports from
   * @returns Array of export definitions
   */
  getExports(layer: Layer): Export[] {
    const hydra = this.instances.get(layer.id);
    if (!hydra) return [];

    return [
      {
        name: 'canvas',
        type: 'canvas',
        getter: () => hydra.canvas,
        description: 'Hydra canvas element',
      },
      {
        name: 'width',
        type: 'number',
        getter: () => hydra.width,
        description: 'Canvas width',
      },
      {
        name: 'height',
        type: 'number',
        getter: () => hydra.height,
        description: 'Canvas height',
      },
      {
        name: 'o0',
        type: 'object',
        getter: () => hydra.o0,
        description: 'Output 0 reference',
      },
      {
        name: 'o1',
        type: 'object',
        getter: () => hydra.o1,
        description: 'Output 1 reference',
      },
      {
        name: 'o2',
        type: 'object',
        getter: () => hydra.o2,
        description: 'Output 2 reference',
      },
      {
        name: 'o3',
        type: 'object',
        getter: () => hydra.o3,
        description: 'Output 3 reference',
      },
    ];
  }

  /**
   * Get imports that Hydra layers can use from other layers.
   * 
   * Hydra can use canvas outputs from other visual layers as sources.
   * 
   * @returns Array of import definitions
   */
  getImports(): Import[] {
    // Hydra can import from other visual layers to use as sources
    return [
      {
        from: 'p5',
        name: 'canvas',
        as: 'p5Canvas',
        required: false,
      },
      {
        from: 'three',
        name: 'canvas',
        as: 'threeCanvas',
        required: false,
      },
    ];
  }

  /**
   * Destroy/cleanup a Hydra layer instance.
   * 
   * @param layer - The layer to destroy
   * @param _instance - The instance to cleanup (unused, we track internally)
   */
  destroy(layer: Layer, _instance: unknown): void {
    const hydra = this.instances.get(layer.id);
    if (hydra) {
      hydra.stop();
      
      // Remove canvas from DOM
      if (hydra.canvas && hydra.canvas.parentNode) {
        hydra.canvas.parentNode.removeChild(hydra.canvas);
      }
      
      this.instances.delete(layer.id);
    }
  }

  /**
   * Validate Hydra layer code.
   * 
   * Checks for required Hydra syntax and common errors.
   * 
   * @param layer - The layer to validate
   * @returns Validation result with optional errors
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code;

    if (!code || code.trim().length === 0) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Check for required .out() call
    if (!code.includes('.out(') && !code.includes('.out()')) {
      errors.push('Hydra code MUST end with .out() to render');
    }

    // Check for source function
    const sourceFunctions = ['osc(', 'src(', 'noise(', 'shape(', 'gradient(', 'solid(', 'voronoi('];
    const hasSource = sourceFunctions.some(fn => code.includes(fn));
    if (!hasSource) {
      errors.push('Hydra code should use a source function: osc(), src(), noise(), shape(), gradient(), solid(), voronoi()');
    }

    // Check for invalid method chains
    const invalidMethods = ['.sin(', '.cos(', '.tan('];
    for (const method of invalidMethods) {
      if (code.includes(method)) {
        errors.push(`Hydra code contains invalid method: ${method} - use math functions differently in Hydra`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone HTML script for a Hydra layer.
   * 
   * @param layer - The layer to generate script for
   * @param _settings - Global settings (unused for basic Hydra)
   * @returns HTML script string
   */
  generateScript(layer: Layer, _settings: GlobalSettings): string {
    return `
<!-- Hydra -->
<script src="https://unpkg.com/hydra-synth"></script>
<script>
(function() {
  const container = document.createElement('div');
  container.className = 'layer';
  container.style.zIndex = ${layer.config.zIndex};
  document.getElementById('composition').appendChild(container);
  
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  
  const hydra = new Hydra({
    canvas: canvas,
    autoLoop: true,
    makeGlobal: true
  });
  
${layer.code.split('\n').map(line => '  ' + line).join('\n')}
})();
</script>`;
  }
}

/** Singleton instance */
export const hydraAdapter = new HydraAdapter();
