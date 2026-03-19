/**
 * IGA - Interactive Genetic Algorithm / variation helpers
 */

import { CreativeEvaluator } from '../core/CreativeEvaluator.js';

/**
 * Generate 5 code variations from a prompt, score each with CreativeEvaluator.getFitness.
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
    generator(prompt),
    generator(prompt),
    generator(prompt),
    generator(prompt),
  ]);
  return codes.map((code) => {
    const { score } = CreativeEvaluator.getFitness(code);
    return { code, fitness: score };
  });
}
