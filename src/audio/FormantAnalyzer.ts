/**
 * FormantAnalyzer — estimates vocal formants from audio features.
 *
 * Uses MFCC coefficients as lightweight formant proxies:
 * - F1 (openness): lower F1 = closed vowel, higher F1 = open vowel
 * - F2 (frontness): higher F2 = front vowel, lower F2 = back vowel
 *
 * Maps formant space to geometry parameters:
 * - openness → shape height
 * - frontness → shape taper
 *
 * Inspired by voice-to-sculpture-app analysis.worker.ts.
 */

export interface FormantData {
  /** First formant frequency estimate in Hz (openness) */
  f1: number;
  /** Second formant frequency estimate in Hz (frontness) */
  f2: number;
  /** Normalized openness (0=closed like /i/, 1=open like /a/) */
  openness: number;
  /** Normalized frontness (0=back like /u/, 1=front like /i/) */
  frontness: number;
  /** Detected phoneme category */
  phonemeCategory: PhonemeCategory;
}

export type PhonemeCategory = 'open-front' | 'open-back' | 'closed-front' | 'closed-back' | 'neutral';

/** Approximate F1 range for speech (Hz) */
const F1_MIN = 200;
const F1_MAX = 1000;

/** Approximate F2 range for speech (Hz) */
const F2_MIN = 600;
const F2_MAX = 2800;

/**
 * Estimate formant frequencies from MFCC coefficients.
 *
 * This is a heuristic approach using MFCC spectral shape:
 * - Lower-index MFCCs capture spectral envelope shape
 * - F1 correlates with overall spectral tilt (captured by MFCC 1-2)
 * - F2 correlates with spectral peak position (captured by MFCC 3-5)
 *
 * For accurate formant tracking, use a dedicated LPC/autocorrelation
 * formant tracker. This is a fast approximation for real-time use.
 */
export function estimateFormants(mfcc: number[]): FormantData {
  // Default if insufficient MFCC data
  if (!mfcc || mfcc.length < 6) {
    return {
      f1: 500,
      f2: 1500,
      openness: 0.5,
      frontness: 0.5,
      phonemeCategory: 'neutral',
    };
  }

  // Estimate F1 from lower MFCCs (spectral tilt)
  // Higher MFCC[1] → more low-frequency energy → lower F1 (closed vowel)
  // Lower MFCC[1] → less low-frequency energy → higher F1 (open vowel)
  const mfcc1 = mfcc[1] ?? 0;
  const f1Estimate = F1_MIN + (1 - normalizeMfcc(mfcc1)) * (F1_MAX - F1_MIN);

  // Estimate F2 from mid MFCCs (spectral peak position)
  const mfcc3 = mfcc[3] ?? 0;
  const mfcc4 = mfcc[4] ?? 0;
  const mfcc5 = mfcc[5] ?? 0;
  const f2Estimate = F2_MIN + normalizeMfcc(mfcc3 + mfcc4 * 0.5 + mfcc5 * 0.3) * (F2_MAX - F2_MIN);

  // Normalize to 0-1 range
  const openness = clamp01((f1Estimate - F1_MIN) / (F1_MAX - F1_MIN));
  const frontness = clamp01((f2Estimate - F2_MIN) / (F2_MAX - F2_MIN));

  // Classify phoneme category
  const phonemeCategory = classifyPhoneme(openness, frontness);

  return {
    f1: f1Estimate,
    f2: f2Estimate,
    openness,
    frontness,
    phonemeCategory,
  };
}

/**
 * Map formant data to geometry parameters.
 *
 * @param formants - Estimated formant data
 * @returns Shape modulation parameters
 */
export function formantsToGeometry(formants: FormantData): {
  /** Height multiplier: open vowels = taller shapes */
  heightMultiplier: number;
  /** Taper ratio: front vowels = more tapered */
  taperRatio: number;
  /** Roundness: back vowels = rounder, front = sharper */
  roundness: number;
} {
  return {
    heightMultiplier: 0.5 + formants.openness * 1.5,     // 0.5 to 2.0
    taperRatio: 0.3 + formants.frontness * 0.7,           // 0.3 to 1.0
    roundness: 0.2 + (1 - formants.frontness) * 0.8,      // 0.2 to 1.0
  };
}

/**
 * Classify formant space into a phoneme category.
 */
function classifyPhoneme(openness: number, frontness: number): PhonemeCategory {
  const isOpen = openness > 0.5;
  const isFront = frontness > 0.5;

  if (isOpen && isFront) return 'open-front';       // /a/-like
  if (isOpen && !isFront) return 'open-back';        // /ɒ/-like
  if (!isOpen && isFront) return 'closed-front';     // /i/-like
  if (!isOpen && !isFront) return 'closed-back';     // /u/-like
  return 'neutral';
}

function normalizeMfcc(value: number): number {
  // MFCC values are roughly in [-10, 10] range for speech
  return clamp01((value + 10) / 20);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
