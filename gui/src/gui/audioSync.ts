export interface AudioSyncFrame {
  rms: number;
  centroid: number;
}

export interface AudioSyncSummary {
  avgRms: number;
  peakRms: number;
  avgCentroid: number;
  durationSeconds: number;
  label: string;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function energyLabel(peakRms: number): string {
  if (peakRms > 0.22) return 'high-energy sync';
  if (peakRms > 0.09) return 'expressive sync';
  return 'quiet sync';
}

export function summarizeAudioSync(frames: AudioSyncFrame[], sampleRateFps = 30): AudioSyncSummary {
  const rmsValues = frames.map((frame) => frame.rms);
  const centroidValues = frames.map((frame) => frame.centroid);
  const avgRms = average(rmsValues);
  const peakRms = rmsValues.length ? Math.max(...rmsValues) : 0;
  const avgCentroid = average(centroidValues);
  const durationSeconds = frames.length / sampleRateFps;

  return {
    avgRms,
    peakRms,
    avgCentroid,
    durationSeconds,
    label: `${energyLabel(peakRms)} · ${durationSeconds.toFixed(1)}s`,
  };
}
