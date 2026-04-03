/**
 * P5Adapter - Adapter for p5.js layers.
 *
 * Renders p5.js sketches in a container and exposes sketch properties
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

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
  async initialize(): Promise<void> {
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
      throw new Error('p5.js not loaded. Call initialize() first.');
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
        
        // Execute user setup code if present
        if (userCode.includes('function setup')) {
          const setupMatch = userCode.match(/function\s+setup\s*\(\)\s*\{([\s\S]*?)\}/);
          if (setupMatch) {
            try {
              // eslint-disable-next-line no-new-func
              const setupFn = new Function('p', setupMatch[1]);
              setupFn(p);
            } catch (e) {
              console.error('Error in setup:', e);
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
              // eslint-disable-next-line no-new-func
              const drawFn = new Function('p', drawMatch[1]);
              drawFn(p);
            } catch (e) {
              console.error('Error in draw:', e);
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
