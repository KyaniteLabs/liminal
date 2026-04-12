/**
 * ASCIIArtGenerator - Generates text-based ASCII art via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { ASCIIValidator } from '../../core/validators/ASCIIValidator.js';

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
    const result = ASCIIValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors[0] ?? 'Generated code contains invalid characters for ASCII art' };
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

  /**
   * Wrap ASCII art for gallery iframe display.
   * Uses a monospace pre block with dark background.
   */
  wrapForGallery(code: string): string {
    const escaped=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ASCII Art</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:monospace;min-height:100vh;display:flex;align-items:center;justify-content:center}
pre{font-size:clamp(8px,1.5vw,16px);line-height:1.2;white-space:pre}
</style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
  }
}
