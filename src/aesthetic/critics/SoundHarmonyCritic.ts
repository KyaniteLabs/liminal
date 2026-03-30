// ---------------------------------------------------------------------------
// SoundHarmonyCritic – static analysis of audio/sound harmony in code
// ---------------------------------------------------------------------------

import type {
  AestheticReport,
  AestheticViolation,
  DesignConstraints,
  SoundConstraints,
} from '../types.js';
import type { LIRCodeToken } from '../../core/lir/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAIN_WARNING_THRESHOLD = 0.8;

/** Consonant intervals in semitones */
const CONSONANT_INTERVALS = new Set([0, 3, 4, 5, 7, 8, 9, 12]);

/** Dissonant intervals in semitones (minor 2nd, tritone, major 7th) */
const DISSONANT_INTERVALS = new Set([1, 6, 11]);

// ---------------------------------------------------------------------------
// Frequency extraction
// ---------------------------------------------------------------------------

function extractFrequencies(code: string): number[] {
  const freqs: number[] = [];

  // Match .frequency.value = N or .frequency = N
  const freqValueRe = /\.frequency(?:\.value)?\s*=\s*([\d.]+)/g;
  for (const m of code.matchAll(freqValueRe)) {
    const val = parseFloat(m[1]);
    if (val > 0 && val < 20000) freqs.push(val);
  }

  // Match setFrequency(N) or setTargetAtTime(N, ...)
  const freqMethodRe = /(?:setFrequency|frequency\.setTargetAtTime)\s*\(\s*([\d.]+)/g;
  for (const m of code.matchAll(freqMethodRe)) {
    const val = parseFloat(m[1]);
    if (val > 0 && val < 20000) freqs.push(val);
  }

  return freqs;
}

// ---------------------------------------------------------------------------
// Gain extraction
// ---------------------------------------------------------------------------

function extractGainValues(code: string): number[] {
  const gains: number[] = [];

  // .gain.value = N or .gain = N
  const gainRe = /\.gain(?:\.value)?\s*=\s*([\d.]+)/g;
  for (const m of code.matchAll(gainRe)) {
    gains.push(parseFloat(m[1]));
  }

  return gains;
}

// ---------------------------------------------------------------------------
// Frequency → MIDI note
// ---------------------------------------------------------------------------

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

// ---------------------------------------------------------------------------
// Interval calculation
// ---------------------------------------------------------------------------

function getSemitoneInterval(midiA: number, midiB: number): number {
  const semitones = Math.abs(Math.round(midiA) - Math.round(midiB));
  // Fold into single octave (0-12)
  return semitones % 12;
}

// ---------------------------------------------------------------------------
// Harmony analysis
// ---------------------------------------------------------------------------

interface HarmonyResult {
  consonantRatio: number;
  dissonantIntervals: number[];
}

function analyzeHarmony(frequencies: number[]): HarmonyResult {
  if (frequencies.length < 2) {
    return { consonantRatio: 1.0, dissonantIntervals: [] };
  }

  const midiNotes = frequencies.map(freqToMidi);
  let totalPairs = 0;
  let consonantPairs = 0;
  const dissonantIntervals: number[] = [];

  for (let i = 0; i < midiNotes.length; i++) {
    for (let j = i + 1; j < midiNotes.length; j++) {
      const interval = getSemitoneInterval(midiNotes[i], midiNotes[j]);
      totalPairs++;
      if (CONSONANT_INTERVALS.has(interval)) {
        consonantPairs++;
      }
      if (DISSONANT_INTERVALS.has(interval)) {
        dissonantIntervals.push(interval);
      }
    }
  }

  const consonantRatio = totalPairs > 0 ? consonantPairs / totalPairs : 1.0;
  return { consonantRatio, dissonantIntervals };
}

// ---------------------------------------------------------------------------
// Has audio content detection
// ---------------------------------------------------------------------------

function hasAudioContent(code: string): boolean {
  return (
    /\.frequency/.test(code) ||
    /\.gain/.test(code) ||
    /OscillatorNode|AudioContext|oscillator/i.test(code) ||
    /createOscillator|createGain/i.test(code)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeSoundHarmony(
  code: string,
  constraints: DesignConstraints,
): AestheticReport {
  const violations: AestheticViolation[] = [];
  const soundConstraints: SoundConstraints = constraints.sound;

  // 1. No audio content → neutral
  if (!hasAudioContent(code)) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  // 2. Extract frequencies and analyze harmony
  const frequencies = extractFrequencies(code);
  const { consonantRatio, dissonantIntervals } = analyzeHarmony(frequencies);

  // 3. Check for dissonance violations
  if (dissonantIntervals.length > 0 && consonantRatio < (1 - soundConstraints.maxDissonance)) {
    violations.push({
      rule: 'dissonance',
      severity: 'warning',
      message: `Dissonant interval(s) detected: ${dissonantIntervals.map(i => `${i} semitones`).join(', ')}`,
    });
  }

  // 4. Check gain levels
  const gains = extractGainValues(code);
  for (const gain of gains) {
    if (gain > GAIN_WARNING_THRESHOLD) {
      violations.push({
        rule: 'excessive-gain',
        severity: 'warning',
        message: `Gain value ${gain} exceeds safe threshold of ${GAIN_WARNING_THRESHOLD}`,
      });
    }
  }

  // 5. Compute score
  let score = 0.5;

  // Harmony contribution
  if (frequencies.length >= 2) {
    score = consonantRatio;
  } else if (frequencies.length === 1) {
    score = 0.8; // single note is fine
  }

  // Penalty for gain violations
  if (gains.some(g => g > GAIN_WARNING_THRESHOLD)) {
    score -= 0.15;
  }

  score = Math.max(0, Math.min(1, score));

  const passed =
    violations.every(v => v.severity !== 'error') &&
    score >= constraints.general.minAestheticScore;

  return {
    score: Math.round(score * 1000) / 1000,
    violations,
    passed,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// LIR-aware sound harmony analysis
// ---------------------------------------------------------------------------

/** Audio-related API patterns to look for in LIR token relationships */
const AUDIO_API_PATTERNS = ['OscillatorNode', 'AudioContext', 'createOscillator', 'createGain'];

/**
 * Analyze sound harmony using LIR tokens instead of regex.
 *
 * Uses relationships.imports and relationships.calls to detect audio API usage,
 * then extracts frequency/gain values from token source for harmony analysis.
 */
export function analyzeSoundHarmonyLIR(
  tokens: LIRCodeToken[],
  constraints: DesignConstraints,
): AestheticReport {
  const violations: AestheticViolation[] = [];
  const soundConstraints: SoundConstraints = constraints.sound;

  // 1. Check for audio content via LIR relationships
  const audioTokens = tokens.filter(t => {
    const hasAudioCalls = t.relationships.calls.some(c =>
      AUDIO_API_PATTERNS.some(p => c.includes(p)),
    );
    const hasAudioImports = t.relationships.imports.some(imp =>
      /audio|sound|oscillator|tone/i.test(imp),
    );
    const hasFreqInSource = /\.frequency/.test(t.source) || /\.gain/.test(t.source);
    return hasAudioCalls || hasAudioImports || hasFreqInSource;
  });

  if (audioTokens.length === 0) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  // 2. Extract frequencies from audio token sources
  const combinedSource = audioTokens.map(t => t.source).join('\n');
  const frequencies = extractFrequencies(combinedSource);
  const { consonantRatio, dissonantIntervals } = analyzeHarmony(frequencies);

  // 3. Check dissonance
  if (dissonantIntervals.length > 0 && consonantRatio < (1 - soundConstraints.maxDissonance)) {
    violations.push({
      rule: 'dissonance',
      severity: 'warning',
      message: `Dissonant interval(s) detected: ${dissonantIntervals.map(i => `${i} semitones`).join(', ')}`,
    });
  }

  // 4. Check gain levels
  const gains = extractGainValues(combinedSource);
  for (const gain of gains) {
    if (gain > GAIN_WARNING_THRESHOLD) {
      violations.push({
        rule: 'excessive-gain',
        severity: 'warning',
        message: `Gain value ${gain} exceeds safe threshold of ${GAIN_WARNING_THRESHOLD}`,
      });
    }
  }

  // 5. Compute score
  let score = 0.5;
  if (frequencies.length >= 2) {
    score = consonantRatio;
  } else if (frequencies.length === 1) {
    score = 0.8;
  }

  // LIR bonus: use importGraph to verify audio chain completeness
  const audioChainComplete = audioTokens.some(t =>
    t.relationships.importGraph.some(ig =>
      /audio|sound|oscillator/i.test(ig.module),
    ),
  );
  if (audioChainComplete) score += 0.05;

  if (gains.some(g => g > GAIN_WARNING_THRESHOLD)) score -= 0.15;

  score = Math.max(0, Math.min(1, score));

  const passed =
    violations.every(v => v.severity !== 'error') &&
    score >= constraints.general.minAestheticScore;

  return {
    score: Math.round(score * 1000) / 1000,
    violations,
    passed,
    timestamp: Date.now(),
  };
}