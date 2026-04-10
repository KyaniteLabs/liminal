/**
 * Kinetic — CSS-native generative art domain (FUTURE, NOT YET WIRED)
 *
 * Generates autonomous, perpetually-animated visual compositions using
 * CSS keyframes and SVG. Zero JavaScript required at runtime.
 *
 * Status: Stub. Generation prompt and routing NOT implemented.
 * See docs/CREATIVE_DOMAIN_TYPES.md for design.
 */
import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export class KineticGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('kinetic', llmOrConfig);
  }

  generate(_prompt: string, _options?: TierBasedGeneratorOptions): Promise<string> {
    throw new Error('KineticGenerator: generation not yet implemented. See docs/CREATIVE_DOMAIN_TYPES.md');
  }
}
