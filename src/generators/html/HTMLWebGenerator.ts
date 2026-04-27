/**
 * HTMLWebGenerator - Generates complete HTML/CSS/JS web pages via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { HTMLValidator } from '../../core/validators/HTMLValidator.js';

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
    const htmlPrompt = [
      'Generate a complete single-file HTML document.',
      'Start with <!DOCTYPE html> and include <html>, <head>, <body>, and all closing tags.',
      'Keep it compact enough to finish in one response; no markdown fences or prose.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    const code = await super.generate(htmlPrompt, { ...options, maxTokens: options?.maxTokens ?? 8192 });
    return this.extractHTML(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    let html: string;
    try {
      html = this.extractHTML(code);
    } catch {
      return { valid: false, error: 'Generated code is not valid HTML' };
    }

    const result = HTMLValidator.validate(html);
    return result.valid
      ? { valid: true }
      : { valid: false, error: result.errors.join('; ') };
  }

  private extractHTML(code: string): string {
    const htmlMatch = code.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1].trim();
    if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      let cleaned = code.trim();
      cleaned = cleaned.replace(/^```(?:html)?\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/i, '');
      return cleaned.trim();
    }
    throw new Error('HTMLWebGenerator: LLM output is not valid HTML');
  }
}
