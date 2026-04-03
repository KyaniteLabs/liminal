/**
 * Strudel Music Generator Plugin
 */

import { StrudelGenerator } from '../../src/generators/strudel/StrudelGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: StrudelGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new StrudelGenerator();
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
  if (/\bstrudel\b|\btidal\b/.test(lower)) return 0.95;
  if (/\b(techno|drum|beat|rhythm|sequencer)\b.*\bmusic\b/.test(lower)) return 0.85;
  if (/\bcycle\b|\bnote\b|\bchord\b/.test(lower)) return 0.75;
  return 0;
}
