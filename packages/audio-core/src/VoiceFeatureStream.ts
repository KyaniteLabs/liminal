import { detectPitch } from './PitchDetector.js';

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

const SPECTRUM_BINS = 64;

export function analyzeVoiceFrame(input: VoiceFeatureInput): VoiceFeatureFrame {
  const rms = computeRms(input.samples);
  const detectorPitch = detectPitch(input.samples, input.sampleRate);
  const pitch = detectorPitch.frequency === null
    ? estimatePitchByZeroCrossing(input.samples, input.sampleRate, rms)
    : detectorPitch;
  const spectrum = computeSpectrum(input.samples, SPECTRUM_BINS);
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

function estimatePitchByZeroCrossing(samples: Float32Array, sampleRate: number, rms: number): ReturnType<typeof detectPitch> {
  if (samples.length === 0 || rms < 0.01) return { frequency: null, clarity: 0, midi: null, noteName: null };
  const crossings: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    if (previous <= 0 && current > 0) {
      const span = current - previous;
      const offset = span === 0 ? 0 : -previous / span;
      crossings.push(i - 1 + offset);
    }
  }

  if (crossings.length < 2) return { frequency: null, clarity: 0, midi: null, noteName: null };
  const elapsedSamples = crossings[crossings.length - 1] - crossings[0];
  const cycles = crossings.length - 1;
  if (elapsedSamples <= 0) return { frequency: null, clarity: 0, midi: null, noteName: null };
  const frequency = (cycles * sampleRate) / elapsedSamples;
  if (frequency < 50 || frequency > 2000) return { frequency: null, clarity: 0, midi: null, noteName: null };
  return { frequency, clarity: Math.min(1, rms * 2), midi: null, noteName: null };
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function computeSpectrum(samples: Float32Array, bins: number): Float32Array {
  const spectrum = new Float32Array(bins);
  if (samples.length === 0) return spectrum;

  for (let bin = 0; bin < bins; bin++) {
    let real = 0;
    let imag = 0;
    const frequency = bin / bins;
    for (let i = 0; i < samples.length; i++) {
      const phase = -2 * Math.PI * frequency * i;
      real += samples[i] * Math.cos(phase);
      imag += samples[i] * Math.sin(phase);
    }
    spectrum[bin] = Math.sqrt(real * real + imag * imag) / samples.length;
  }
  return spectrum;
}

function computeCentroid(spectrum: Float32Array): number {
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < spectrum.length; i++) {
    total += spectrum[i];
    weighted += spectrum[i] * i;
  }
  return total === 0 ? 0 : weighted / total / spectrum.length;
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
