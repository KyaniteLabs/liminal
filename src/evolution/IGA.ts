/**
 * IGA - Interactive Genetic Algorithm / variation helpers
 */

import { CreativeEvaluator } from '../core/CreativeEvaluator.js';

/**
 * Generate 5 code variations from a prompt, score each with CreativeEvaluator.assess.
 * @param prompt - The creative prompt
 * @param generator - Async function that generates code from a prompt
 * @returns Array of { code, fitness } of length 5
 */
export async function generateFiveVariations(
  prompt: string,
  generator: (p: string) => Promise<string>
): Promise<{ code: string; fitness: number }[]> {
  const codes = await Promise.all([
    generator(prompt),
    generator(prompt + ' — variation 2'),
    generator(prompt + ' — variation 3'),
    generator(prompt + ' — variation 4'),
    generator(prompt + ' — variation 5'),
  ]);
  return codes.map((code) => {
    const result = CreativeEvaluator.assess(code);
    return { code, fitness: result.score };
  });
}
