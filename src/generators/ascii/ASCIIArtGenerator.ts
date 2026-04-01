/**
 * ASCIIArtGenerator - Generates text-based ASCII art via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export type ASCIIStyle = 'simple' | 'landscape' | 'abstract';

export interface ASCIIOptions extends TierBasedGeneratorOptions {
  style?: ASCIIStyle;
  width?: number;
  height?: number;
}

export class ASCIIArtGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('ascii', llmOrConfig);
  }

  async generate(prompt: string, options?: ASCIIOptions): Promise<string> {
    const code = await super.generate(prompt, options);
    const width = options?.width || 40;
    const height = options?.height || 20;
    return this.formatASCII(code, width, height);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // ASCII art should only contain specific characters
    const allowedChars = /^[\s\.\-~+=*#%@\n\r]*$/;
    if (!allowedChars.test(code)) {
      return { valid: false, error: 'Generated code contains invalid characters for ASCII art' };
    }
    return { valid: true };
  }

  private formatASCII(code: string, width: number, height: number): string {
    const lines = code.split('\n').filter(line => line.trim() !== '');
    
    // Remove code block markers if present
    const cleanLines = lines
      .filter(line => !line.startsWith('```'))
      .filter(line => !line.startsWith('//'))
      .slice(0, height)
      .map(line => line.slice(0, width).padEnd(width, ' '));
    
    // Ensure exactly height lines
    while (cleanLines.length < height) {
      cleanLines.push(' '.repeat(width));
    }
    
    return cleanLines.join('\n');
  }
}
