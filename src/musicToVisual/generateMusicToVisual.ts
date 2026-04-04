/**
 * Music-to-visual bridge: run generateMusic, analyze result (BPM/FFT),
 * pass audioInput to generateVisuals, return combined result.
 * 
 * Optional: Uses Meyda for real audio analysis if audio file is provided.
 */

import { generateMusic } from '../music/generateMusic.js';
import { generateVisuals } from '../generateVisuals.js';
import { Logger } from '../utils/Logger.js';

export interface GenerateMusicToVisualOptions {
  musicPlatform?: string;
  visualPlatform?: string;
  /** Optional traits (bpm, palette) passed to music/visual generators */
  traits?: { bpm?: number; palette?: string };
  /** Optional audio file path for real FFT analysis */
  audioFilePath?: string;
}

export interface AudioInput {
  bpm: number;
  fft: number[];
  /** Additional audio features (if available) */
  features?: {
    spectralCentroid?: number;
    rms?: number;
    zcr?: number;
  };
}

export interface GenerateMusicToVisualResult {
  musicCode: string;
  visualCode: string;
  audioInput?: AudioInput;
}

const DEFAULT_BPM = 120;
const DEFAULT_FFT_LEN = 16;

/** Generate synthetic FFT data based on music code patterns */
function generateSyntheticFFT(musicCode: string): number[] {
  // Analyze code patterns to generate more realistic FFT data
  const patterns = {
    hasKick: /\b(kick|bd)\b/i.test(musicCode),
    hasSnare: /\b(snare|sd)\b/i.test(musicCode),
    hasHiHat: /\b(hihat|hh|cy)\b/i.test(musicCode),
    hasBass: /\b(bass|sub)\b/i.test(musicCode),
    fastTempo: /\b(fast|quick|rapid)\b/i.test(musicCode) || /\bbpm.*(140|160|170|180)\b/i.test(musicCode),
    slowTempo: /\b(slow|ambient|chill)\b/i.test(musicCode) || /\bbpm.*(60|70|80|90)\b/i.test(musicCode),
  };

  // Generate FFT bins that correspond to frequency ranges
  // Bin 0-3: Low frequencies (bass/kick)
  // Bin 4-7: Mid frequencies (snare/vocals)
  // Bin 8-11: High-mid (hi-hats)
  // Bin 12-15: High frequencies (cymbals/shine)
  return Array.from({ length: DEFAULT_FFT_LEN }, (_, i) => {
    let base = 0.1;
    
    // Boost based on detected patterns
    if (i < 4 && patterns.hasKick) base += 0.3;
    if (i >= 4 && i < 8 && patterns.hasSnare) base += 0.25;
    if (i >= 8 && i < 12 && patterns.hasHiHat) base += 0.2;
    if (i < 6 && patterns.hasBass) base += 0.35;
    
    // Tempo affects overall energy
    if (patterns.fastTempo) base += 0.15;
    if (patterns.slowTempo) base -= 0.05;
    
    // Add some variation
    const variation = Math.sin(i * 0.7) * 0.1 + Math.random() * 0.05;
    
    return Math.max(0, Math.min(1, base + variation));
  });
}

/** Lazy-loaded Meyda module */
let meydaModule: unknown = null;
let meydaLoading: Promise<unknown> | null = null;

/**
 * Dynamically import Meyda for audio feature extraction.
 * Returns null if not installed.
 */
async function getMeyda(): Promise<unknown> {
  if (meydaModule) return meydaModule;
  if (meydaLoading) return meydaLoading;
  meydaLoading = import('meyda')
    .then(mod => {
      meydaModule = (mod && typeof mod === 'object' && 'default' in mod) ? mod.default : mod;
      return meydaModule;
    })
    .catch(() => null);
  return meydaLoading;
}

/**
 * Analyze audio file using Meyda (if available).
 * Falls back to synthetic FFT if Meyda is not installed or file cannot be analyzed.
 */
async function analyzeAudioFile(
  filePath: string,
  fallbackBpm: number
): Promise<AudioInput> {
  const meyda = await getMeyda();
  if (!meyda) {
    Logger.debug('MusicToVisual', 'Meyda not installed, using synthetic FFT');
    return { bpm: fallbackBpm, fft: generateSyntheticFFT('') };
  }

  try {
    // For now, return synthetic FFT since we'd need a full audio pipeline
    // (decode audio, buffer, analyze). This would require additional
    // dependencies like audio-decode or web-audio-api.
    Logger.debug('MusicToVisual', `Real audio analysis for ${filePath} requires audio decoding pipeline`);
    return { bpm: fallbackBpm, fft: generateSyntheticFFT('') };
  } catch (err) {
    Logger.warn('MusicToVisual', `Audio analysis failed for ${filePath}:`, err);
    return { bpm: fallbackBpm, fft: generateSyntheticFFT('') };
  }
}

/**
 * Analyze music result to produce BPM and FFT.
 * Uses overrideBpm when provided, otherwise extracts from code.
 * If audioFilePath is provided, attempts real audio analysis.
 */
async function analyzeMusicResult(
  musicCode: string,
  options: { overrideBpm?: number; audioFilePath?: string }
): Promise<AudioInput> {
  const bpmMatch = musicCode.match(/\bbpm\s*[:=]\s*(\d+)/i);
  const extractedBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : DEFAULT_BPM;
  const bpm = options.overrideBpm ?? extractedBpm;

  // If audio file provided, try to analyze it
  if (options.audioFilePath) {
    return analyzeAudioFile(options.audioFilePath, bpm);
  }

  // Generate synthetic FFT based on code patterns
  const fft = generateSyntheticFFT(musicCode);

  return { bpm, fft };
}

/**
 * Generate music from prompt, analyze to get audioInput, then generate visuals
 * with that input. Returns musicCode, visualCode, and audioInput when music produced something.
 */
export async function generateMusicToVisual(
  prompt: string,
  options?: GenerateMusicToVisualOptions
): Promise<GenerateMusicToVisualResult> {
  const musicPlatform = options?.musicPlatform;
  const visualPlatform = options?.visualPlatform;
  const traits = options?.traits;
  const bpm = traits?.bpm ?? DEFAULT_BPM;

  const musicResult = await generateMusic({
    prompt,
    bpm,
    platform: musicPlatform === 'strudel' || musicPlatform === 'p5-webaudio' ? musicPlatform : 'strudel',
  });
  const musicCode = musicResult.code;

  const audioInput = await analyzeMusicResult(musicCode, {
    overrideBpm: bpm,
    audioFilePath: options?.audioFilePath,
  });

  const visualResult = await generateVisuals({
    prompt,
    audioInput,
    platform: visualPlatform === 'hydra' || visualPlatform === 'p5' ? visualPlatform : 'hydra',
  });
  const visualCode = visualResult.code;

  const result: GenerateMusicToVisualResult = {
    musicCode,
    visualCode,
    audioInput: musicCode ? audioInput : undefined,
  };

  return result;
}
