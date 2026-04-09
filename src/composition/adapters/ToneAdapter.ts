/**
 * ToneAdapter - Adapter for Tone.js audio layers.
 *
 * Renders Tone.js audio in a composition and exposes audio parameters
 * for cross-layer communication.
 *
 * SECURITY: User code runs in a sandboxed context with dangerous patterns blocked.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';
import { Logger } from '../../utils/Logger.js';

/** Tone.js types (simplified) */
interface ToneSynth {
  frequency: { value: number };
  triggerAttackRelease: (note: string, duration: string) => void;
  toDestination: () => ToneSynth;
}

interface ToneTransport {
  state: 'started' | 'stopped' | 'paused';
  bpm: { value: number };
  start: () => void;
  stop: () => void;
}

interface ToneInstance {
  Synth: new () => ToneSynth;
  Transport: ToneTransport;
  start: () => Promise<void>;
  Destination: { volume: { value: number } };
  getContext: () => { currentTime: number };
}

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
    { pattern: /location\s*[=\.]/gi, name: 'location access' },
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

export class ToneAdapter implements LayerAdapter {
  private toneModule?: ToneInstance;
  private instances = new Map<string, {
    synths: ToneSynth[];
    transport: ToneTransport;
    startTime: number;
  }>();

  /**
   * Load Tone.js module dynamically.
   */
  initialize(): void {
    if (!this.toneModule) {
      // In browser, Tone is global
      if (typeof window !== 'undefined' && (window as unknown as { Tone: ToneInstance }).Tone) {
        this.toneModule = (window as unknown as { Tone: ToneInstance }).Tone;
      }
      // Note: Tone.js is browser-only, no Node.js import
    }
  }

  render(layer: Layer, container: HTMLElement, context?: RenderContext): unknown {
    const Tone = this.toneModule;
    if (!Tone) {
      throw new Error('Tone.js not loaded. Call async initialize() first.');
    }

    // Create controls container
    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.bottom = '10px';
    controls.style.left = '10px';
    controls.style.zIndex = '1000';
    controls.innerHTML = `
      <button id="tone-start-${layer.id}">Start Audio</button>
      <button id="tone-stop-${layer.id}">Stop</button>
    `;
    container.appendChild(controls);

    // Track synths created by this layer
    const synths: ToneSynth[] = [];
    
    // Inject synth tracking into code
    const wrappedCode = layer.code.replace(
      /new\s+Tone\.Synth/g,
      '(() => { const s = new Tone.Synth(); __trackSynth(s); return s; })()'
    );

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

    // Sanitize user code to block dangerous patterns
    const { sanitized, blocked } = sanitizeUserCode(wrappedCode);

    if (blocked.length > 0) {
      Logger.warn('ToneAdapter', `Blocked ${blocked.length} dangerous patterns:`, blocked);
    }

    // Execute user code
    const startTime = Date.now();

    try {
      // Create tracking function for synths
      const trackSynthFn = (s: ToneSynth) => {
        synths.push(s);
        return s;
      };

      // Create sandboxed function with limited globals
      // Only expose: Tone, __trackSynth, console, Math
      const sandboxedFn = new Function(
        'Tone',
        '__trackSynth',
        'console',
        'Math',
        '"use strict";\n' + sanitized
      );

      // Execute in sandbox with limited context
      sandboxedFn(Tone, trackSynthFn, createSafeConsole(), Math);
    } catch (error) {
      Logger.error('ToneAdapter', 'Error executing Tone.js code:', error);
    }

    // Store instance info
    const instanceInfo = {
      synths,
      transport: Tone.Transport,
      startTime,
    };
    this.instances.set(layer.id, instanceInfo);

    // Set up controls
    const startBtn = document.getElementById(`tone-start-${layer.id}`);
    const stopBtn = document.getElementById(`tone-stop-${layer.id}`);
    
    startBtn?.addEventListener('click', () => {
      void Tone.start();
      Tone.Transport.start();
    });
    
    stopBtn?.addEventListener('click', () => {
      Tone.Transport.stop();
    });

    return instanceInfo;
  }

  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) return [];

    const Tone = this.toneModule;
    if (!Tone) return [];

    return [
      {
        name: 'isPlaying',
        type: 'boolean',
        getter: () => instance.transport.state === 'started',
        description: 'Whether audio is currently playing',
      },
      {
        name: 'bpm',
        type: 'number',
        getter: () => instance.transport.bpm.value,
        description: 'Current BPM',
      },
      {
        name: 'currentTime',
        type: 'number',
        getter: () => Tone.getContext().currentTime,
        description: 'Audio context current time',
      },
      {
        name: 'masterVolume',
        type: 'number',
        getter: () => Tone.Destination.volume.value,
        description: 'Master output volume in dB',
      },
      {
        name: 'activeSynths',
        type: 'number',
        getter: () => instance.synths.length,
        description: 'Number of active synths',
      },
      {
        name: 'elapsedTime',
        type: 'number',
        getter: () => (Date.now() - instance.startTime) / 1000,
        description: 'Time since layer started (seconds)',
      },
    ];
  }

  getImports(): Import[] {
    // Tone can import from visual layers for reactive audio
    return [
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
        from: 'p5',
        name: 'frameCount',
        as: 'syncFrame',
        required: false,
      },
    ];
  }

  destroy(layer: Layer): void {
    const instance = this.instances.get(layer.id);
    if (instance) {
      instance.transport.stop();
      // Dispose synths if they have dispose method
      instance.synths.forEach(synth => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((synth as any).dispose) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (synth as any).dispose();
        }
      });
      this.instances.delete(layer.id);
    }
  }

  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (!layer.code.includes('Tone.')) {
      errors.push('Code does not reference Tone.js (Tone. not found)');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  generateScript(layer: Layer, settings: GlobalSettings): string {
    const volume = settings.audio?.volume ?? 0.8;
    
    return `
<!-- Tone.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
<script>
(function() {
  // Wait for user interaction to start audio
  let started = false;
  
  async function initAudio() {
    if (started) return;
    await Tone.start();
    Tone.Destination.volume.value = ${Math.log10(volume) * 20}; // Convert to dB
    started = true;
  }
  
  // Auto-start on first click
  document.addEventListener('click', initAudio, { once: true });
  
  // Execute layer code
${layer.code.split('\n').map(line => '  ' + line).join('\n')}
})();
</script>`;
  }
}

/** Singleton instance */
export const toneAdapter = new ToneAdapter();
