import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '@sinter/audio-core/dsp/OneEuroFilter.js';

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
}

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged (initialization)', () => {
    const f = new OneEuroFilter();
    expect(f.filter(3.5, 0)).toBe(3.5);
  });

  it('approaches a step target gradually and monotonically (not instant)', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    f.filter(0, 0);
    const out: number[] = [];
    // ~40 frames at 16ms: enough for a 1 Hz min-cutoff filter to settle past 9.
    for (let t = 16; t <= 16 * 40; t += 16) out.push(f.filter(10, t));
    // first post-step output is strictly between 0 and 10 (smoothed, not instant)
    expect(out[0]).toBeGreaterThan(0);
    expect(out[0]).toBeLessThan(10);
    // monotonically increasing toward the target
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
    // eventually settles close to the target
    expect(out[out.length - 1]).toBeGreaterThan(9);
  });

  it('reduces variance of a noisy-around-constant signal', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.0 });
    const raw: number[] = [];
    const filtered: number[] = [];
    let seed = 7;
    for (let i = 0; i < 200; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const noise = (seed / 0x7fffffff - 0.5) * 2; // [-1,1]
      const x = 5 + noise;
      raw.push(x);
      filtered.push(f.filter(x, i * 16));
    }
    expect(variance(filtered.slice(20))).toBeLessThan(variance(raw.slice(20)));
  });

  it('reset clears state so the next sample initializes again', () => {
    const f = new OneEuroFilter();
    f.filter(1, 0);
    f.filter(2, 16);
    f.reset();
    expect(f.filter(99, 32)).toBe(99);
  });
});
