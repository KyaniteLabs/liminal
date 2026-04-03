/**
 * Hydra Video Synth Generator Plugin
 */

import { HydraGenerator } from '../../src/generators/hydra/HydraGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: HydraGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new HydraGenerator();
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
  if (/hydra|video\s*synth/.test(lower)) return 0.95;
  if (/kaleid|oscillator.*video/.test(lower)) return 0.7;
  return 0;
}
