/**
 * HTML Web Generator Plugin
 */

import { HTMLWebGenerator } from '../../src/generators/html/HTMLWebGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: HTMLWebGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new HTMLWebGenerator();
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
    responsive: true,
    includeAnimations: true,
    darkMode: true,
  });
}

export function canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();
  if (/portfolio|landing\s*page|dashboard/.test(lower)) return 0.95;
  if (/\bhtml\b|\bcss\b/.test(lower)) return 0.90;
  if (/web\s*page|website/.test(lower)) return 0.75;
  return 0;
}
