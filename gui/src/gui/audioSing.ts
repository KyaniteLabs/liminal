export interface AudioSingFrame {
  rms: number;
  centroid: number;
  pitch: number;
  note: string;
  onset: boolean;
  voiced: boolean;
  confidence: number;
  /** Timestamp (performance.now()) when this frame was captured */
  capturedAt: number;
}

export interface AudioSingSummary {
  avgRms: number;
  peakRms: number;
  avgCentroid: number;
  durationSeconds: number;
  avgPitch: number;
  onsetCount: number;
  label: string;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function energyLabel(peakRms: number): string {
  if (peakRms > 0.22) return 'powerful voice';
  if (peakRms > 0.09) return 'expressive voice';
  return 'soft voice';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToNote(freq: number): string {
  if (freq <= 0 || !Number.isFinite(freq)) return '';
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[(midi % 12 + 12) % 12];
  return `${name}${octave}`;
}

/** Autocorrelation pitch detection (YIN-like) on uint8 time-domain data */
function detectPitch(timeData: Uint8Array, sampleRate: number): { pitch: number; confidence: number } {
  const n = timeData.length;
  // Convert uint8 [-128,127] to float [-1,1]
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = (timeData[i] - 128) / 128;

  // Difference function
  const diff = new Float32Array(n);
  for (let tau = 0; tau < n; tau++) {
    let d = 0;
    for (let i = 0; i < n - tau; i++) {
      const delta = buf[i] - buf[i + tau];
      d += delta * delta;
    }
    diff[tau] = d;
  }

  // Cumulative mean normalized difference
  const cmnd = new Float32Array(n);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < n; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = diff[tau] * tau / runningSum;
  }

  // Find first valley below threshold
  const threshold = 0.1;
  let tauEstimate = -1;
  for (let tau = 2; tau < n; tau++) {
    if (cmnd[tau] < threshold) {
      // Local minimum
      while (tau + 1 < n && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate === -1) {
    // No valley found, pick global minimum
    let minVal = Infinity;
    for (let tau = 2; tau < n / 2; tau++) {
      if (cmnd[tau] < minVal) {
        minVal = cmnd[tau];
        tauEstimate = tau;
      }
    }
  }
  if (tauEstimate <= 0 || tauEstimate >= n / 2) {
    return { pitch: 0, confidence: 0 };
  }

  // Parabolic interpolation for sub-sample accuracy
  const x0 = tauEstimate - 1;
  const x1 = tauEstimate;
  const x2 = tauEstimate + 1;
  const y0 = cmnd[x0];
  const y1 = cmnd[x1];
  const y2 = cmnd[x2];
  const denom = 2 * (2 * y1 - y0 - y2);
  const shift = denom === 0 ? 0 : (y0 - y2) / denom;
  const tauOptimal = x1 + shift;

  const pitch = sampleRate / tauOptimal;
  const confidence = 1 - Math.min(cmnd[tauEstimate], 1);
  return { pitch: pitch > 50 && pitch < 4000 ? pitch : 0, confidence };
}

export function analyzeSingFrame(
  timeData: Uint8Array,
  frequencyData: Uint8Array,
  sampleRate: number,
  prevRms: number,
): AudioSingFrame {
  // RMS
  let sum = 0;
  for (const value of timeData) {
    const normalized = (value - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / timeData.length);

  // Spectral centroid
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    total += frequencyData[i];
    weighted += frequencyData[i] * i;
  }
  const centroid = total ? weighted / total / frequencyData.length : 0;

  // Pitch
  const { pitch, confidence } = detectPitch(timeData, sampleRate);

  // Voiced detection
  const voiced = rms > 0.015 && confidence > 0.3 && pitch > 50;

  // Onset detection - sudden energy spike
  const rmsDelta = rms - prevRms;
  const onset = rms > 0.03 && rmsDelta > 0.025;

  return {
    rms,
    centroid,
    pitch,
    note: voiced ? freqToNote(pitch) : '',
    onset,
    voiced,
    confidence,
    capturedAt: performance.now(),
  };
}

export function summarizeAudioSing(frames: AudioSingFrame[], sampleRateFps = 30): AudioSingSummary {
  const rmsValues = frames.map((frame) => frame.rms);
  const centroidValues = frames.map((frame) => frame.centroid);
  const pitchValues = frames.filter((f) => f.pitch > 0).map((f) => f.pitch);
  const onsetCount = frames.filter((f) => f.onset).length;
  const avgRms = average(rmsValues);
  const peakRms = rmsValues.length ? Math.max(...rmsValues) : 0;
  const avgCentroid = average(centroidValues);
  const durationSeconds = frames.length / sampleRateFps;
  const avgPitch = pitchValues.length ? average(pitchValues) : 0;

  return {
    avgRms,
    peakRms,
    avgCentroid,
    durationSeconds,
    avgPitch,
    onsetCount,
    label: `${energyLabel(peakRms)} · ${durationSeconds.toFixed(1)}s${avgPitch > 0 ? ' · pitch detected' : ''}${onsetCount > 0 ? ` · ${onsetCount} onsets` : ''}`,
  };
}
