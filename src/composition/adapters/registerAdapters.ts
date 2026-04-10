/**
 * Adapter Registration
 *
 * Central registry for all composition adapters.
 * Provides a single function to register all adapters with a CompositionEngine.
 *
 * @example
 * ```typescript
 * import { CompositionEngine } from './CompositionEngine.js';
 * import { registerAllAdapters } from './adapters/registerAdapters.js';
 *
 * const engine = new CompositionEngine();
 * registerAllAdapters(engine); // Registers all 9 adapters
 * ```
 */

import type { CompositionEngine } from '../CompositionEngine.js';
import { p5Adapter } from './P5Adapter.js';
import { toneAdapter } from './ToneAdapter.js';
import { threeAdapter } from './ThreeAdapter.js';
import { shaderAdapter } from './ShaderAdapter.js';
import { strudelAdapter } from './StrudelAdapter.js';
import { hydraAdapter } from './HydraAdapter.js';
import { asciiArtAdapter } from './ASCIIArtAdapter.js';
import { htmlAdapter } from './HTMLAdapter.js';
import { remotionAdapter } from './RemotionAdapter.js';

/**
 * Singleton object containing all pre-registered adapter instances.
 * Use this to access individual adapters without creating new instances.
 *
 * @example
 * ```typescript
 * import { allAdapters } from './adapters/registerAdapters.js';
 *
 * // Access individual adapters
 * const p5 = allAdapters.p5;
 * const tone = allAdapters.tone;
 * ```
 */
export const allAdapters = {
  /** p5.js adapter for creative coding sketches */
  p5: p5Adapter,

  /** Tone.js adapter for audio/music layers */
  tone: toneAdapter,

  /** Three.js adapter for 3D graphics */
  three: threeAdapter,

  /** Shader adapter for GLSL/fragment shaders */
  shader: shaderAdapter,

  /** Strudel adapter for live coding patterns */
  strudel: strudelAdapter,

  /** Hydra adapter for live coding visuals */
  hydra: hydraAdapter,

  /** ASCII art adapter for text-based graphics */
  asciiArt: asciiArtAdapter,

  /** HTML adapter for DOM-based layers */
  html: htmlAdapter,

  /** Revideo adapter for video compositions */
  revideo: remotionAdapter,
  /** @deprecated Use 'revideo' instead - remotion is a legacy alias */
  remotion: remotionAdapter,
} as const;

/**
 * Registers all 9 adapters with a CompositionEngine.
 *
 * This function registers the following adapters:
 * - p5 (p5.js creative coding)
 * - music (Tone.js audio)
 * - three (Three.js 3D)
 * - shader (GLSL shaders)
 * - strudel (Strudel patterns)
 * - hydra (Hydra visuals)
 * - ascii (ASCII art)
 * - html (HTML/DOM)
 * - video (Revideo video)
 *
 * @param engine - The CompositionEngine to register adapters with
 *
 * @example
 * ```typescript
 * const engine = new CompositionEngine();
 * registerAllAdapters(engine);
 *
 * // Now you can add layers of any type
 * engine.addLayer(p5Layer);
 * engine.addLayer(toneLayer);
 * ```
 */
export function registerAllAdapters(engine: CompositionEngine): void {
  // Visual/Graphics adapters
  engine.registerAdapter('p5', allAdapters.p5);
  engine.registerAdapter('three', allAdapters.three);
  engine.registerAdapter('shader', allAdapters.shader);
  engine.registerAdapter('hydra', allAdapters.hydra);
  engine.registerAdapter('ascii', allAdapters.asciiArt);

  // Audio/Music adapters
  engine.registerAdapter('music', allAdapters.tone);
  engine.registerAdapter('tone', allAdapters.tone);
  engine.registerAdapter('strudel', allAdapters.strudel);

  // Content adapters
  engine.registerAdapter('html', allAdapters.html);
  engine.registerAdapter('video', allAdapters.revideo);
  engine.registerAdapter('remotion', allAdapters.revideo);
}
