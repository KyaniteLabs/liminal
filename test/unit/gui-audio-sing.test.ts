import { describe, expect, it } from 'vitest';
import { summarizeAudioSing } from '../../gui/src/gui/audioSing';

describe('audioSing', () => {
  it('summarizes voice sync frames without creating a generation prompt', () => {
    const summary = summarizeAudioSing([
      { rms: 0.04, centroid: 0.12 },
      { rms: 0.24, centroid: 0.42 },
      { rms: 0.16, centroid: 0.31 },
    ], 3);

    expect(summary.peakRms).toBeCloseTo(0.24);
    expect(summary.durationSeconds).toBeCloseTo(1);
    expect(summary.label).toContain('powerful voice');
  });
});
