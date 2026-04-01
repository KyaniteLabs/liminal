/**
 * ShaderGenerator - GLSL shader generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export class ShaderGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('shader', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    return super.generate(prompt, options);
  }

  /**
   * GLSL-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Check for truncated/incomplete code
    if (this.isTruncated(code)) {
      // Only fail if critically incomplete
      if (!code.includes('void main') && !code.includes('gl_FragColor')) {
        return {
          valid: false,
          error: 'Generated code is critically incomplete (missing main or gl_FragColor)',
        };
      }
      console.warn('[ShaderGenerator] Warning: Code may be truncated, attempting to use anyway');
    }

    return { valid: true };
  }

  private isTruncated(code: string): boolean {
    const trimmed = code.trim();
    const lastChar = trimmed.slice(-1);
    const lastLine = trimmed.split('\n').pop() || '';
    
    if (!['}', ';', '\n'].includes(lastChar) && lastLine.length > 0) {
      if (!lastLine.trim().startsWith('//') && !lastLine.trim().startsWith('/*')) {
        return true;
      }
    }
    
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces > closeBraces) return true;
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens > closeParens) return true;
    
    if (!code.includes('void main') || !code.includes('gl_FragColor')) return true;
    
    return false;
  }
}
