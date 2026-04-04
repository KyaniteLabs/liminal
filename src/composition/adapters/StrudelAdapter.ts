/**
 * StrudelAdapter - Adapter for Strudel live coding music layers.
 *
 * Renders Strudel patterns in a composition and exposes pattern parameters
 * for cross-layer communication. Strudel is a pattern library for live coding music.
 *
 * @example
 * ```typescript
 * const adapter = new StrudelAdapter();
 * adapter.render(layer, container);
 * const exports = adapter.getExports(layer);
 * ```
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';
import { Logger } from '../../utils/Logger.js';

/** Strudel REPL interface */
interface StrudelRepl {
  evaluate: (code: string) => Promise<{ pattern: StrudelPattern }>;
  stop: () => void;
  getPattern: () => StrudelPattern | null;
  getBpm: () => number;
  getCycle: () => number;
}

/** Strudel pattern interface */
interface StrudelPattern {
  query: (state: unknown) => unknown[];
}

/** Strudel module interface */
interface StrudelModule {
  repl: StrudelRepl;
  Pattern: unknown;
}

/** Window with Strudel */
interface WindowWithStrudel extends Window {
  strudel?: StrudelModule;
}

/** Instance information for a rendered Strudel layer */
interface StrudelInstance {
  pattern: StrudelPattern | null;
  repl: StrudelRepl;
  startTime: number;
  bpm: number;
  isPlaying: boolean;
}

/**
 * Adapter for rendering Strudel live coding patterns in compositions.
 *
 * Strudel uses pattern functions like `s()`, `note()`, `stack()` to create
 * rhythmic and melodic patterns. This adapter integrates Strudel with the
 * composition system, enabling cross-layer communication with Tone.js (audio sync)
 * and p5.js (visual triggers).
 */
export class StrudelAdapter implements LayerAdapter {
  private strudelModule?: StrudelModule;
  private instances = new Map<string, StrudelInstance>();

  /**
   * Initialize the adapter by checking for Strudel in the global scope.
   *
   * In a browser environment, Strudel is expected to be loaded via CDN
   * and available as `window.strudel`.
   */
  initialize(): void {
    if (!this.strudelModule) {
      // In browser, Strudel is global
      if (typeof window !== 'undefined' && (window as WindowWithStrudel).strudel) {
        this.strudelModule = (window as WindowWithStrudel).strudel;
      }
      // Note: Strudel is browser-only, no Node.js import
    }
  }

