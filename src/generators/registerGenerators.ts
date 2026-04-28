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
import { RevideoGenerator } from './revideo/RevideoGenerator.js';
import { HyperFramesGenerator } from './hyperframes/HyperFramesGenerator.js';
import { P5GeneratorV2 } from './p5/P5GeneratorV2.js';
import { HTMLWebGenerator } from './html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from './ascii/ASCIIArtGenerator.js';
import { StrudelGenerator } from './strudel/StrudelGenerator.js';
import { HydraGenerator } from './hydra/HydraGenerator.js';
import { ToneGenerator } from './tone/ToneGenerator.js';
import { TextGenerativeGenerator } from './textgen/TextGenerativeGenerator.js';
import { SVGGenerator } from './svg/SVGGenerator.js';
import { pluginLoader } from '../plugins/PluginLoader.js';
import { Logger } from '../utils/Logger.js';

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
  if (/\b3d\b.*\b(scene|cube|sphere|model|mesh|geometry|import|webgl|camera|light|rotation|composition|depth)/.test(lower)) return 0.90;
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

/** Confidence for SVG/vector asset patterns */
const svgConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/\bsvg\b|scalable\s+vector|vector\s+(logo|icon|diagram|art|asset)/.test(lower)) return 0.95;
  if (/\b(logo|icon|diagram|flowchart|laser|cutfile|cut\s*file|cnc|toolpath|sticker|decal)\b/.test(lower)) return 0.85;
  if (/\bvector\b|\billustration\b.*\bpaths?\b/.test(lower)) return 0.75;
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

/**
 * Confidence for text generative art (concrete poetry, word art, etc.)
 * 
 * HIGHER confidence than ASCII for creative text prompts to ensure
 * textgen wins over ascii for poetry/word-art requests.
 */
const textgenConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  // Explicit text generative mentions (highest priority)
  if (/\bconcrete\s+poetry\b|\bword\s+art\b|\btypographic\s+art\b/.test(lower)) return 0.95;
  if (/\btext\s+generative\b|\bexperimental\s+poetry\b/.test(lower)) return 0.95;
  
  // Strong creative text patterns
  if (/\bpoem\b|\bpoetry\b.*\b(visual|shape|form)\b/.test(lower)) return 0.90;
  if (/\bwords\b.*\b(arranged|scattered|cascade|flow|drip)\b/.test(lower)) return 0.90;
  if (/\btypography\b.*\b(experimental|creative|art)\b/.test(lower)) return 0.85;
  
  // Moderate creative text patterns
  if (/\btext\s+(only|based)\s+(art|composition)\b/.test(lower)) return 0.80;
  if (/\bletters?\b.*\b(form|shape|pattern)\b/.test(lower)) return 0.75;
  
  // Avoid capturing pure ASCII requests (let ascii generator handle those)
  if (/\bascii\b/.test(lower)) return 0;
  
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
  if (/\bglsl\b|\bfragment\s+shader\b|\bshader\b/.test(lower)) return 0;
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
  if (/\bsynth\b|\bsynthesizer\b/.test(lower)) return 0.70;
  return 0;
};

/** Confidence for explicit p5.js / Processing-style sketch requests */
const p5Confidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/\bp5(?:\.js)?\b|\bp5js\b|\bprocessing\b/.test(lower)) return 0.95;
  if (/\b(createcanvas|setup\(\)|draw\(\)|mousepressed|keypressed)\b/.test(lower)) return 0.9;
  if (/\b(sketch|canvas)\b.*\b(generative|interactive|animated|art)\b/.test(lower)) return 0.75;
  if (/\bgenerative\s+sketch\b|\binteractive\s+sketch\b/.test(lower)) return 0.75;
  return 0;
};

/** Confidence for HyperFrames asset compositing patterns */
const hyperframesConfidence = (prompt: string): number => {
  const lower = prompt.toLowerCase();
  if (/\b(?:do not|don't|dont|never|avoid)\s+(?:use\s+)?hyperframes?\b/.test(lower)) return 0;
  if (/\bhyperframes?\b/.test(lower)) return 0.95;
  if (/\b(promo|trailer|slideshow|presentation|title\s*card|subtitle|caption|social\s*media)\b/.test(lower)) return 0.90;
  if (/\b(composite|compose|assemble|overlay|watermark|intro|outro)\b/.test(lower)) return 0.85;
  if (/\b(video|animation)\b/.test(lower) && /\b(images?|clips?|audio|music|narration)\b/.test(lower)) return 0.80;
  return 0;
};

// --- Generator entries ---



const shaderEntry: GeneratorEntry = {
  name: 'shader',
  canHandle: shaderConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new ShaderGenerator();
    return gen.generate(prompt, params);
  },
};

const threeEntry: GeneratorEntry = {
  name: 'three',
  canHandle: threeConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new ThreeGenerator();
    return gen.generate(prompt, params);
  },
};

