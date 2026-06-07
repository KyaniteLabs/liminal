import { describe, expect, it } from 'vitest';
import { hannWindow, applyWindow } from '@sinter/audio-core/dsp/window.js';

describe('hannWindow', () => {
  it('is 0 at edges and 1 at center for odd length', () => {
    const w = hannWindow(5);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[2]).toBeCloseTo(1, 6);
    expect(w[4]).toBeCloseTo(0, 6);
  });

  it('is symmetric', () => {
    const w = hannWindow(8);
    for (let i = 0; i < w.length; i++) {
      expect(w[i]).toBeCloseTo(w[w.length - 1 - i], 6);
    }
  });

  it('returns ones for degenerate lengths (<=1) to avoid divide-by-zero', () => {
    expect(Array.from(hannWindow(1))).toEqual([1]);
    expect(Array.from(hannWindow(0))).toEqual([]);
  });

  it('applyWindow scales samples elementwise', () => {
    const out = applyWindow(new Float32Array([1, 1, 1, 1, 1]), hannWindow(5));
    expect(out[2]).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0, 6);
  });

  it('applyWindow throws on length mismatch', () => {
    expect(() => applyWindow(new Float32Array(4), hannWindow(5))).toThrow();
  });
});
