import { describe, expect, it } from 'vitest';
import { analyzeVoiceFrame } from '../../../packages/audio-core/src/VoiceFeatureStream.js';

function sineWave(frequency: number, sampleRate: number, seconds: number, gain = 0.7): Float32Array {
  const samples = Math.floor(sampleRate * seconds);
  const buffer = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    buffer[i] = Math.sin((i / sampleRate) * frequency * Math.PI * 2) * gain;
  }
  return buffer;
}

describe('VoiceFeatureStream', () => {
  it('extracts instrument-ready features from a voice frame', () => {
    const frame = analyzeVoiceFrame({
      samples: sineWave(440, 44_100, 0.05),
      sampleRate: 44_100,
      previousSpectrum: null,
      nowMs: 1234,
    });

    expect(frame.rms).toBeGreaterThan(0.45);
    expect(frame.pitchHz).toBeGreaterThan(420);
    expect(frame.pitchHz).toBeLessThan(460);
    expect(frame.voiced).toBe(true);
    expect(frame.capturedAt).toBe(1234);
  });

  it('reports spectral flux against the previous frame for onset mapping', () => {
    const first = analyzeVoiceFrame({
      samples: sineWave(220, 44_100, 0.05, 0.1),
      sampleRate: 44_100,
      previousSpectrum: null,
      nowMs: 1,
    });
    const second = analyzeVoiceFrame({
      samples: sineWave(880, 44_100, 0.05, 0.9),
      sampleRate: 44_100,
      previousSpectrum: first.spectrum,
      nowMs: 2,
    });

    expect(second.spectralFlux).toBeGreaterThan(first.spectralFlux);
    expect(second.onset).toBe(true);
  });
});
