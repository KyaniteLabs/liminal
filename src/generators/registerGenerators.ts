/**
 * registerGenerators - Registers all generators with the GeneratorRegistry.
 *
 * Each generator declares what it can handle via canHandle(prompt) -> confidence (0-1).
 * Confidence values are ordered by specificity to avoid ambiguity:
 *   - 0.9: highly specific patterns (lenia, ray march, sdf, fragment)
 *   - 0.7: moderately specific patterns (particle, galaxy, cellular, automata, flow field, glsl, shader)
 *   - 0.5: broader patterns (3d, three.js, three)
 *   - 0.0: LLM fallback (always available, never wins against specialized generators)
 *
 * Keyword-based routing is centralized here so RalphLoop and P5Generator
 * use the same dispatch logic.
 */

import { generatorRegistry, GeneratorEntry } from './GeneratorRegistry.js';
import { ParticleSystem } from './p5/ParticleSystem.js';
import { CellularAutomata } from './p5/CellularAutomata.js';
import { FlowField } from './p5/FlowField.js';
import { ShaderGenerator } from './glsl/ShaderGenerator.js';
import { ThreeGenerator } from './three/ThreeGenerator.js';
import { RemotionGenerator } from './remotion/RemotionGenerator.js';
import { P5GeneratorLLM } from './p5/P5GeneratorLLM.js';
import { promptToGeneratorParams } from '../utils/promptToGeneratorParams.js';

// --- Shared canHandle helpers ---

/** Confidence for particle/galaxy patterns */
const particleConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/particle|galaxy/.test(lower)) return 0.7;
  return 0;
};

/** Confidence for cellular/automata/lenia patterns */
const cellularConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // lenia is more specific than generic "cellular" -> higher confidence
  if (/lenia/.test(lower)) return 0.9;
  if (/cellular|automata/.test(lower)) return 0.7;
  return 0;
};

/** Confidence for flow field patterns */
const flowFieldConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/flow\s*field|flow\s*particle|particles?\s+flow/.test(lower)) return 0.7;
  return 0;
};

/** Confidence for shader/glsl patterns */
const shaderConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // ray march, sdf, fragment are very specific -> higher confidence
  if (/ray\s*march|sdf|fragment/.test(lower)) return 0.9;
  if (/shader|glsl/.test(lower)) return 0.7;
  return 0;
};

/** Confidence for 3D/Three.js patterns */
const threeConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/3d|three\.js|\bthree\b|webgl\s*3d|3d\s*scene|3d\s*particle/.test(lower)) return 0.5;
  return 0;
};

// --- Generator entries ---

const particleEntry: GeneratorEntry = {
  name: 'particle',
  canHandle: particleConfidence,
  generate: (prompt: string, params?: Record<string, unknown>) => {
    const derived = promptToGeneratorParams(prompt);
    const lower = prompt.toLowerCase();
    const merged: Record<string, unknown> = { ...derived, ...params };
    if (/blue/.test(lower)) merged.palette = 'cool';
    if (/warm|red|orange/.test(lower)) merged.palette = 'warm';
    return ParticleSystem.generate(merged);
  },
};

const cellularEntry: GeneratorEntry = {
  name: 'cellular',
  canHandle: cellularConfidence,
  generate: (prompt: string, _params?: Record<string, unknown>) => {
    const derived = promptToGeneratorParams(prompt);
    return CellularAutomata.generate(derived);
  },
};

const flowFieldEntry: GeneratorEntry = {
  name: 'flowfield',
  canHandle: flowFieldConfidence,
  generate: (prompt: string, params?: Record<string, unknown>) => {
    const derived = promptToGeneratorParams(prompt);
    const lower = prompt.toLowerCase();
    const merged: Record<string, unknown> = { ...derived, ...params };
    if (/blue/.test(lower)) merged.palette = 'cool';
    if (/warm|red|orange/.test(lower)) merged.palette = 'warm';
    return FlowField.generate(merged);
  },
};

const shaderEntry: GeneratorEntry = {
  name: 'shader',
  canHandle: shaderConfidence,
  generate: async (prompt: string) => {
    const gen = new ShaderGenerator();
    return gen.generate(prompt);
  },
};

const threeEntry: GeneratorEntry = {
  name: 'three',
  canHandle: threeConfidence,
  generate: async (prompt: string) => {
    const gen = new ThreeGenerator();
    return gen.generate(prompt);
  },
};

const remotionEntry: GeneratorEntry = {
  name: 'remotion',
  canHandle: (prompt: string) => {
    const gen = new RemotionGenerator();
    return gen.canHandle(prompt);
  },
  generate: async (prompt: string) => {
    const gen = new RemotionGenerator();
    return gen.generate(prompt);
  },
};

const llmEntry: GeneratorEntry = {
  name: 'llm',
  canHandle: () => 0, // fallback: never wins, but always available
  generate: async (prompt: string) => {
    const gen = new P5GeneratorLLM();
    return gen.generate(prompt);
  },
};

/**
 * Register all generators with the singleton registry.
 * Call once at application startup.
 */
export function registerAllGenerators(): void {
  // Only register if not already registered (idempotent)
  if (generatorRegistry.getAll().length > 0) return;

  generatorRegistry.register(particleEntry);
  generatorRegistry.register(cellularEntry);
  generatorRegistry.register(flowFieldEntry);
  generatorRegistry.register(shaderEntry);
  generatorRegistry.register(threeEntry);
  generatorRegistry.register(remotionEntry);
  generatorRegistry.register(llmEntry);
}

// Re-export for convenience
export {
  particleConfidence,
  cellularConfidence,
  flowFieldConfidence,
  shaderConfidence,
  threeConfidence,
};
