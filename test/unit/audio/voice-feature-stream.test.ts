import { describe, expect, it } from 'vitest';
import { analyzeVoiceFrame } from '@liminal/audio-core/VoiceFeatureStream.js';

const SR = 48000;
const N = 2048;

function sine(freq: number, n: number, sampleRate: number, amp = 0.5): Float32Array {
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return s;
}

describe('analyzeVoiceFrame (FFT + YIN path)', () => {
  it('detects a sung G3 (196 Hz) within 2 Hz with high confidence', () => {
    const frame = analyzeVoiceFrame({ samples: sine(196, N, SR), sampleRate: SR, previousSpectrum: null });
    expect(Math.abs(frame.pitchHz - 196)).toBeLessThan(2);
    expect(frame.confidence).toBeGreaterThan(0.8);
    expect(frame.voiced).toBe(true);
  });

  it('reports unvoiced for white noise', () => {
    const noise = new Float32Array(N);
    let seed = 99;
    for (let i = 0; i < N; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    expect(analyzeVoiceFrame({ samples: noise, sampleRate: SR, previousSpectrum: null }).voiced).toBe(false);
  });

  it('reports near-silence for an empty signal', () => {
    const frame = analyzeVoiceFrame({ samples: new Float32Array(N), sampleRate: SR, previousSpectrum: null });
    expect(frame.rms).toBeLessThan(0.001);
    expect(frame.pitchHz).toBe(0);
    expect(frame.voiced).toBe(false);
  });

  it('produces a spectrum and a centroid in [0,1]', () => {
    const frame = analyzeVoiceFrame({ samples: sine(440, N, SR), sampleRate: SR, previousSpectrum: null });
    expect(frame.spectrum.length).toBeGreaterThan(0);
    expect(frame.centroid).toBeGreaterThanOrEqual(0);
    expect(frame.centroid).toBeLessThanOrEqual(1);
  });
});
