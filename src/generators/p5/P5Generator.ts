/**
 * P5Generator - DEPRECATED: Use P5GeneratorLLM instead
 * 
 * This class previously generated template-based p5.js sketches.
 * All generation now goes through LLM via P5GeneratorLLM.
 * 
 * This file is kept for backward compatibility but will throw
 * errors if used directly, ensuring all code goes through LLM.
 */

import { P5GeneratorLLM } from './P5GeneratorLLM.js';

export class P5Generator {
  /**
   * Generate p5.js sketch code via LLM
   * 
   * @param prompt - The generation prompt
   * @param context - Optional context (passed to LLM)
   * @returns Promise resolving to p5.js code string
   * @throws Error if LLM is not configured
   */
  static async generate(prompt: unknown, _context?: unknown): Promise<string> {
    const promptStr = this.normalizeInput(prompt);
    
    console.warn('[P5Generator] Using LLM-based generation. Ensure LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL are set.');
    
    const generator = new P5GeneratorLLM();
    return generator.generate(promptStr);
  }

  /**
   * Normalize input to string
   */
  private static normalizeInput(input: unknown): string {
    if (input === null) return '';
    if (input === undefined) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'number') return input.toString();
    if (typeof input === 'boolean') return input.toString();
    if (typeof input === 'object') return JSON.stringify(input);
    return String(input);
  }
}
