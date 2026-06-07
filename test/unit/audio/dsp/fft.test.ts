import { describe, expect, it } from 'vitest';
import { magnitudeSpectrum } from '@sinter/audio-core/dsp/fft.js';

function sine(freq: number, n: number, sampleRate: number): Float32Array {
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return s;
}

describe('magnitudeSpectrum', () => {
  const N = 1024;
  const sr = 48000;

  it('returns N/2 magnitudes', () => {
    expect(magnitudeSpectrum(sine(440, N, sr), sr).length).toBe(N / 2);
  });

  it('peaks at the bin nearest the sine frequency', () => {
    const freq = 1000;
    const mag = magnitudeSpectrum(sine(freq, N, sr), sr);
    let peak = 0;
    for (let i = 1; i < mag.length; i++) if (mag[i] > mag[peak]) peak = i;
    const peakHz = (peak * sr) / N;
    expect(Math.abs(peakHz - freq)).toBeLessThan(sr / N + 1);
  });

  it('peaks at bin 0 for a DC signal', () => {
    const dc = new Float32Array(N).fill(0.5);
    const mag = magnitudeSpectrum(dc, sr);
    let peak = 0;
    for (let i = 1; i < mag.length; i++) if (mag[i] > mag[peak]) peak = i;
    expect(peak).toBe(0);
  });

  it('throws when length is not a power of two', () => {
    expect(() => magnitudeSpectrum(new Float32Array(1000), sr)).toThrow();
  });

  it('returns near-zero magnitude for a silent signal', () => {
    const mag = magnitudeSpectrum(new Float32Array(N), sr);
    const max = Math.max(...Array.from(mag));
    expect(max).toBeLessThan(1e-6);
  });
});
