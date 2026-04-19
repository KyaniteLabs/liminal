/**
 * P5GeneratorV2 - Tier-based p5.js generation
 * 
 * Uses ModelTier detection to adapt prompt style based on capability
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { Logger } from '../../utils/Logger.js';

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
      Logger.info('P5GeneratorV2', 'Sound detected in prompt, will include audio guidance');
    }
    
    return super.generate(prompt, options);
  }

  /**
   * P5-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Check for required p5 functions
    const hasSetup = code.includes('function setup()') || code.includes('setup()');
    // Note: draw() is optional for static sketches
    
    // p5 code should have at least setup
    if (!hasSetup) {
      return {
        valid: false,
        error: 'Generated code missing required setup() function',
      };
    }

    // Check for createCanvas (usually required)
    if (!code.includes('createCanvas')) {
      Logger.warn('P5GeneratorV2', 'Code may be missing createCanvas()');
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

  /**
   * Wrap p5.js sketch for gallery iframe display.
   * Injects p5.js CDN and creates a self-contained sketch harness.
   */
  wrapForGallery(code: string): string {
    const cleaned = code
      .replace(/^```(?:html|javascript|js)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (/<!DOCTYPE\s+html/i.test(cleaned) || /<html\b/i.test(cleaned)) {
      return cleaned;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>p5.js Sketch</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<style>
*{margin:0;padding:0;overflow:hidden}
body{background:#fff}
canvas{display:block}
</style>
</head>
<body>
<script>
${cleaned}
</script>
</body>
</html>`;
  }
}
