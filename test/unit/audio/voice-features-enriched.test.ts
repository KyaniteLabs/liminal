import { describe, expect, it } from 'vitest';
import { analyzeVoiceFrame } from '@sinter/audio-core/VoiceFeatureStream.js';

const SR = 48000;
const N = 2048;

function sine(freq: number, n: number, sampleRate: number, amp = 0.5): Float32Array {
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return s;
}

function noise(n: number): Float32Array {
  const s = new Float32Array(n);
  let seed = 4321;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    s[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return s;
}

describe('analyzeVoiceFrame — enriched features', () => {
  it('derives pitch-class and octave (A4 440 Hz = class 9, octave 4)', () => {
    const f = analyzeVoiceFrame({ samples: sine(440, N, SR), sampleRate: SR, previousSpectrum: null });
    expect(f.pitchClass).toBe(9);
    expect(f.octave).toBe(4);
  });

  it('reports brightness higher for a high tone than a low tone, both in [0,1]', () => {
    const lo = analyzeVoiceFrame({ samples: sine(200, N, SR), sampleRate: SR, previousSpectrum: null });
    const hi = analyzeVoiceFrame({ samples: sine(5000, N, SR), sampleRate: SR, previousSpectrum: null });
    expect(hi.brightness).toBeGreaterThan(lo.brightness);
    expect(lo.brightness).toBeGreaterThanOrEqual(0);
    expect(hi.brightness).toBeLessThanOrEqual(1);
  });

  it('reports higher breathiness for noise than for a pure tone', () => {
    const tone = analyzeVoiceFrame({ samples: sine(330, N, SR), sampleRate: SR, previousSpectrum: null });
    const air = analyzeVoiceFrame({ samples: noise(N), sampleRate: SR, previousSpectrum: null });
    expect(air.breathiness).toBeGreaterThan(tone.breathiness);
    expect(tone.breathiness).toBeGreaterThanOrEqual(0);
    expect(air.breathiness).toBeLessThanOrEqual(1);
  });

  it('classifies a vowel category and finite formants', () => {
    const f = analyzeVoiceFrame({ samples: sine(440, N, SR), sampleRate: SR, previousSpectrum: null });
    expect(['open-front', 'open-back', 'closed-front', 'closed-back', 'neutral']).toContain(f.vowel);
    expect(Number.isFinite(f.formants.f1)).toBe(true);
    expect(Number.isFinite(f.formants.f2)).toBe(true);
  });

  it('defaults pitch-class/octave to 0 when unvoiced (silence)', () => {
    const f = analyzeVoiceFrame({ samples: new Float32Array(N), sampleRate: SR, previousSpectrum: null });
    expect(f.pitchClass).toBe(0);
    expect(f.octave).toBe(0);
  });
});
