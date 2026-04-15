/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToneAdapter } from '../../../../src/composition/adapters/ToneAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';

interface MockToneSynth {
  frequency: { value: number };
  triggerAttackRelease: (note: string, duration: string) => void;
  toDestination: () => MockToneSynth;
  dispose: () => void;
}

interface ToneRenderResult {
  synths: MockToneSynth[];
  transport: { state: 'started' | 'stopped' | 'paused'; bpm: { value: number }; start: () => void; stop: () => void };
  startTime: number;
}

function createLayer(code: string): Layer {
  return {
    id: 'tone-test-layer',
    type: 'tone',
    code,
    config: {
      zIndex: 1,
      blendMode: 'normal',
      opacity: 1,
      position: { x: 0, y: 0 },
      scale: 1,
    },
    metadata: {
      prompt: 'tone test',
      generator: 'test',
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

function installMockTone(): { synthFactory: ReturnType<typeof vi.fn>; transport: ToneRenderResult['transport'] } {
  const synthFactory = vi.fn(function Synth(): MockToneSynth {
    return {
      frequency: { value: 440 },
      triggerAttackRelease: vi.fn(),
      toDestination: vi.fn(function toDestination(this: MockToneSynth) {
        return this;
      }),
      dispose: vi.fn(),
    };
  });

  const transport = {
    state: 'stopped' as const,
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
  };

  Object.defineProperty(window, 'Tone', {
    configurable: true,
    value: {
      Synth: synthFactory,
      Transport: transport,
      start: vi.fn().mockResolvedValue(undefined),
      Destination: { volume: { value: -10 } },
      getContext: vi.fn(() => ({ currentTime: 0 })),
    },
  });

  return { synthFactory, transport };
}

describe('ToneAdapter security', () => {
  let adapter: ToneAdapter;
  let container: HTMLElement;
  let settings: GlobalSettings;

  beforeEach(() => {
    adapter = new ToneAdapter();
    container = document.createElement('div');
    settings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#000000',
      audio: { volume: 0.8 },
    };
    installMockTone();
    adapter.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'Tone');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Reflect.deleteProperty(window as any, '__trackSynth');
  });

  it('executes benign Tone code and tracks synths', () => {
    const layer = createLayer('const synth = new Tone.Synth().toDestination();');

    const result = adapter.render(layer, container) as ToneRenderResult;

    expect(result.synths).toHaveLength(1);
    expect(container.querySelector(`#tone-start-${layer.id}`)).not.toBeNull();
  });

  it('blocks code that tries to access browser globals', () => {
    const fetchSpy = vi.fn();
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetchSpy });
    const layer = createLayer('const synth = new Tone.Synth().toDestination(); fetch("https://evil.test");');

    const result = adapter.render(layer, container) as ToneRenderResult;

    expect(result.synths).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks string-based dynamic execution patterns', () => {
    const layer = createLayer('const synth = new Tone.Synth().toDestination(); setTimeout("alert(1)", 0);');

    const result = adapter.render(layer, container) as ToneRenderResult;

    expect(result.synths).toHaveLength(0);
  });

  it('cleans up the synth tracking global after execution', () => {
    const layer = createLayer('const synth = new Tone.Synth().toDestination();');

    adapter.render(layer, container);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__trackSynth).toBeUndefined();
  });

  it('generates Tone script with layer code', () => {
    const layer = createLayer('const synth = new Tone.Synth().toDestination();');

    const script = adapter.generateScript(layer, settings);

    expect(script).toContain('Tone.js');
    expect(script).toContain(layer.code);
  });
});
