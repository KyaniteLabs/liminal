import { describe, it, expect } from 'vitest';
import {
  cumulativeBrightness,
  exceedsWashoutBudget,
  capLayerBrightness,
  CUMULATIVE_BRIGHTNESS_BUDGET,
} from '../../../src/composition/BlendBudget.js';

describe('composition BlendBudget — cumulativeBrightness', () => {
  it('weights brightening blends by opacity (screen=1.0, lighten=0.85, overlay=0.35)', () => {
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'screen', opacity: 1 }])).toBe(1.0);
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'lighten', opacity: 1 }])).toBe(0.85);
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'overlay', opacity: 1 }])).toBe(0.35);
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'screen', opacity: 0.5 }])).toBe(0.5);
  });

  it('counts non-brightening blends (normal/multiply/darken) as zero', () => {
    expect(cumulativeBrightness([{ domain: 'three', blendMode: 'normal', opacity: 1 }])).toBe(0);
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'multiply', opacity: 1 }])).toBe(0);
  });

  it('sums brightening across layers', () => {
    expect(cumulativeBrightness([
      { domain: 'shader', blendMode: 'screen', opacity: 1 },
      { domain: 'p5', blendMode: 'screen', opacity: 1 },
    ])).toBe(2.0);
  });

  it('excludes audio-domain layers (they render invisibly — no visual brightness)', () => {
    expect(cumulativeBrightness([{ domain: 'strudel', blendMode: 'screen', opacity: 1 }])).toBe(0);
    expect(cumulativeBrightness([{ domain: 'tone', blendMode: 'lighten', opacity: 1 }])).toBe(0);
  });

  it('treats a missing blendMode as normal and missing opacity as 1', () => {
    expect(cumulativeBrightness([{ domain: 'p5' }])).toBe(0);
    expect(cumulativeBrightness([{ domain: 'p5', blendMode: 'screen' }])).toBe(1.0);
  });
});

describe('composition BlendBudget — exceedsWashoutBudget (guard)', () => {
  it('flags multiple stacked bright layers that exceed the budget', () => {
    const washy = [
      { domain: 'shader', blendMode: 'screen', opacity: 1 },
      { domain: 'p5', blendMode: 'screen', opacity: 1 },
      { domain: 'three', blendMode: 'lighten', opacity: 1 },
    ] as const;
    expect(exceedsWashoutBudget([...washy])).toBe(true);
  });

  it('passes a single bright layer and a normal composite', () => {
    expect(exceedsWashoutBudget([{ domain: 'shader', blendMode: 'screen', opacity: 1 }])).toBe(false);
    expect(exceedsWashoutBudget([
      { domain: 'three', blendMode: 'normal', opacity: 1 },
      { domain: 'p5', blendMode: 'normal', opacity: 1 },
    ])).toBe(false);
  });
});

describe('composition BlendBudget — capLayerBrightness (fix)', () => {
  it('keeps the first dominant bright layer and reduces the opacity of excess bright layers (blend kept, never demoted to normal)', () => {
    const capped = capLayerBrightness([
      { domain: 'three', prompt: 'glacier', blendMode: 'normal', opacity: 1 },   // base
      { domain: 'shader', prompt: 'aurora', blendMode: 'screen', opacity: 0.9 }, // 1st bright — kept (running 0.9)
      { domain: 'p5', prompt: 'glints', blendMode: 'screen', opacity: 1 },       // 2nd bright — over budget → opacity reduced
    ]);
    // blends are KEPT (screen never occludes); only opacity is scaled to fit the budget
    expect(capped.map((l) => l.blendMode)).toEqual(['normal', 'screen', 'screen']);
    expect(capped[1].opacity).toBe(0.9);              // first bright unchanged
    expect(capped[2].opacity).toBe(0.4);              // 0.4 = remaining budget (1.3 - 0.9) / weight 1.0
    expect(cumulativeBrightness(capped)).toBeLessThanOrEqual(CUMULATIVE_BRIGHTNESS_BUDGET);
    expect(exceedsWashoutBudget(capped)).toBe(false);
    expect(capped[2].prompt).toBe('glints');          // other fields preserved
  });

  it('leaves a single bright layer and normal composites unchanged', () => {
    const single = capLayerBrightness([{ domain: 'shader', blendMode: 'screen', opacity: 1 }]);
    expect(single[0].blendMode).toBe('screen');
    const normal = capLayerBrightness([
      { domain: 'three', blendMode: 'normal', opacity: 1 },
      { domain: 'p5', blendMode: 'normal', opacity: 1 },
    ]);
    expect(normal.map((l) => l.blendMode)).toEqual(['normal', 'normal']);
  });

  it('does not demote audio layers (excluded from the budget)', () => {
    const capped = capLayerBrightness([
      { domain: 'three', blendMode: 'normal', opacity: 1 },
      { domain: 'shader', blendMode: 'screen', opacity: 1 },
      { domain: 'strudel', blendMode: 'screen', opacity: 0.6 },
    ]);
    expect(capped.map((l) => l.blendMode)).toEqual(['normal', 'screen', 'screen']);
  });

  it('never exceeds the budget even with a fractional remainder (opacity floored, not rounded)', () => {
    // lighten@0.85 contributes 0.7225; the screen layer must be capped so the total
    // stays <= budget (rounding up here would push it to ~1.3005 and re-trip the guard).
    const capped = capLayerBrightness([
      { domain: 'shader', blendMode: 'lighten', opacity: 0.85 },
      { domain: 'p5', blendMode: 'screen', opacity: 1 },
    ]);
    expect(cumulativeBrightness(capped)).toBeLessThanOrEqual(CUMULATIVE_BRIGHTNESS_BUDGET);
    expect(exceedsWashoutBudget(capped)).toBe(false);
  });

  it('caps to at most the budget when many bright layers stack', () => {
    const capped = capLayerBrightness([
      { domain: 'shader', blendMode: 'screen', opacity: 1 },
      { domain: 'p5', blendMode: 'screen', opacity: 1 },
      { domain: 'three', blendMode: 'lighten', opacity: 1 },
      { domain: 'hydra', blendMode: 'screen', opacity: 1 },
    ]);
    expect(cumulativeBrightness(capped)).toBeLessThanOrEqual(CUMULATIVE_BRIGHTNESS_BUDGET);
  });
});
