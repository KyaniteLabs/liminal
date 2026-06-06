/**
 * YIN fundamental-frequency estimator.
 *
 * Implements the YIN algorithm (de Cheveigné & Kawahara, 2002):
 *   1. difference function
 *   2. cumulative mean normalized difference (CMND)
 *   3. absolute threshold
 *   4. parabolic interpolation
 *
 * Designed for a full analysis window (>= 1024 samples) so it can resolve sung
 * pitch down to ~50 Hz — unlike the old 128-sample path that fell back to noisy
 * zero-crossing estimation.
 */

export interface YinResult {
  /** Detected fundamental in Hz, or null if unvoiced / out of range. */
  frequency: number | null;
  /** Confidence (0–1): 1 - CMND at the chosen lag. */
  clarity: number;
}

const ABSOLUTE_THRESHOLD = 0.1;
const UNVOICED_CMND_CUTOFF = 0.3; // CMND above this → treat as unvoiced
const MIN_HZ = 50;
const MAX_HZ = 2000;
const SILENCE_RMS = 1e-4;

export function detectPitchYin(samples: Float32Array, sampleRate: number): YinResult {
  const n = samples.length;

  // Silence gate.
  let energy = 0;
  for (let i = 0; i < n; i++) energy += samples[i] * samples[i];
  const rms = Math.sqrt(energy / Math.max(1, n));
  if (rms < SILENCE_RMS) return { frequency: null, clarity: 0 };

  const minTau = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxTau = Math.min(Math.floor(n / 2), Math.floor(sampleRate / MIN_HZ));
  if (maxTau <= minTau) return { frequency: null, clarity: 0 };

  // Difference function over an integration window W = n - maxTau.
  const w = n - maxTau;
  const diff = new Float64Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const delta = samples[j] - samples[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference.
  const cmnd = new Float64Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += diff[tau];
    cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
  }

  // Absolute threshold: first local minimum below threshold, else global min.
  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < ABSOLUTE_THRESHOLD) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate === -1) {
    let best = minTau;
    for (let tau = minTau + 1; tau <= maxTau; tau++) {
      if (cmnd[tau] < cmnd[best]) best = tau;
    }
    if (cmnd[best] > UNVOICED_CMND_CUTOFF) return { frequency: null, clarity: 0 };
    tauEstimate = best;
  }

  // Parabolic interpolation around tauEstimate for sub-sample precision.
  const refined = parabolicMinimum(cmnd, tauEstimate, maxTau);
  const frequency = sampleRate / refined;
  if (frequency < MIN_HZ || frequency > MAX_HZ) return { frequency: null, clarity: 0 };

  const clarity = Math.min(1, Math.max(0, 1 - cmnd[tauEstimate]));
  return { frequency, clarity };
}

function parabolicMinimum(cmnd: Float64Array, tau: number, maxTau: number): number {
  if (tau <= 1 || tau >= maxTau) return tau;
  const x0 = cmnd[tau - 1];
  const x1 = cmnd[tau];
  const x2 = cmnd[tau + 1];
  const denom = x0 + x2 - 2 * x1;
  if (denom === 0) return tau;
  return tau + (x0 - x2) / (2 * denom);
}
