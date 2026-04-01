/**
 * RemotionGenerator - Generates Remotion React video components
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface RemotionGeneratorOptions extends TierBasedGeneratorOptions {}

export class RemotionGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('remotion', llmOrConfig);
  }

  /**
   * Check if this generator can handle the given prompt
   * Domain-specific capability check - preserved from original
   */
  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(remotion)\b/.test(lower)) return 0.9;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video)\b/.test(lower)) return 0.8;
    return 0;
  }

  async generate(prompt: string, options?: RemotionGeneratorOptions): Promise<string> {
    return super.generate(prompt, options);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Basic Remotion validation - should be React component
    if (!code.includes('export') || !code.includes('Component')) {
      return { valid: false, error: 'Generated code does not appear to be a valid Remotion component' };
    }
    return { valid: true };
  }
}
