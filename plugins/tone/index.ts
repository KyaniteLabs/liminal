/**
 * Tone.js Audio Generator Plugin
 */

import { ToneGenerator } from '../../src/generators/tone/ToneGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: ToneGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new ToneGenerator();
  }
}

export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  if (!generator) {
    await initialize();
  }
  return generator!.generate(prompt);
}

export function canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (/\btone\.?js\b|\btonejs\b/.test(lower)) return 0.95;
  if (/\bsynth\b|\bsynthesizer\b.*\bjs\b/.test(lower)) return 0.90;
  if (/\bbass\b|\bdrone\b|\barp\b|\bsequencer\b/.test(lower)) return 0.80;
  if (/synth|synthesizer/.test(lower)) return 0.70;
  return 0;
}
