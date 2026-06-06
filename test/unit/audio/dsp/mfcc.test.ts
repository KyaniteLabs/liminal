import { describe, expect, it } from 'vitest';
import { computeMfcc } from '@liminal/audio-core/dsp/mfcc.js';

const SR = 48000;

// Build a half-spectrum (N/2 bins) with energy concentrated around `peakHz`.
function spectrumWithPeak(peakHz: number, half = 1024): Float32Array {
  const N = half * 2;
  const peakBin = Math.round((peakHz * N) / SR);
  const s = new Float32Array(half);
  for (let k = 0; k < half; k++) {
    s[k] = Math.exp(-((k - peakBin) ** 2) / (2 * 30 ** 2)); // gaussian bump
  }
  return s;
}

describe('computeMfcc', () => {
  it('returns the requested number of finite coefficients', () => {
    const mfcc = computeMfcc(spectrumWithPeak(500), SR, 26, 13);
    expect(mfcc.length).toBe(13);
    expect(mfcc.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const a = computeMfcc(spectrumWithPeak(500), SR);
    const b = computeMfcc(spectrumWithPeak(500), SR);
    expect(a).toEqual(b);
  });

  it('encodes spectral tilt: low-frequency-heavy has higher MFCC[1] than high-frequency-heavy', () => {
    const low = computeMfcc(spectrumWithPeak(300), SR);
    const high = computeMfcc(spectrumWithPeak(6000), SR);
    expect(low[1]).toBeGreaterThan(high[1]);
  });
});
