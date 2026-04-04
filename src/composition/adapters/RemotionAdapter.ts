/**
 * RemotionAdapter - Adapter for Remotion video composition layers.
 *
 * Renders Remotion compositions and exposes frame data and config
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** Remotion instance types (simplified) */
interface RemotionComposition {
  id: string;
  component: unknown;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

interface RemotionPlayer {
  play: () => void;
  pause: () => void;
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
}

interface RemotionInstance {
  player?: RemotionPlayer;
  composition: RemotionComposition;
  container: HTMLElement;
  isPlaying: boolean;
  currentFrame: number;
}

/** Default composition duration */
const DEFAULT_DURATION_IN_FRAMES = 150;

/**
 * Adapter for rendering Remotion video compositions.
 */
export class RemotionAdapter implements LayerAdapter {
  private instances = new Map<string, RemotionInstance>();
  private remotionModule?: {
    useCurrentFrame: () => number;
    AbsoluteFill: unknown;
    Composition: unknown;
    Player: unknown;
  };

  /**
   * Initialize the adapter by loading Remotion module.
   * In browser, Remotion components are loaded dynamically.
   */
  async initialize(): Promise<void> {
    // Remotion is typically bundled, so we just verify environment
    if (typeof window === 'undefined') {
      // Node.js environment - module will be available when bundled
      return;
    }
    
    // In browser, check for global Remotion if pre-loaded
    const win = window as unknown as {
      Remotion?: typeof this.remotionModule;
    };
    
    if (win.Remotion) {
      this.remotionModule = win.Remotion;
    }
  }

  /**
   * Render a Remotion layer into the container.
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): RemotionInstance {
    if (!this.remotionModule && typeof window !== 'undefined') {
      const win = window as unknown as {
        Remotion?: typeof this.remotionModule;
      };
      if (win.Remotion) {
        this.remotionModule = win.Remotion;
      }
    }

    if (!this.remotionModule) {
      throw new Error('Remotion not loaded. Call initialize() first.');
    }

    // Create container for the Remotion player
    const playerContainer = document.createElement('div');
    playerContainer.className = 'remotion-player-container';
    playerContainer.style.width = '100%';
    playerContainer.style.height = '100%';
    playerContainer.style.position = 'relative';
    container.appendChild(playerContainer);

    // Get settings from context
    const settings = context?.settings;
    const width = settings?.width || 1920;
    const height = settings?.height || 1080;
    const fps = settings?.frameRate || 30;

    // Parse composition from layer code
    const composition = this.parseComposition(layer, width, height, fps);

    // Create instance
    const instance: RemotionInstance = {
      composition,
      container: playerContainer,
      isPlaying: false,
      currentFrame: 0,
    };

    // Store instance for exports
    this.instances.set(layer.id, instance);

    // Set up frame tracking if in browser
    if (typeof window !== 'undefined') {
      this.setupFrameTracking(instance);
    }

    return instance;
  }

  /**
   * Parse composition configuration from layer code.
   */
  private parseComposition(
    layer: Layer,
    width: number,
    height: number,
    fps: number
  ): RemotionComposition {
    // Extract duration from code or use default
    const durationMatch = layer.code.match(/durationInFrames:\s*(\d+)/);
    const durationInFrames = durationMatch 
      ? parseInt(durationMatch[1], 10) 
      : DEFAULT_DURATION_IN_FRAMES;

    // Extract component name from code
    const componentMatch = layer.code.match(/export\s+(?:const|function)\s+(\w+)/);
    const componentName = componentMatch ? componentMatch[1] : 'Composition';

    return {
      id: layer.id,
      component: { name: componentName },
      durationInFrames,
      fps,
      width,
      height,
    };
  }

  /**
   * Set up frame tracking for the instance.
   */
  private setupFrameTracking(instance: RemotionInstance): void {
    // Simulate frame updates (in real implementation, this would hook into Remotion's player)
    let frame = 0;
    const updateFrame = () => {
      if (instance.isPlaying) {
        frame = (frame + 1) % instance.composition.durationInFrames;
        instance.currentFrame = frame;
      }
      requestAnimationFrame(updateFrame);
    };
    requestAnimationFrame(updateFrame);
  }

