/**
 * P5GeneratorV2 - Tier-based p5.js generation
 * 
 * Uses ModelTier detection to adapt prompt style based on capability
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';
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
    
    return super.generate(this.withP5Contract(prompt), options);
  }

  async generateFull(prompt: string, options?: P5GeneratorV2Options): Promise<LLMResponse> {
    return super.generateFull(this.withP5Contract(prompt), options);
  }

  /**
   * P5-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const validation = CodeValidator.validate(code, 'p5');
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
    }
    if (!/function\s+setup\s*\(/.test(validation.cleanedCode)) {
      return { valid: false, error: 'Generated code missing required setup() function' };
    }

    return { valid: true };
  }

  private withP5Contract(prompt: string): string {
    return [
      prompt,
      '',
      'Output contract:',
      '- Return only p5.js sketch code, not Markdown.',
      '- Prefer raw global-mode p5.js: define function setup() and function draw().',
      '- Do not use import, export, require, or module syntax.',
      '- Do not use Processing/Java syntax: no `float x`, no `vector v`, no `no()`, no undeclared `particles`.',
      '- If you return HTML, it must be a complete document ending with </body></html> and include the p5.js CDN.',
      '- Declare all variables and helper functions before using them.',
      '- Use real p5 APIs only; avoid invented calls such as velocity(), friction(), move(), lineMode(), or size().',
      '',
      'Minimal valid shape:',
      'let particles = [];',
      'function setup() {',
      '  createCanvas(600, 400);',
      '  for (let i = 0; i < 80; i++) particles.push({ x: random(width), y: random(height), vx: random(-1, 1), vy: random(-1, 1) });',
      '}',
      'function draw() {',
      '  background(10, 30, 60, 25);',
      '  for (const p of particles) {',
      '    p.x = (p.x + p.vx + width) % width;',
      '    p.y = (p.y + p.vy + height) % height;',
      '    circle(p.x, p.y, 4);',
      '  }',
      '}',
    ].join('\n');
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
    const trimmed = code.trim();
    if (/^(?:<!DOCTYPE\s+html|<html\b)/i.test(trimmed)) {
      return trimmed;
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
${code}
</script>
</body>
</html>`;
  }
}
