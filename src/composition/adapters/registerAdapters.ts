/**
 * Adapter Registration
 *
 * Central registry for all composition adapters.
 * Provides a single function to register all adapters with a CompositionEngine.
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

export const allAdapters = {
  p5: p5Adapter,
  tone: toneAdapter,
  three: threeAdapter,
  shader: shaderAdapter,
  strudel: strudelAdapter,
  hydra: hydraAdapter,
  asciiArt: asciiArtAdapter,
  html: htmlAdapter,
} as const;

export function registerAllAdapters(engine: CompositionEngine): void {
  engine.registerAdapter('p5', allAdapters.p5);
  engine.registerAdapter('three', allAdapters.three);
  engine.registerAdapter('shader', allAdapters.shader);
  engine.registerAdapter('hydra', allAdapters.hydra);
  engine.registerAdapter('ascii', allAdapters.asciiArt);
  engine.registerAdapter('music', allAdapters.tone);
  engine.registerAdapter('tone', allAdapters.tone);
  engine.registerAdapter('strudel', allAdapters.strudel);
  engine.registerAdapter('html', allAdapters.html);
}
