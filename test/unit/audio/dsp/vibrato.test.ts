import { describe, expect, it } from 'vitest';
import { VibratoTracker } from '@sinter/audio-core/dsp/VibratoTracker.js';

/** Feed a vibrato-modulated pitch around 330 Hz; returns the final estimate. */
function feed(tracker: VibratoTracker, rateHz: number, depthCents: number, durSec: number, fps = 60) {
  const base = 330;
  const n = Math.round(durSec * fps);
  const dtMs = 1000 / fps;
  let last = { rate: 0, depth: 0 };
  for (let i = 0; i < n; i++) {
    const tMs = i * dtMs;
    const cents = depthCents * Math.sin((2 * Math.PI * rateHz * tMs) / 1000);
    const hz = base * 2 ** (cents / 1200);
    last = tracker.update(hz, tMs);
  }
  return last;
}

describe('VibratoTracker', () => {
  it('detects vibrato rate (~6 Hz) and depth (~30 cents)', () => {
    const est = feed(new VibratoTracker(), 6, 30, 1.0);
    expect(Math.abs(est.rate - 6)).toBeLessThan(1.0);
    expect(est.depth).toBeGreaterThan(15);
  });

  it('reports no vibrato for steady pitch', () => {
    const est = feed(new VibratoTracker(), 0, 0, 1.0);
    expect(est.rate).toBe(0);
    expect(est.depth).toBeLessThan(3);
  });

  it('reset clears history', () => {
    const t = new VibratoTracker();
    feed(t, 6, 30, 1.0);
    t.reset();
    expect(t.update(330, 0)).toEqual({ rate: 0, depth: 0 });
  });

  it('ignores unvoiced (pitchHz <= 0) frames', () => {
    const t = new VibratoTracker();
    expect(t.update(0, 0)).toEqual({ rate: 0, depth: 0 });
    expect(t.update(-1, 16)).toEqual({ rate: 0, depth: 0 });
  });
});
