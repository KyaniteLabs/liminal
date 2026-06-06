import { magnitudeSpectrum } from './dsp/fft.js';
import { detectPitchYin } from './dsp/yin.js';
import { hannWindow, applyWindow } from './dsp/window.js';

export interface VoiceFeatureFrame {
  rms: number;
  pitchHz: number;
  centroid: number;
  spectralFlux: number;
  onset: boolean;
  voiced: boolean;
  confidence: number;
  capturedAt: number;
  spectrum: Float32Array;
}

export interface VoiceFeatureInput {
  samples: Float32Array;
  sampleRate: number;
  previousSpectrum: Float32Array | null;
  nowMs?: number;
}

/**
 * Analyze one full analysis window (>= ~1024 samples) of voice audio.
 *
 * Pitch uses YIN over the whole window (stable down to ~50 Hz), and the spectrum
 * uses a Hann-windowed radix-2 FFT — replacing the previous 128-sample naive DFT
 * + zero-crossing fallback that produced jittery pitch.
 */
export function analyzeVoiceFrame(input: VoiceFeatureInput): VoiceFeatureFrame {
  const rms = computeRms(input.samples);
  const pitch = detectPitchYin(input.samples, input.sampleRate);
  const spectrum = computeSpectrum(input.samples);
  const centroid = computeCentroid(spectrum);
  const spectralFlux = input.previousSpectrum ? computeSpectralFlux(spectrum, input.previousSpectrum) : 0;
  const voiced = rms > 0.015 && pitch.frequency !== null && pitch.clarity > 0.1;
  const onset = rms > 0.03 && spectralFlux > 0.002;

  return {
    rms,
    pitchHz: pitch.frequency ?? 0,
    centroid,
    spectralFlux,
    onset,
    voiced,
    confidence: pitch.clarity,
    capturedAt: input.nowMs ?? Date.now(),
    spectrum,
  };
}

function largestPowerOfTwoLE(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/**
 * Hann-windowed FFT magnitude spectrum of the most-recent power-of-two samples.
 * Returns N/2 magnitude bins (bin k ≈ k * sampleRate / N Hz).
 */
function computeSpectrum(samples: Float32Array): Float32Array {
  const p2 = largestPowerOfTwoLE(samples.length);
  if (p2 < 2) return new Float32Array(0);
  const slice = samples.length === p2 ? samples : samples.slice(samples.length - p2);
  const windowed = applyWindow(slice, hannWindow(p2));
  return magnitudeSpectrum(windowed, 0);
}

function computeCentroid(spectrum: Float32Array): number {
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < spectrum.length; i++) {
    total += spectrum[i];
    weighted += spectrum[i] * i;
  }
  return total === 0 || spectrum.length === 0 ? 0 : weighted / total / spectrum.length;
}

function computeSpectralFlux(current: Float32Array, previous: Float32Array): number {
  const count = Math.min(current.length, previous.length);
  if (count === 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const delta = Math.max(0, current[i] - previous[i]);
    sum += delta * delta;
  }
  return Math.sqrt(sum / count);
}
