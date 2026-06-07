import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock at the boundaries: the generator registry (external generation) and the
// HTML wrapper. vi.hoisted is mandatory — vi.mock factories are hoisted above consts.
const mocks = vi.hoisted(() => {
  return {
    entries: [] as Array<{ name: string; generate: (p: string) => Promise<string> | string }>,
    registerAllGenerators: vi.fn(async () => {}),
  };
});

vi.mock('../../../src/generators/GeneratorRegistry.js', () => ({
  generatorRegistry: { getAll: () => mocks.entries },
}));
vi.mock('../../../src/generators/registerGenerators.js', () => ({
  registerAllGenerators: mocks.registerAllGenerators,
}));
vi.mock('../../../src/utils/htmlWrapper.js', () => ({
  HTMLWrapper: { wrap: (code: string, opts: { domain?: string }) => `<html data-d="${opts?.domain}">${code}</html>` },
}));

import { CompositionOrchestrator } from '../../../src/composition/CompositionOrchestrator.js';

describe('CompositionOrchestrator.compose', () => {
  beforeEach(() => {
    mocks.entries = [
      { name: 'shader', generate: async () => 'precision highp float; void main(){gl_FragColor=vec4(1.0);}' },
      { name: 'p5', generate: async () => 'function setup(){} function draw(){clear();}' },
      { name: 'tone', generate: async () => 'const s=new Tone.Synth().toDestination();' },
    ];
    mocks.registerAllGenerators.mockClear();
  });

  it('throws when no layers are given', async () => {
    await expect(CompositionOrchestrator.compose({ layers: [] })).rejects.toThrow(/at least one layer/);
  });

  it('generates each layer and assembles one stacked, blended composite', async () => {
    const result = await CompositionOrchestrator.compose({
      title: 'Test Work',
      layers: [
        { domain: 'shader', prompt: 'a nebula', blendMode: 'normal', opacity: 1 },
        { domain: 'p5', prompt: 'fireflies', blendMode: 'screen', opacity: 0.9 },
      ],
    });

    expect(result.successCount).toBe(2);
    expect(result.layers).toHaveLength(2);
    // Two stacked layer iframes, with z-order increasing.
    expect((result.html.match(/class="liminal-layer"/g) ?? []).length).toBe(2);
    expect(result.html).toContain('z-index:1');
    expect(result.html).toContain('z-index:2');
    // The screen blend + opacity from the second layer are applied.
    expect(result.html).toContain('mix-blend-mode:screen');
    expect(result.html).toContain('opacity:0.9');
    // Title is reflected in the document.
    expect(result.html).toContain('Test Work');
    // No audio layer → no start overlay.
    expect(result.html).not.toContain('liminal-start');
  });

  it('adds a start overlay and an invisible frame for audio layers', async () => {
    const result = await CompositionOrchestrator.compose({
      layers: [
        { domain: 'shader', prompt: 'a nebula' },
        { domain: 'tone', prompt: 'ambient pad' },
      ],
    });
    expect(result.successCount).toBe(2);
    expect(result.html).toContain('liminal-start');
    // Audio frame is rendered 1px/invisible rather than full-stage.
    expect(result.html).toContain('width:1px;height:1px;opacity:0');
  });

  it('degrades gracefully when a layer generator throws', async () => {
    mocks.entries = [
      { name: 'shader', generate: async () => 'void main(){}' },
      { name: 'p5', generate: async () => { throw new Error('LLM unavailable'); } },
    ];
    const result = await CompositionOrchestrator.compose({
      layers: [
        { domain: 'shader', prompt: 'bg' },
        { domain: 'p5', prompt: 'particles' },
      ],
    });
    expect(result.successCount).toBe(1);
    expect(result.layers[1].generated).toBe(false);
    expect(result.layers[1].error).toBe('LLM unavailable');
    // Only the successful layer appears in the stack.
    expect((result.html.match(/class="liminal-layer"/g) ?? []).length).toBe(1);
  });

  it('records an unsupported-domain error without crashing', async () => {
    const result = await CompositionOrchestrator.compose({
      layers: [{ domain: 'video', prompt: 'clip' }],
    });
    expect(result.successCount).toBe(0);
    expect(result.layers[0].generated).toBe(false);
    expect(result.layers[0].error).toMatch(/unsupported layer domain: video/);
  });
});
