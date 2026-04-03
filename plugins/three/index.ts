/**
 * Three.js Generator Plugin
 */

import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: ThreeGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new ThreeGenerator();
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
  if (/three\.js|threejs|\bthree\b/.test(lower)) return 0.95;
  if (/\b3d\b.*\b(scene|cube|sphere|model|mesh)/.test(lower)) return 0.90;
  if (/\b3d\b|webgl/.test(lower)) return 0.75;
  return 0;
}
