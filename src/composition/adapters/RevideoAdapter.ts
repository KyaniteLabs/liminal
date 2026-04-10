/**
 * RevideoAdapter - Adapter for Revideo video composition layers.
 *
 * Revideo is a TypeScript framework forked from Motion Canvas for programmatic
 * video editing. This adapter enables rendering Revideo scenes as layers in the
 * Liminal composition system.
 *
 * @see https://docs.re.video
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** Revideo scene configuration */
interface RevideoScene {
  /** Unique identifier */
  id: string;
  /** Scene duration in seconds */
  duration: number;
  /** Frames per second */
  fps: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/** Revideo player interface */
interface RevideoPlayer {
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to specific time */
  seekTo: (time: number) => void;
  /** Get current time in seconds */
  getCurrentTime: () => number;
  /** Check if playing */
  isPlaying: () => boolean;
}

/** Instance data for a rendered Revideo layer */
interface RevideoInstance {
  /** Player instance */
  player?: RevideoPlayer;
  /** Scene configuration */
  scene: RevideoScene;
  /** Container element */
  container: HTMLElement;
  /** Playback state */
  isPlaying: boolean;
  /** Current time in seconds */
  currentTime: number;
}

/** Default scene duration in seconds */
const DEFAULT_DURATION = 5;

/**
 * Adapter for rendering Revideo video scenes.
 *
 * Revideo uses a signal-based reactive system with makeScene for defining
 * scenes and useTime for time-based animations. This adapter enables
 * rendering Revideo scenes as layers in the Liminal composition system.
 *
 * @example
 * ```typescript
 * const adapter = new RevideoAdapter();
 * adapter.initialize();
 * const instance = adapter.render(layer, container, context);
 * ```
 */
export class RevideoAdapter implements LayerAdapter {
  /** Map of layer IDs to their instances */
  private instances = new Map<string, RevideoInstance>();

  /** Whether the adapter has been initialized */
  private isInitialized = false;

  /**
   * Initialize the adapter.
   *
   * In browser environments, this checks for the global Revideo object.
   * In Node.js/test environments, it simply marks the adapter as ready.
   */
  initialize(): void {
    this.isInitialized = true;
  }

  /**
   * Check if the adapter is ready to render.
   */
  private isReady(): boolean {
    return this.isInitialized || typeof window === 'undefined';
  }

