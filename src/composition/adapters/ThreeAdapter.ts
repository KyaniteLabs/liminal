/**
 * ThreeAdapter - Adapter for Three.js 3D layers.
 *
 * Renders Three.js scenes in a container and exposes 3D scene properties
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** Three.js types (simplified) */
interface THREEScene {
  add: (object: THREEObject) => void;
  remove: (object: THREEObject) => void;
  children: THREEObject[];
}

interface THREECamera {
  position: { x: number; y: number; z: number };
  lookAt: (x: number, y: number, z: number) => void;
}

interface THREERenderer {
  setSize: (width: number, height: number) => void;
  render: (scene: THREEScene, camera: THREECamera) => void;
  domElement: HTMLCanvasElement;
  dispose: () => void;
}

interface THREEObject {
  rotation: { x: number; y: number; z: number };
}

interface THREEModule {
  Scene: new () => THREEScene;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => THREECamera;
  WebGLRenderer: new () => THREERenderer;
  BoxGeometry: new () => unknown;
  MeshBasicMaterial: new (params: { color: number }) => unknown;
  Mesh: new (geometry: unknown, material: unknown) => THREEObject;
  Color: new (color: string | number) => unknown;
}

interface ThreeInstance {
  scene: THREEScene;
  camera: THREECamera;
  renderer: THREERenderer;
  animationId?: number;
  objects: THREEObject[];
}

export class ThreeAdapter implements LayerAdapter {
  private threeModule?: THREEModule;
  private instances = new Map<string, ThreeInstance>();

  /**
   * Load Three.js module dynamically.
   */
  async initialize(): Promise<void> {
    if (!this.threeModule) {
      // In browser, THREE is global
      if (typeof window !== 'undefined' && (window as unknown as { THREE: THREEModule }).THREE) {
        this.threeModule = (window as unknown as { THREE: THREEModule }).THREE;
      }
      // Note: Three.js is browser-only, no Node.js import
    }
  }

  /**
   * Render the Three.js layer into a container.
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): ThreeInstance {
    const THREE = this.threeModule;
    if (!THREE) {
      throw new Error('Three.js not loaded. Call initialize() first.');
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

    // Create Three.js scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    
    renderer.setSize(width, height);
    canvasContainer.appendChild(renderer.domElement);

    // Track objects created by this layer
    const objects: THREEObject[] = [];

    // Set up import proxy if context exists
    if (context) {
      const imports = context.state.get<Record<string, unknown>>(`__imports_${layer.id}`);
      
      // Make imports available globally for the eval context
      if (imports && typeof window !== 'undefined') {
        Object.entries(imports).forEach(([key, value]) => {
          (window as unknown as Record<string, unknown>)[`__import_${key}`] = value;
        });
      }
    }

    // Execute user code with wrapped THREE access
    try {
      // Define tracking function in eval context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__trackObject = (obj: THREEObject) => {
        objects.push(obj);
        return obj;
      };
      
      // Wrap code to track object creation
      const wrappedCode = layer.code
        .replace(/new\s+THREE\.Mesh\s*\(/g, '(() => { const m = new THREE.Mesh(')
        .replace(/new\s+THREE\.Mesh\s*\(([^)]+)\)/g, '(() => { const m = new THREE.Mesh($1); __trackObject(m); return m; })()');
      
      // eslint-disable-next-line no-eval
      eval(wrappedCode);
      
      // Clean up tracking function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__trackObject;
    } catch (error) {
      console.error('Error executing Three.js code:', error);
    }

    // Start render loop
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      
      // Store animation ID for cleanup
      const instance = this.instances.get(layer.id);
      if (instance) {
        instance.animationId = animationId;
      }
    };
    animate();

    // Store instance info
    const instanceInfo: ThreeInstance = {
      scene,
      camera,
      renderer,
      objects,
    };
    this.instances.set(layer.id, instanceInfo);

    return instanceInfo;
  }

  /**
   * Get exports for this layer.
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'cameraX',
        type: 'number',
        getter: () => instance.camera.position.x,
        description: 'Camera X position',
      },
      {
        name: 'cameraY',
        type: 'number',
        getter: () => instance.camera.position.y,
        description: 'Camera Y position',
      },
      {
        name: 'cameraZ',
        type: 'number',
        getter: () => instance.camera.position.z,
        description: 'Camera Z position',
      },
      {
        name: 'sceneObjects',
        type: 'object',
        getter: () => instance.scene.children,
        description: 'Array of objects in the scene',
      },
      {
        name: 'renderer',
        type: 'object',
        getter: () => instance.renderer,
        description: 'WebGL renderer instance',
      },
    ];
  }

  /**
   * Get imports that this layer needs.
   */
  getImports(): Import[] {
    // Three.js can import from p5 for camera control
    return [
      {
        from: 'p5',
        name: 'mouseX',
        as: 'cameraControlX',
        required: false,
      },
      {
        from: 'p5',
        name: 'mouseY',
        as: 'cameraControlY',
        required: false,
      },
    ];
  }

  /**
   * Destroy/cleanup layer instance.
   */
  destroy(layer: Layer): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      // Cancel animation frame
      if (instance.animationId !== undefined) {
        cancelAnimationFrame(instance.animationId);
      }
      
      // Dispose renderer
      if (instance.renderer) {
        instance.renderer.dispose();
        
        // Remove canvas from DOM
        const canvas = instance.renderer.domElement;
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
      }
      
      this.instances.delete(layer.id);
    }
  }

  /**
   * Validate layer code.
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!layer.code.includes('THREE.Scene')) {
      errors.push('Missing THREE.Scene creation');
    }
    if (!layer.code.includes('THREE.PerspectiveCamera')) {
      errors.push('Missing THREE.PerspectiveCamera creation');
    }
    if (!layer.code.includes('THREE.WebGLRenderer')) {
      errors.push('Missing THREE.WebGLRenderer creation');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone script for HTML export.
   */
  generateScript(layer: Layer, _settings: GlobalSettings): string {
    return `
<!-- Three.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function() {
  const container = document.createElement('div');
  container.className = 'layer';
  container.style.zIndex = ${layer.config.zIndex};
  document.getElementById('composition').appendChild(container);
  
${layer.code.split('\n').map(line => '  ' + line).join('\n')}
})();
</script>`;
  }
}

/** Singleton instance */
export const threeAdapter = new ThreeAdapter();
