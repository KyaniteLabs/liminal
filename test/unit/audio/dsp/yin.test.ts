import { describe, expect, it } from 'vitest';
import { detectPitchYin } from '@sinter/audio-core/dsp/yin.js';

function sine(freq: number, n: number, sampleRate: number): Float32Array {
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return s;
}

describe('detectPitchYin', () => {
  const N = 2048;
  const sr = 48000;

  it('detects a 220 Hz tone within 2 Hz with high clarity', () => {
    const r = detectPitchYin(sine(220, N, sr), sr);
    expect(typeof r.frequency).toBe('number');
    expect(Math.abs((r.frequency as number) - 220)).toBeLessThan(2);
    expect(r.clarity).toBeGreaterThan(0.8);
  });

  it('detects a low C3 (130.81 Hz) within 2 Hz — the case the 128-sample path failed', () => {
    const r = detectPitchYin(sine(130.81, N, sr), sr);
    expect(typeof r.frequency).toBe('number');
    expect(Math.abs((r.frequency as number) - 130.81)).toBeLessThan(2);
  });

  it('returns null frequency for white noise', () => {
    const noise = new Float32Array(N);
    let seed = 12345;
    for (let i = 0; i < N; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    expect(detectPitchYin(noise, sr).frequency).toBeNull();
  });

  it('returns null frequency for silence', () => {
    expect(detectPitchYin(new Float32Array(N), sr).frequency).toBeNull();
  });

  it('rejects out-of-range pitch (below 50 Hz)', () => {
    const r = detectPitchYin(sine(30, N, sr), sr);
    expect(r.frequency).toBeNull();
  });
});