  /**
   * Render a Strudel layer into the container.
   *
   * @param layer - The layer to render
   * @param container - The DOM container element
   * @param context - Optional render context for cross-layer communication
   * @returns The Strudel instance info
   * @throws Error if Strudel is not loaded
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): StrudelInstance {
    const strudel = this.strudelModule;
    if (!strudel) {
      throw new Error('Strudel not loaded. Call async initialize() first.');
    }

    // Create controls container
    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.bottom = '10px';
    controls.style.left = '10px';
    controls.style.zIndex = '1000';
    controls.innerHTML = `
      <button id="strudel-start-${layer.id}">Start Pattern</button>
      <button id="strudel-stop-${layer.id}">Stop</button>
    `;
    container.appendChild(controls);

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

    // Parse BPM from code if present
    const bpmMatch = layer.code.match(/bpm\s*\(\s*(\d+)\s*\)/);
    const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 120;

    // Execute the pattern code
    const startTime = Date.now();
    let pattern: StrudelPattern | null = null;

    try {
      // Evaluate the pattern in the Strudel REPL
      strudel.repl.evaluate(layer.code).then((result) => {
        pattern = result.pattern;
      }).catch((err) => {
        Logger.error('StrudelAdapter', 'Pattern evaluation failed:', err);
      });
    } catch (error) {
      Logger.error('StrudelAdapter', 'Error executing Strudel code:', error);
    }

    // Store instance info
    const instanceInfo: StrudelInstance = {
      pattern,
      repl: strudel.repl,
      startTime,
      bpm,
      isPlaying: false,
    };
    this.instances.set(layer.id, instanceInfo);

    // Set up controls
    const startBtn = document.getElementById(`strudel-start-${layer.id}`);
    const stopBtn = document.getElementById(`strudel-stop-${layer.id}`);

    startBtn?.addEventListener('click', () => {
      instanceInfo.isPlaying = true;
      // Strudel auto-starts on evaluate, but we can re-evaluate if needed
      void strudel.repl.evaluate(layer.code);
    });

    stopBtn?.addEventListener('click', () => {
      instanceInfo.isPlaying = false;
      strudel.repl.stop();
    });

    return instanceInfo;
  }

  /**
   * Get the exports for a layer.
   *
   * Exports provide values that other layers can import. Strudel exports:
   * - `pattern`: The current Strudel pattern object
   * - `bpm`: Current beats per minute
   * - `cyclePosition`: Position within the current cycle (0-1)
   * - `isPlaying`: Whether the pattern is currently playing
   * - `elapsedTime`: Time since the layer started (seconds)
   *
   * @param layer - The layer to get exports for
   * @returns Array of export definitions
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    return [
      {
        name: 'pattern',
        type: 'object',
        getter: () => instance.pattern,
        description: 'Current Strudel pattern object',
      },
      {
        name: 'bpm',
        type: 'number',
        getter: () => instance.bpm,
        description: 'Current BPM (beats per minute)',
      },
      {
        name: 'cyclePosition',
        type: 'number',
        getter: () => instance.repl.getCycle(),
        description: 'Position within current cycle (0-1)',
      },
      {
        name: 'isPlaying',
        type: 'boolean',
        getter: () => instance.isPlaying,
        description: 'Whether the pattern is currently playing',
      },
      {
        name: 'elapsedTime',
        type: 'number',
        getter: () => (Date.now() - instance.startTime) / 1000,
        description: 'Time since layer started (seconds)',
      },
    ];
  }

  /**
   * Get the imports that Strudel layers can use from other domains.
   *
   * Strudel can import:
   * - From Tone: `bpm`, `isPlaying` for audio synchronization
   * - From p5: `frameCount`, `mouseX`, `mouseY` for visual-reactive audio
   *
   * @param _layer - The layer (unused but kept for interface compatibility)
   * @returns Array of import definitions
   */
  getImports(_layer: Layer): Import[] {
    // Strudel can import from Tone for audio sync and p5 for visual triggers
    return [
      {
        from: 'tone',
        name: 'bpm',
        as: 'syncBpm',
        required: false,
      },
      {
        from: 'tone',
        name: 'isPlaying',
        as: 'tonePlaying',
        required: false,
      },
      {
        from: 'p5',
        name: 'frameCount',
        as: 'syncFrame',
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
    ];
  }

  /**
   * Destroy/cleanup a layer instance.
   *
   * Stops the audio and removes the instance from the registry.
   *
   * @param layer - The layer to destroy
   * @param _instance - The instance (unused, we track internally)
   */
  destroy(layer: Layer, _instance: unknown): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      instance.repl.stop();
      instance.isPlaying = false;
      this.instances.delete(layer.id);
    }
  }

  /**
   * Validate Strudel layer code.
   *
   * Checks for:
   * - Non-empty code
   * - Presence of pattern functions (s, note, stack, sound)
   * - ASCII-only characters
   * - Balanced parentheses
   *
   * @param layer - The layer to validate
   * @returns Validation result with valid flag and optional errors
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const code = layer.code.trim();

    if (!code) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Check for pattern functions
    const hasPatternFunction = /\$:\s*s\(|\.stack\(|sound\(|note\(|\bs\(["']/.test(code);
    if (!hasPatternFunction) {
      errors.push('Strudel code must contain pattern functions: s(), note(), stack(), or sound()');
    }

    // Check for non-ASCII characters
    if (/[\u4e00-\u9fff]/.test(code)) {
      errors.push('Strudel code contains non-ASCII characters');
    }

    // Check for unmatched parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Strudel code has unmatched parentheses: ${openParens} opening, ${closeParens} closing`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate a standalone script for HTML export.
   *
   * Creates a self-contained script that loads Strudel from CDN and
   * executes the layer code.
   *
   * @param layer - The layer to generate script for
   * @param settings - Global settings for the composition
   * @returns HTML script element as a string
   */
  generateScript(layer: Layer, settings: GlobalSettings): string {
    const bpm = settings.audio?.enabled ? 120 : 0;

    return `
<!-- Strudel REPL -->
<script src="https://unpkg.com/@strudel/repl@latest/dist/repl.js"></script>
<script>
(function() {
  // Initialize Strudel REPL
  const repl = strudel.repl;
  
  // Set BPM if specified in settings
  ${bpm > 0 ? `repl.setBpm(${bpm});` : ''}
  
  // Execute layer code
${layer.code.split('\n').map((line) => '  ' + line).join('\n')}
  
  // Auto-start the pattern
  repl.evaluate(\`${layer.code.replace(/`/g, '\\`')}\`);
})();
</script>`;
  }
}

/** Singleton instance */
export const strudelAdapter = new StrudelAdapter();
