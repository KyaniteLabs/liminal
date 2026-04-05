/**
 * ToneAdapter - Adapter for Tone.js audio layers.
 *
 * Renders Tone.js audio in a composition and exposes audio parameters
 * for cross-layer communication.
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

    // Execute user code
    const startTime = Date.now();
    
    try {
      // Define tracking function in eval context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__trackSynth = (s: ToneSynth) => {
        synths.push(s);
        return s;
      };
      
      // eslint-disable-next-line no-eval
      eval(wrappedCode);
      
      // Clean up tracking function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__trackSynth;
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
