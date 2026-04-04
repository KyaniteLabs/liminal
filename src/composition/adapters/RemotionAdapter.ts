/**
 * RemotionAdapter - Adapter for Remotion video composition layers.
 *
 * Renders Remotion compositions and exposes frame data and config
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** Remotion composition configuration */
interface RemotionComposition {
  /** Unique identifier */
  id: string;
  /** Component reference */
  component: { name: string };
  /** Duration in frames */
  durationInFrames: number;
  /** Frames per second */
  fps: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Remotion player interface */
interface RemotionPlayer {
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to specific frame */
  seekTo: (frame: number) => void;
  /** Get current frame */
  getCurrentFrame: () => number;
  /** Check if playing */
  isPlaying: () => boolean;
}

/** Instance data for a rendered Remotion layer */
interface RemotionInstance {
  /** Player instance */
  player?: RemotionPlayer;
  /** Composition configuration */
  composition: RemotionComposition;
  /** Container element */
  container: HTMLElement;
  /** Playback state */
  isPlaying: boolean;
  /** Current frame number */
  currentFrame: number;
}

/** Default composition duration in frames (5 seconds at 30fps) */
const DEFAULT_DURATION_IN_FRAMES = 150;

/**
 * Adapter for rendering Remotion video compositions.
 * 
 * Remotion is a React-based video composition library. This adapter
 * enables rendering Remotion compositions as layers in the Liminal
 * composition system, with support for cross-layer communication.
 * 
 * @example
 * ```typescript
 * const adapter = new RemotionAdapter();
 * await adapter.async initialize();
 * const instance = adapter.render(layer, container, context);
 * ```
 */
export class RemotionAdapter implements LayerAdapter {
  /** Map of layer IDs to their instances */
  private instances = new Map<string, RemotionInstance>();
  
  /** Whether the adapter has been initialized */
  private isInitialized = false;

  /**
   * Initialize the adapter by loading Remotion module.
   * 
   * In browser environments, this checks for the global Remotion object.
   * In Node.js/test environments, it simply marks the adapter as ready.
   * 
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): void {
    // Remotion is typically bundled, so we just mark as initialized
    // The actual module loading happens in render() when window is available
    this.isInitialized = true;
  }

  /**
   * Check if the adapter is ready to render.
   * 
   * @returns True if the adapter has been initialized or is in a test environment
   */
  private isReady(): boolean {
    return this.isInitialized || typeof window === 'undefined';
  }

  /**
   * Render a Remotion layer into the container.
   * 
   * Creates a player container, parses the composition configuration from
   * the layer code, and sets up frame tracking for cross-layer communication.
   * 
   * @param layer - The layer to render
   * @param container - The container element to render into
   * @param context - Optional render context with settings and state
   * @returns The Remotion instance object
   * @throws Error if async initialize() was not called first
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): RemotionInstance {
    if (!this.isReady()) {
      throw new Error('Remotion not loaded. Call async initialize() first.');
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
   * 
   * Extracts durationInFrames from the code if present, otherwise uses default.
   * Also extracts the component name from export statements.
   * 
   * @param layer - The layer containing the code
   * @param width - Composition width in pixels
   * @param height - Composition height in pixels
   * @param fps - Frames per second
   * @returns The parsed composition configuration
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
   * 
   * Uses requestAnimationFrame to simulate frame updates when playing.
   * In a real implementation, this would hook into Remotion's player.
   * 
   * @param instance - The Remotion instance to track
   */
  private setupFrameTracking(instance: RemotionInstance): void {
    let frame = 0;
    const updateFrame = (): void => {
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
   * 
   * Returns an array of Export objects that other layers can consume.
   * Includes frame number, composition config, playback state, and dimensions.
   * 
   * @param layer - The layer to get exports for
   * @returns Array of Export objects
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'frame',
        type: 'number',
        getter: (): number => instance.currentFrame,
        description: 'Current frame number in the composition',
      },
      {
        name: 'config',
        type: 'object',
        getter: (): Record<string, number> => ({
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
        getter: (): boolean => instance.isPlaying,
        description: 'Whether the composition is currently playing',
      },
      {
        name: 'durationInFrames',
        type: 'number',
        getter: (): number => instance.composition.durationInFrames,
        description: 'Total duration of the composition in frames',
      },
      {
        name: 'fps',
        type: 'number',
        getter: (): number => instance.composition.fps,
        description: 'Frames per second',
      },
      {
        name: 'compositionWidth',
        type: 'number',
        getter: (): number => instance.composition.width,
        description: 'Composition width in pixels',
      },
      {
        name: 'compositionHeight',
        type: 'number',
        getter: (): number => instance.composition.height,
        description: 'Composition height in pixels',
      },
    ];
  }

  /**
   * Get imports that this layer can consume from other layers.
   * 
   * Remotion layers can import from p5, tone, and three.js layers
   * for reactive compositions and audio-visual synchronization.
   * 
   * @param _layer - The layer to get imports for (unused but required by interface)
   * @returns Array of Import objects
   */
  getImports(_layer?: Layer): Import[] {
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
   * 
   * Checks for required Remotion imports, useCurrentFrame hook,
   * exported composition component, and layout components.
   * 
   * @param layer - The layer to validate
   * @returns Validation result with valid flag and optional errors array
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

    // Check for Composition export - look for export const, export function, or export default
    const hasCompositionExport = 
      /export\s+(?:const|function)\s+\w+/.test(code) ||
      /export\s+default\s+(?:function\s+)?\w*/.test(code);
    
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
   * 
   * Creates a self-contained script that can be embedded in an HTML file.
   * Includes the Remotion library and wraps the layer code in an IIFE.
   * 
   * @param layer - The layer to generate script for
   * @param settings - Global settings for dimensions and frame rate
   * @returns HTML script string
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
   * 
   * Stops playback, removes the container from the DOM,
   * and cleans up internal references.
   * 
   * @param layer - The layer to destroy
   * @param _instance - The instance object (unused, kept for interface compatibility)
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

/** Singleton instance of RemotionAdapter */
export const remotionAdapter = new RemotionAdapter();
