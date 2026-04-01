/**
 * HTMLWebGenerator - Generates complete HTML/CSS/JS web pages via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface HTMLGeneratorOptions extends TierBasedGeneratorOptions {
  title?: string;
  includeAnimations?: boolean;
  responsive?: boolean;
  darkMode?: boolean;
}

export class HTMLWebGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('html', llmOrConfig);
  }

  async generate(prompt: string, options?: HTMLGeneratorOptions): Promise<string> {
    const code = await super.generate(prompt, options);
    return this.extractHTML(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Must be valid HTML
    if (!code.includes('<!DOCTYPE html>') && !code.includes('<html')) {
      return { valid: false, error: 'Generated code is not valid HTML' };
    }
    return { valid: true };
  }

  private extractHTML(code: string): string {
    const htmlMatch = code.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1].trim();
    if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      return code.trim();
    }
    throw new Error('HTMLWebGenerator: LLM output is not valid HTML');
  }
}
