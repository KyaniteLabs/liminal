/**
 * ASCII Art Generator Plugin
 */

import { ASCIIArtGenerator } from '../../src/generators/ascii/ASCIIArtGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: ASCIIArtGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new ASCIIArtGenerator();
  }
}

export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  if (!generator) {
    await initialize();
  }
  return generator!.generate(prompt, {
    style: 'abstract',
    width: 60,
    height: 30,
  });
}

export function canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (/\bascii\s*art\b/.test(lower)) return 0.95;
  if (/\bascii\b/.test(lower)) return 0.90;
  if (/text\s*art|character\s*art/.test(lower)) return 0.75;
  return 0;
}
