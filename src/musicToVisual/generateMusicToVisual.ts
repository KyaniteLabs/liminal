/**
 * Music-to-visual bridge: run generateMusic, analyze result (BPM/FFT placeholder),
 * pass audioInput to generateVisuals, return combined result.
 */

import { generateMusic } from '../music/generateMusic.js';
import { generateVisuals } from '../generateVisuals.js';

export interface GenerateMusicToVisualOptions {
  musicPlatform?: string;
  visualPlatform?: string;
  /** Optional traits (bpm, palette) passed to music/visual generators */
  traits?: { bpm?: number; palette?: string };
}

export interface AudioInput {
  bpm: number;
  fft: number[];
}

export interface GenerateMusicToVisualResult {
  musicCode: string;
  visualCode: string;
  audioInput?: AudioInput;
}

const DEFAULT_BPM = 120;
const DEFAULT_FFT_LEN = 16;
const DEFAULT_FFT = Array.from({ length: DEFAULT_FFT_LEN }, (_, i) =>
  Math.round((0.1 + 0.1 * Math.sin(i)) * 100) / 100
);

/**
 * Analyze music result to produce BPM and FFT-like placeholder.
 * Uses overrideBpm when provided (e.g. from traits), otherwise extracts from code.
 */
function analyzeMusicResult(musicCode: string, overrideBpm?: number): AudioInput {
  if (overrideBpm != null && overrideBpm > 0) {
    return { bpm: overrideBpm, fft: [...DEFAULT_FFT] };
  }
  const bpmMatch = musicCode.match(/\bbpm\s*[:=]\s*(\d+)/i);
  const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : DEFAULT_BPM;
  return { bpm, fft: [...DEFAULT_FFT] };
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

  const audioInput = analyzeMusicResult(musicCode, bpm);

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