  /**
   * Get exports for cross-layer communication.
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'frame',
        type: 'number',
        getter: () => instance.currentFrame,
        description: 'Current frame number in the composition',
      },
      {
        name: 'config',
        type: 'object',
        getter: () => ({
          durationInFrames: instance.composition.durationInFrames,
          fps: instance.composition.fps,
          width: instance.composition.width,
          height: instance.composition.height,
        }),
        description: 'Composition configuration',
      },
      {
        name: 'isPlaying',
        type: 'boolean',
        getter: () => instance.isPlaying,
        description: 'Whether the composition is currently playing',
      },
      {
        name: 'durationInFrames',
        type: 'number',
        getter: () => instance.composition.durationInFrames,
        description: 'Total duration of the composition in frames',
      },
      {
        name: 'fps',
        type: 'number',
        getter: () => instance.composition.fps,
        description: 'Frames per second',
      },
      {
        name: 'compositionWidth',
        type: 'number',
        getter: () => instance.composition.width,
        description: 'Composition width in pixels',
      },
      {
        name: 'compositionHeight',
        type: 'number',
        getter: () => instance.composition.height,
        description: 'Composition height in pixels',
      },
    ];
  }

  /**
   * Get imports that this layer can consume from other layers.
   */
  getImports(): Import[] {
    return [
      {
        from: 'p5',
        name: 'frameCount',
        as: 'syncFrame',
        required: false,
      },
      {
        from: 'p5',
        name: 'canvas',
        as: 'sourceCanvas',
        required: false,
      },
      {
        from: 'p5',
        name: 'mouseX',
        as: 'modulationX',
        required: false,
      },
      {
        from: 'p5',
        name: 'mouseY',
        as: 'modulationY',
        required: false,
      },
      {
        from: 'tone',
        name: 'isPlaying',
        as: 'audioPlaying',
        required: false,
      },
      {
        from: 'tone',
        name: 'currentTime',
        as: 'audioTime',
        required: false,
      },
      {
        from: 'tone',
        name: 'bpm',
        as: 'tempo',
        required: false,
      },
      {
        from: 'three',
        name: 'frameCount',
        as: 'syncFrame3D',
        required: false,
      },
      {
        from: 'three',
        name: 'canvas',
        as: 'sourceCanvas3D',
        required: false,
      },
    ];
  }

  /**
   * Validate Remotion layer code.
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code;

    // Check for Remotion imports
    if (!code.includes('remotion') && !code.includes('from "remotion"') && !code.includes("from 'remotion'")) {
      errors.push('Missing Remotion imports (remotion not found)');
    }

    // Check for useCurrentFrame hook
    if (!code.includes('useCurrentFrame')) {
      errors.push('Missing useCurrentFrame hook');
    }

    // Check for Composition export
    const hasCompositionExport = /export\s+(?:const|function|default)\s+\w+/.test(code) ||
      code.includes('export const') ||
      code.includes('export function') ||
      code.includes('export default');
    
    if (!hasCompositionExport) {
      errors.push('Missing exported Composition component');
    }

    // Check for AbsoluteFill or valid Remotion component
    if (!code.includes('AbsoluteFill') && !code.includes('Sequence')) {
      errors.push('Missing Remotion layout component (AbsoluteFill or Sequence)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone script for HTML export.
   */
  generateScript(layer: Layer, settings: GlobalSettings): string {
    const width = settings.width || 1920;
    const height = settings.height || 1080;
    const fps = settings.frameRate || 30;
    const zIndex = layer.config.zIndex;

    return `
<!-- Remotion Composition -->
<script src="https://unpkg.com/remotion@4.0.0/dist/remotion.js"></script>
<script>
(function() {
  const container = document.createElement('div');
  container.className = 'layer remotion-layer';
  container.style.zIndex = ${zIndex};
  container.style.width = '${width}px';
  container.style.height = '${height}px';
  document.getElementById('composition').appendChild(container);

  // Composition configuration
  const config = {
    durationInFrames: 150,
    fps: ${fps},
    width: ${width},
    height: ${height},
  };

  // User composition code
${layer.code.split('\n').map(line => '  ' + line).join('\n')}

  // Initialize Remotion player if available
  if (window.Remotion && window.Remotion.Player) {
    const player = window.Remotion.Player;
    // Player initialization would happen here with the composition
  }
})();
</script>`;
  }

  /**
   * Destroy/cleanup a layer instance.
   */
  destroy(layer: Layer, _instance: unknown): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      // Stop playback
      instance.isPlaying = false;

      // Remove container from DOM
      if (instance.container && instance.container.parentNode) {
        instance.container.parentNode.removeChild(instance.container);
      }

      // Clean up instance
      this.instances.delete(layer.id);
    }
  }
}

/** Singleton instance */
export const remotionAdapter = new RemotionAdapter();
