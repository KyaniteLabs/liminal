import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
import { exceedsWashoutBudget } from '../../../src/composition/BlendBudget.js';

// The measured render gate launches headless Chrome — out of scope for every
// unit test in this file (covered by the CompositeRenderGate suite + probe).
beforeEach(() => {
  process.env.SINTER_COMPOSITE_GATE = '0';
});
afterEach(() => {
  delete process.env.SINTER_COMPOSITE_GATE;
});

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
    expect((result.html.match(/class="sinter-layer"/g) ?? []).length).toBe(2);
    expect(result.html).toContain('z-index:1');
    expect(result.html).toContain('z-index:2');
    // The screen blend + opacity from the second layer are applied.
    expect(result.html).toContain('mix-blend-mode:screen');
    expect(result.html).toContain('opacity:0.9');
    // Title is reflected in the document.
    expect(result.html).toContain('Test Work');
    // No audio layer → no start overlay.
    expect(result.html).not.toContain('sinter-start');
  });

  it('adds a start overlay and an invisible frame for audio layers', async () => {
    const result = await CompositionOrchestrator.compose({
      layers: [
        { domain: 'shader', prompt: 'a nebula' },
        { domain: 'tone', prompt: 'ambient pad' },
      ],
    });
    expect(result.successCount).toBe(2);
    expect(result.html).toContain('sinter-start');
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
    expect((result.html.match(/class="sinter-layer"/g) ?? []).length).toBe(1);
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

describe('CompositionOrchestrator.parseSpec (NL decomposition parsing)', () => {
  it('parses fenced JSON, drops invalid domains, clamps opacity, keeps blend modes', () => {
    const raw = '```json\n' + JSON.stringify({
      title: 'Reef', background: '#012',
      layers: [
        { domain: 'shader', prompt: 'caustics bg', blendMode: 'normal', opacity: 1 },
        { domain: 'NOPE', prompt: 'x' },
        { domain: 'p5', prompt: 'fish', blendMode: 'screen', opacity: 1.7 },
      ],
    }) + '\n```';
    const spec = CompositionOrchestrator.parseSpec(raw, 'a coral reef');
    expect(spec.title).toBe('Reef');
    expect(spec.background).toBe('#012');
    expect(spec.layers).toHaveLength(2); // invalid domain dropped
    expect(spec.layers[0].domain).toBe('shader');
    expect(spec.layers[1].domain).toBe('p5');
    expect(spec.layers[1].blendMode).toBe('screen');
    expect(spec.layers[1].opacity).toBe(1); // 1.7 clamped to 1
  });

  it('falls back to a single p5 layer of the original idea when JSON is unusable', () => {
    const spec = CompositionOrchestrator.parseSpec('this is not json', 'a glowing forest at dusk');
    expect(spec.layers).toHaveLength(1);
    expect(spec.layers[0].domain).toBe('p5');
    expect(spec.layers[0].prompt).toBe('a glowing forest at dusk');
  });

  it('defaults an unknown blend mode to normal and missing opacity to 1', () => {
    const raw = JSON.stringify({ layers: [{ domain: 'three', prompt: 'spheres', blendMode: 'plasma' }] });
    const spec = CompositionOrchestrator.parseSpec(raw, 'idea');
    expect(spec.layers[0].blendMode).toBe('normal');
    expect(spec.layers[0].opacity).toBe(1);
  });
});

describe('CompositionOrchestrator — foreground transparency contract', () => {
  beforeEach(() => {
    mocks.registerAllGenerators.mockClear();
  });

  it('applies the transparency contract to foreground layers but leaves the base prompt untouched', async () => {
    const seen: Record<string, string> = {};
    mocks.entries = [
      { name: 'shader', generate: async (p: string) => { seen.shader = p; return 'void main(){gl_FragColor=vec4(1.0);}'; } },
      { name: 'p5', generate: async (p: string) => { seen.p5 = p; return 'function draw(){ clear(); circle(1,1,1); }'; } },
    ];
    await CompositionOrchestrator.compose({
      layers: [
        { domain: 'shader', prompt: 'aurora base' },  // base (z=1) — opaque allowed
        { domain: 'p5', prompt: 'snow particles' },    // foreground (z=2) — must be transparent
      ],
    });
    expect(seen.shader).toBe('aurora base');
    expect(seen.p5).toContain('snow particles');
    expect(seen.p5).toContain('FULLY TRANSPARENT canvas');
    expect(seen.p5).toContain('clear()');
  });

  it('flags a foreground p5 layer that paints an opaque background; base is exempt', async () => {
    mocks.entries = [
      { name: 'shader', generate: async () => 'void main(){gl_FragColor=vec4(1.0);}' },
      { name: 'p5', generate: async () => 'function draw(){ background(20, 30, 40); ellipse(1,1,1); }' },
    ];
    const result = await CompositionOrchestrator.compose({
      layers: [
        { domain: 'shader', prompt: 'bg' },
        { domain: 'p5', prompt: 'opaque sky foreground' },
      ],
    });
    expect(result.layers[0].opaqueBackground).toBe(false); // base not guarded
    expect(result.layers[1].opaqueBackground).toBe(true);  // foreground opaque bg flagged
  });

  it('does not flag a base layer that paints an opaque background', async () => {
    mocks.entries = [
      { name: 'p5', generate: async () => 'function draw(){ background(0); }' },
    ];
    const result = await CompositionOrchestrator.compose({
      layers: [{ domain: 'p5', prompt: 'opaque base' }],
    });
    expect(result.layers[0].opaqueBackground).toBe(false);
  });
});

describe('CompositionOrchestrator.decomposePrompt — washout brightness cap', () => {
  const mockLLM = (specObj: unknown) =>
    ({ generate: async () => ({ code: JSON.stringify(specObj) }) }) as unknown as Parameters<
      typeof CompositionOrchestrator.decomposePrompt
    >[1];

  it('caps a decomposition that stacks multiple bright layers to stay within the washout budget', async () => {
    const washy = {
      title: 'Washy', background: '#02030a',
      layers: [
        { domain: 'three', prompt: 'glacier', blendMode: 'normal', opacity: 1 },
        { domain: 'shader', prompt: 'aurora', blendMode: 'screen', opacity: 1 },
        { domain: 'p5', prompt: 'glints', blendMode: 'screen', opacity: 1 },
        { domain: 'hydra', prompt: 'wisps', blendMode: 'lighten', opacity: 1 },
      ],
    };
    const spec = await CompositionOrchestrator.decomposePrompt('an icy cavern', mockLLM(washy));
    expect(exceedsWashoutBudget(spec.layers)).toBe(false);
    // bright blends are KEPT (additive blends never occlude); excess opacity is scaled down
    expect(spec.layers.map((l) => l.blendMode)).toEqual(['normal', 'screen', 'screen', 'lighten']);
    expect(spec.layers[1].opacity).toBe(1);    // first bright layer kept full (running 1.0)
    expect(spec.layers[2].opacity).toBe(0.3);  // reduced to remaining budget (1.3 - 1.0)
    expect(spec.layers[3].opacity).toBe(0);    // budget already full → contributes nothing
  });

  it('leaves a single-bright-layer decomposition unchanged', async () => {
    const ok = {
      title: 'OK', background: '#000',
      layers: [
        { domain: 'three', prompt: 'bg', blendMode: 'normal', opacity: 1 },
        { domain: 'p5', prompt: 'fg', blendMode: 'screen', opacity: 1 },
      ],
    };
    const spec = await CompositionOrchestrator.decomposePrompt('idea', mockLLM(ok));
    expect(spec.layers.map((l) => l.blendMode)).toEqual(['normal', 'screen']);
  });
});
