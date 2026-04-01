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
import { ShaderGenerator } from './glsl/ShaderGenerator.js';
import { ThreeGenerator } from './three/ThreeGenerator.js';
import { RemotionGenerator } from './remotion/RemotionGenerator.js';
import { P5GeneratorV2 } from './p5/P5GeneratorV2.js';
import { HTMLWebGenerator } from './html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from './ascii/ASCIIArtGenerator.js';
import { StrudelGenerator } from './strudel/StrudelGenerator.js';
import { HydraGenerator } from './hydra/HydraGenerator.js';
import { ToneGenerator } from './tone/ToneGenerator.js';

// --- Shared canHandle helpers ---

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
  // High confidence for explicit three.js mentions
  if (/three\.js|threejs|\bthree\b/.test(lower)) return 0.95;
  // Strong confidence for 3D with specific keywords
  if (/\b3d\b.*\b(scene|cube|sphere|model|mesh|geometry|import|webgl|camera|light|rotation)/.test(lower)) return 0.90;
  // Moderate for generic 3D
  if (/\b3d\b|webgl/.test(lower)) return 0.75;
  return 0;
};

/** Confidence for HTML/web patterns */
const htmlConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // Portfolio, landing page, dashboard are specific -> higher confidence
  if (/portfolio|landing\s*page|dashboard|web\s*app/.test(lower)) return 0.95;
  // Explicit HTML/CSS mentions
  if (/\bhtml\b|\bcss\b|\bweb\s+(component|page|widget)/.test(lower)) return 0.90;
  if (/web\s*page|website|css\s*design/.test(lower)) return 0.75;
  if (/web\s*dev|ui\s*component|form|spa/.test(lower)) return 0.65;
  return 0;
};

/** Confidence for ASCII art patterns */
const asciiConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // Explicit ASCII art mentions
  if (/\bascii\s*art\b/.test(lower)) return 0.95;
  if (/\bascii\b/.test(lower)) return 0.90;
  // Character/text art patterns
  if (/text\s*art|character\s*art|glyph|symbol.*art/.test(lower)) return 0.75;
  if (/\bart\b.*\btext\b|\btext\b.*\bpattern/.test(lower)) return 0.65;
  return 0;
};

/** Confidence for Strudel music patterns */
const strudelConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // Explicit Strudel/Tidal mentions
  if (/\bstrudel\b|\btidal\b|live\s*coding\s*music/.test(lower)) return 0.95;
  // Strong pattern-based music indicators
  if (/\b(techno|drum|beat|rhythm|sequencer|pattern)\b.*\bmusic\b/.test(lower)) return 0.85;
  if (/\bcycle\b|\bnote\b|\bchord\b|\bmelody\b.*\bsequence/.test(lower)) return 0.75;
  // Moderate music pattern matches
  if (/pattern|beat|drum|bass|synth.*sequence/.test(lower)) return 0.65;
  return 0;
};

/** Confidence for Hydra video synth patterns */
const hydraConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/hydra|video\s*synth|visual\s*synthesis/.test(lower)) return 0.95;
  if (/kaleid|oscillator|modulate.*video/.test(lower)) return 0.7;
  return 0;
};

/** Confidence for Tone.js audio synthesis */
const toneConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // Explicit Tone.js mentions
  if (/\btone\.?js\b|\btonejs\b|web\s*audio\s*api/.test(lower)) return 0.95;
  // Strong synthesis indicators
  if (/\bsynth\b|\bsynthesizer\b.*\bjs\b/.test(lower)) return 0.90;
  // Audio effect indicators
  if (/\bbass\b|\bdrone\b|\barp\b|\bsequencer\b|\bdelay\b|\breverb\b/.test(lower)) return 0.80;
  // Generic synthesis
  if (/synth|synthesizer/.test(lower)) return 0.70;
  return 0;
};

// --- Generator entries ---



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

const htmlEntry: GeneratorEntry = {
  name: 'html',
  canHandle: htmlConfidence,
  generate: async (prompt: string) => {
    const gen = new HTMLWebGenerator();
    return gen.generate(prompt, {
      responsive: true,
      includeAnimations: true,
      darkMode: true
    });
  },
};

const asciiEntry: GeneratorEntry = {
  name: 'ascii',
  canHandle: asciiConfidence,
  generate: async (prompt: string) => {
    const gen = new ASCIIArtGenerator();
    return gen.generate(prompt, {
      style: 'abstract',
      width: 60,
      height: 30
    });
  },
};

const strudelEntry: GeneratorEntry = {
  name: 'strudel',
  canHandle: strudelConfidence,
  generate: async (prompt: string) => {
    const gen = new StrudelGenerator();
    return gen.generate(prompt);
  },
};

const hydraEntry: GeneratorEntry = {
  name: 'hydra',
  canHandle: hydraConfidence,
  generate: async (prompt: string) => {
    const gen = new HydraGenerator();
    return gen.generate(prompt);
  },
};

const toneEntry: GeneratorEntry = {
  name: 'tone',
  canHandle: toneConfidence,
  generate: async (prompt: string) => {
    const gen = new ToneGenerator();
    return gen.generate(prompt);
  },
};

const p5Entry: GeneratorEntry = {
  name: 'p5',
  canHandle: () => 0.1, // fallback: low confidence but always available
  generate: async (prompt: string) => {
    const gen = new P5GeneratorV2();
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

  // NOTE: Template-based generators removed. All p5 generation goes through LLM.
  // Domain-specific generators for non-p5 domains
  generatorRegistry.register(shaderEntry);
  generatorRegistry.register(threeEntry);
  generatorRegistry.register(remotionEntry);
  generatorRegistry.register(htmlEntry);
  generatorRegistry.register(asciiEntry);
  generatorRegistry.register(strudelEntry);
  generatorRegistry.register(hydraEntry);
  generatorRegistry.register(toneEntry);
  
  // P5 generator with tier-based prompting (fallback for all p5 sketches)
  generatorRegistry.register(p5Entry);
}

// Re-export for convenience
export {
  shaderConfidence,
  threeConfidence,
  htmlConfidence,
  asciiConfidence,
  strudelConfidence,
  hydraConfidence,
  toneConfidence,
};
