/**
 * Remotion Video Generator Plugin
 */

import { RemotionGenerator } from '../../src/generators/remotion/RemotionGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: RemotionGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new RemotionGenerator();
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
  return new RemotionGenerator().canHandle(prompt);
}
