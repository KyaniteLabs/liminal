/**
 * GLSL Shader Generator Plugin
 */

import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: ShaderGenerator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new ShaderGenerator();
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
  if (/ray\s*march|sdf|fragment/.test(lower)) return 0.9;
  if (/shader|glsl/.test(lower)) return 0.7;
  return 0;
}
