import { describe, expect, it } from 'vitest';
import { summarizeAudioSync } from '../../gui/src/gui/audioSync';

describe('audioSync', () => {
  it('summarizes voice sync frames without creating a generation prompt', () => {
    const summary = summarizeAudioSync([
      { rms: 0.04, centroid: 0.12 },
      { rms: 0.24, centroid: 0.42 },
      { rms: 0.16, centroid: 0.31 },
    ], 3);

    expect(summary.peakRms).toBeCloseTo(0.24);
    expect(summary.durationSeconds).toBeCloseTo(1);
    expect(summary.label).toContain('high-energy sync');
  });
});
