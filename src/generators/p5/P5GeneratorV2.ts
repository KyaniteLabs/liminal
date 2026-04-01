/**
 * P5GeneratorV2 - Tier-based p5.js generation
 * 
 * Uses ModelTier detection to adapt prompt style based on capability
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface P5GeneratorV2Options extends TierBasedGeneratorOptions {
  // P5-specific options can be added here
}

export class P5GeneratorV2 extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('p5', llmOrConfig);
  }

  async generate(prompt: string, options?: P5GeneratorV2Options): Promise<string> {
    // Check if prompt suggests sound for additional context
    const needsSound = this.promptSuggestsSound(prompt.toLowerCase());
    if (needsSound) {
      console.log('[P5GeneratorV2] Sound detected in prompt, will include audio guidance');
    }
    
    return super.generate(prompt, options);
  }

  /**
   * P5-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Check for required p5 functions
    const hasSetup = code.includes('function setup()') || code.includes('setup()');
    const hasDraw = code.includes('function draw()') || code.includes('draw()');
    
    // p5 code should have at least setup
    if (!hasSetup) {
      return {
        valid: false,
        error: 'Generated code missing required setup() function',
      };
    }

    // Check for createCanvas (usually required)
    if (!code.includes('createCanvas')) {
      console.warn('[P5GeneratorV2] Warning: Code may be missing createCanvas()');
    }

    return { valid: true };
  }

  /**
   * Check if prompt suggests sound/audio needs
   */
  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep', 'tone'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }
}
