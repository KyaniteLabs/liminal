import { describe, expect, it } from 'vitest';
import { createSingStabilizer, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
}

function voicedFrame(pitchHz: number, elapsedSeconds: number): SingUniformFrame {
  return {
    rms: 0.08,
    pitchHz,
    centroid: 0.4,
    spectralFlux: 0.01,
    onset: 0,
    voiced: 1,
    confidence: 0.9,
    elapsedSeconds,
  };
}

describe('createSingStabilizer (one-euro)', () => {
  it('reduces pitch jitter relative to the raw signal', () => {
    const s = createSingStabilizer();
    const raw = [220, 262, 206, 256, 210, 250, 214, 246, 218, 248];
    const out = raw.map((p, i) => s.stabilize(voicedFrame(p, 1 + i * 0.016)).pitchHz);
    expect(variance(out.slice(2))).toBeLessThan(variance(raw.slice(2)));
  });

  it('tracks a sustained jump with low lag', () => {
    const s = createSingStabilizer();
    for (let i = 0; i < 3; i++) s.stabilize(voicedFrame(200, 1 + i * 0.016));
    let last = 0;
    for (let i = 3; i < 10; i++) last = s.stabilize(voicedFrame(400, 1 + i * 0.016)).pitchHz;
    expect(last).toBeGreaterThan(380);
  });

  it('holds the last pitch when a frame is unvoiced', () => {
    const s = createSingStabilizer();
    s.stabilize(voicedFrame(330, 1));
    const unvoiced = s.stabilize({ ...voicedFrame(0, 1.016), voiced: 0, confidence: 0 });
    expect(unvoiced.pitchHz).toBeCloseTo(330, 0);
  });

  it('reset clears filter state', () => {
    const s = createSingStabilizer();
    s.stabilize(voicedFrame(200, 1));
    s.stabilize(voicedFrame(400, 1.016));
    s.reset();
    // after reset, the first sample initializes the filter (returned ~unchanged)
    expect(s.stabilize(voicedFrame(150, 2)).pitchHz).toBeCloseTo(150, 0);
  });
});