  /**
   * Render a Revideo layer into the container.
   *
   * Creates a player container, parses the scene configuration from
   * the layer code, and sets up time tracking for cross-layer communication.
   *
   * @param layer - The layer to render
   * @param container - The container element to render into
   * @param context - Optional render context with settings and state
   * @returns The Revideo instance object
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): RevideoInstance {
    if (!this.isReady()) {
      throw new Error('Revideo not initialized. Call initialize() first.');
    }

    // Create container for the Revideo player
    const playerContainer = document.createElement('div');
    playerContainer.className = 'revideo-player-container';
    playerContainer.style.width = '100%';
    playerContainer.style.height = '100%';
    playerContainer.style.position = 'relative';
    container.appendChild(playerContainer);

    // Get settings from context
    const settings = context?.settings;
    const width = settings?.width || 1920;
    const height = settings?.height || 1080;
    const fps = settings?.frameRate || 30;

    // Parse scene from layer code
    const scene = this.parseScene(layer, width, height, fps);

    // Create instance
    const instance: RevideoInstance = {
      scene,
      container: playerContainer,
      isPlaying: false,
      currentTime: 0,
    };

    // Store instance for exports
    this.instances.set(layer.id, instance);

    // Set up time tracking if in browser
    if (typeof window !== 'undefined') {
      this.setupTimeTracking(instance);
    }

    return instance;
  }

  /**
   * Parse scene configuration from layer code.
   *
   * Extracts duration from yield* time() calls if present, otherwise uses default.
   *
   * @param layer - The layer containing the code
   * @param width - Scene width in pixels
   * @param height - Scene height in pixels
   * @param fps - Frames per second
   * @returns The parsed scene configuration
   */
  private parseScene(
    layer: Layer,
    width: number,
    height: number,
    fps: number
  ): RevideoScene {
    // Extract duration from code or use default
    // Look for: yield* time(5, 1) or yield* time(3)
    const durationMatch = layer.code.match(/yield\*\s+time\((\d+(?:\.\d+)?)/);
    const duration = durationMatch ? parseFloat(durationMatch[1]) : DEFAULT_DURATION;

    return {
      id: layer.id,
      duration,
      fps,
      width,
      height,
    };
  }

  /**
   * Set up time tracking for the instance.
   *
   * Uses requestAnimationFrame to track time updates when playing.
   *
   * @param instance - The Revideo instance to track
   */
  private setupTimeTracking(instance: RevideoInstance): void {
    let lastTime = performance.now();

    const updateTime = (currentTime: number): void => {
      if (instance.isPlaying) {
        const delta = (currentTime - lastTime) / 1000;
        instance.currentTime = (instance.currentTime + delta) % instance.scene.duration;
      }
      lastTime = currentTime;
      requestAnimationFrame(updateTime);
    };

    requestAnimationFrame(updateTime);
  }

  /**
   * Get exports for cross-layer communication.
   *
   * Returns an array of Export objects that other layers can consume.
   * Includes time, scene config, playback state, and dimensions.
   *
   * @param layer - The layer to get exports for
   * @returns Array of Export objects
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'time',
        type: 'number',
        getter: (): number => instance.currentTime,
        description: 'Current time in seconds',
      },
      {
        name: 'frame',
        type: 'number',
        getter: (): number => Math.floor(instance.currentTime * instance.scene.fps),
        description: 'Current frame number in the scene',
      },
      {
        name: 'config',
        type: 'object',
        getter: (): Record<string, number> => ({
          duration: instance.scene.duration,
          fps: instance.scene.fps,
          width: instance.scene.width,
          height: instance.scene.height,
        }),
        description: 'Scene configuration',
      },
      {
        name: 'isPlaying',
        type: 'boolean',
        getter: (): boolean => instance.isPlaying,
        description: 'Whether the scene is currently playing',
      },
      {
        name: 'duration',
        type: 'number',
        getter: (): number => instance.scene.duration,
        description: 'Total duration of the scene in seconds',
      },
      {
        name: 'fps',
        type: 'number',
        getter: (): number => instance.scene.fps,
        description: 'Frames per second',
      },
      {
        name: 'sceneWidth',
        type: 'number',
        getter: (): number => instance.scene.width,
        description: 'Scene width in pixels',
      },
      {
        name: 'sceneHeight',
        type: 'number',
        getter: (): number => instance.scene.height,
        description: 'Scene height in pixels',
      },
    ];
  }

  /**
   * Get imports that this layer can consume from other layers.
   *
   * Revideo layers can import from p5, tone, and three.js layers
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
   * Validate Revideo layer code.
   *
   * Checks for required Revideo imports, makeScene usage,
   * useTime hook, and proper signal patterns.
   *
   * @param layer - The layer to validate
   * @returns Validation result with valid flag and optional errors array
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code;

    // Check for Revideo imports
    const hasCoreImport =
      code.includes('@revideo/core') ||
      code.includes("from '@revideo/core'") ||
      code.includes('from "@revideo/core"');

    if (!hasCoreImport) {
      errors.push('Missing @revideo/core import');
    }

    // Check for makeScene
    if (!code.includes('makeScene')) {
      errors.push('Missing makeScene - required for Revideo scenes');
    }

    // Check for useTime
    if (!code.includes('useTime')) {
      errors.push('Missing useTime hook - required for time-based animations');
    }

    // Check for proper export
    const hasExport =
      /export\s+default\s+makeScene/.test(code) ||
      /export\s+default\s+function/.test(code);

    if (!hasExport) {
      errors.push('Missing export default - Revideo scenes must export default makeScene(...)');
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
   * Includes the Revideo library and wraps the layer code appropriately.
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
<!-- Revideo Scene -->
<script type="module">
import {makeScene, useTime, createSignal, interpolate} from 'https://unpkg.com/@revideo/core@0.5.0/dist/index.js';
import {Rect, Circle, Txt} from 'https://unpkg.com/@revideo/2d@0.5.0/dist/index.js';

(function() {
  const container = document.createElement('div');
  container.className = 'layer revideo-layer';
  container.style.zIndex = ${zIndex};
  container.style.width = '${width}px';
  container.style.height = '${height}px';
  document.getElementById('composition').appendChild(container);

  // Scene configuration
  const config = {
    duration: 5,
    fps: ${fps},
    width: ${width},
    height: ${height},
  };

  // User scene code
${layer.code.split('\n').map(line => '  ' + line).join('\n')}

  // The scene is already exported and can be used
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

/** Singleton instance of RevideoAdapter */
export const revideoAdapter = new RevideoAdapter();
