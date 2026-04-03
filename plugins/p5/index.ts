/**
 * P5.js Generator Plugin
 *
 * Converts creative coding prompts into p5.js JavaScript code.
 */

import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

// Internal generator instance
let generator: P5GeneratorV2 | null = null;

/**
 * Initialize the plugin (called once on load)
 */
export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new P5GeneratorV2();
  }
}

/**
 * Generate p5.js code from a prompt
 */
export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  if (!generator) {
    await initialize();
  }

  return generator!.generate(prompt, {
    signal: options.signal,
    bypassCache: options.bypassCache,
  });
}

/**
 * Check if this plugin can handle the prompt
 * Returns confidence score 0-1
 */
export function canHandle(prompt: string): number {
  const lower = prompt.toLowerCase();

  // High confidence for explicit p5 mentions
  if (/\bp5\b|p5\.js|processing/i.test(lower)) return 0.95;

  // Medium confidence for canvas/visual keywords
  if (/\b(canvas|animation|sketch|creative coding)\b/i.test(lower)) return 0.7;

  // Low confidence for shape/color keywords (could be other domains)
  if (/\b(circle|ellipse|rect|particles)\b/i.test(lower)) return 0.4;

  // Default fallback
  return 0.1;
}