const revideoEntry: GeneratorEntry = {
  name: 'revideo',
  canHandle: (prompt: string) => {
    const gen = new RevideoGenerator();
    return gen.canHandle(prompt);
  },
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new RevideoGenerator();
    return gen.generate(prompt, params);
  },
};

const hyperframesEntry: GeneratorEntry = {
  name: 'hyperframes',
  canHandle: hyperframesConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new HyperFramesGenerator();
    return gen.generate(prompt, params);
  },
};

const htmlEntry: GeneratorEntry = {
  name: 'html',
  canHandle: htmlConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new HTMLWebGenerator();
    return gen.generate(prompt, {
      responsive: true,
      includeAnimations: true,
      darkMode: true,
      ...params,
    });
  },
};

const svgEntry: GeneratorEntry = {
  name: 'svg',
  canHandle: svgConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new SVGGenerator();
    return gen.generate(prompt, params);
  },
};

const asciiEntry: GeneratorEntry = {
  name: 'ascii',
  canHandle: asciiConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new ASCIIArtGenerator();
    return gen.generate(prompt, {
      style: 'abstract',
      width: 60,
      height: 12,
      ...params,
    });
  },
};

const strudelEntry: GeneratorEntry = {
  name: 'strudel',
  canHandle: strudelConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new StrudelGenerator();
    return gen.generate(prompt, params);
  },
};

const hydraEntry: GeneratorEntry = {
  name: 'hydra',
  canHandle: hydraConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new HydraGenerator();
    return gen.generate(prompt, params);
  },
};

const toneEntry: GeneratorEntry = {
  name: 'tone',
  canHandle: toneConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new ToneGenerator();
    return gen.generate(prompt, params);
  },
};

/**
 * Text Generative Art entry
 * 
 * Handles concrete poetry, word art, experimental typography.
 * Optimized for small/fast models due to low token count.
 */
const textgenEntry: GeneratorEntry = {
  name: 'textgen',
  canHandle: textgenConfidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new TextGenerativeGenerator();
    return gen.generate(prompt, {
      form: 'freeform',
      style: 'minimal',
      maxLines: 30,
      maxWidth: 60,
      unicode: true,
      ...params,
    });
  },
};

const p5Entry: GeneratorEntry = {
  name: 'p5',
  canHandle: p5Confidence,
  generate: async (prompt: string, params?: Record<string, unknown>) => {
    const gen = new P5GeneratorV2();
    return gen.generate(prompt, params);
  },
};

let pluginsLoaded = false;

/**
 * Try to load plugins from plugins/ directory
 */
async function loadPlugins(): Promise<boolean> {
  try {
    const results = await pluginLoader.loadAll();
    
    // Register loaded plugins with GeneratorRegistry
    for (const plugin of pluginLoader.getAllPlugins()) {
      generatorRegistry.register({
        name: plugin.manifest.id,
        canHandle: plugin.canHandle || (() => 0.1),
        generate: plugin.generate.bind(plugin),
      });
    }
    
    return results.some(r => r.success);
  } catch (error) {
    Logger.warn('registerGenerators', 'Failed to load plugins:', error);
    return false;
  }
}

/**
 * Register static generators as fallback
 */
function registerStaticGenerators(): void {
  // Domain-specific generators for non-p5 domains
  generatorRegistry.register(shaderEntry);
  generatorRegistry.register(threeEntry);
  generatorRegistry.register(revideoEntry);
  generatorRegistry.register(hyperframesEntry);
  generatorRegistry.register(svgEntry);
  generatorRegistry.register(htmlEntry);
  generatorRegistry.register(asciiEntry);
  generatorRegistry.register(textgenEntry);  // textgen before strudel for priority
  generatorRegistry.register(strudelEntry);
  generatorRegistry.register(hydraEntry);
  generatorRegistry.register(toneEntry);
  
  // P5 generator with tier-based prompting (fallback for all p5 sketches)
  generatorRegistry.register(p5Entry);
}

/**
 * Register all generators with the singleton registry.
 * Call once at application startup.
 * 
 * First tries to load from plugins/, falls back to static registration.
 */
export async function registerAllGenerators(): Promise<void> {
  // Only register if not already registered (idempotent)
  if (generatorRegistry.getAll().length > 0) return;

  // Try to load plugins first
  pluginsLoaded = await loadPlugins();
  
  if (!pluginsLoaded) {
    Logger.info('registerGenerators', 'Falling back to static generator registration');
    registerStaticGenerators();
  } else {
    Logger.info('registerGenerators', `Loaded ${pluginLoader.getAllPlugins().length} plugins`);
  }
}

// Re-export for convenience
export {
  shaderConfidence,
  threeConfidence,
  svgConfidence,
  htmlConfidence,
  asciiConfidence,
  textgenConfidence,
  strudelConfidence,
  hydraConfidence,
  toneConfidence,
  hyperframesConfidence,
  p5Confidence,
};
