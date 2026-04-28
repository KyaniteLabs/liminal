/**
 * HyperFramesGenerator - HTML + GSAP compositing generator
 *
 * Produces single HTML files with GSAP timelines for asset compositing:
 * slideshows, title cards, intros, promos, social media clips, overlays.
 * Uses TierBasedGenerator for model-aware prompt adaptation.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { HyperFramesValidator } from '../../core/validators/HyperFramesValidator.js';

export interface HyperFramesGeneratorOptions extends TierBasedGeneratorOptions {}

export class HyperFramesGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('hyperframes', llmOrConfig);
  }

  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(?:do not|don't|dont|never|avoid)\s+(?:use\s+)?hyperframes?\b/.test(lower)) return 0;

    // Generative keywords belong to Revideo, not HyperFrames
    const generative = /\b(particle|fractal|algorithmic|generative\s*(motion|art|animation)|data\s*vis|flow\s*field|cellular\s*automata|lenia)\b/;
    if (generative.test(lower)) return 0;

    if (/\bhyperframes?\b/.test(lower)) return 0.95;
    if (/\b(promo|trailer|slideshow|presentation|title\s*card|subtitle|caption|social\s*media)\b/.test(lower)) return 0.90;
    if (/\b(composite|compose|assemble|overlay|watermark|intro|outro)\b/.test(lower)) return 0.85;
    if (/\b(video|animation)\b/.test(lower) && /\b(images?|clips?|audio|music|narration)\b/.test(lower)) return 0.80;
    return 0;
  }

  async generate(prompt: string, options?: HyperFramesGeneratorOptions): Promise<string> {
    const hyperframesPrompt = [
      'Generate HyperFrames HTML code only.',
      'The output must be a single self-contained HTML file with an embedded GSAP timeline.',
      '',
      'Required structure:',
      '- A root <div> with data-composition-id attribute (the stage).',
      '- All timed elements must have class="clip" and data-start, data-duration, data-track-index attributes.',
      '- A GSAP timeline created with { paused: true }.',
      '- The timeline registered on window.__timelines[data-composition-id].',
      '- GSAP loaded from CDN: https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
      '',
      'Minimal valid example:',
      '<div id="stage" data-composition-id="demo" data-start="0" data-width="1920" data-height="1080">',
      '  <h1 id="title" class="clip" data-start="0" data-duration="5" data-track-index="0"',
      '      style="position:absolute;color:white;font-size:96px;">Hello</h1>',
      '</div>',
      '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>',
      '<script>',
      '  const tl = gsap.timeline({ paused: true });',
      '  tl.from("#title", { opacity: 0, y: 50, duration: 1 }, 0);',
      '  tl.to("#title", { opacity: 0, duration: 1 }, 4);',
      '  window.__timelines = window.__timelines || {};',
      '  window.__timelines["demo"] = tl;',
      '</script>',
      '',
      'Do not use React, Remotion, p5.js, createCanvas, setup(), draw(),',
      'makeScene, @revideo/core, useFrame, useCurrentFrame, or TypeScript.',
      '',
      `User request: ${prompt}`,
    ].join('\n');

    try {
      return await super.generate(hyperframesPrompt, options);
    } catch (error) {
      const direct = await this.retryHyperFramesDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = HyperFramesValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors.join('; ') };
    }
    return { valid: true };
  }

  private async retryHyperFramesDirect(prompt: string, options?: HyperFramesGeneratorOptions): Promise<string | null> {
    const result = await this.llm.complete({
      systemPrompt: 'You write single-file HTML compositions using GSAP. Output only HTML code.',
      prompt: [
        `Create a HyperFrames HTML composition for: ${prompt}`,
        'Return one self-contained HTML file.',
        'Required: GSAP timeline with { paused: true }, window.__timelines registration,',
        'class="clip" on timed elements, data-start/data-duration/data-track-index attributes,',
        'data-composition-id on root div.',
        'Load GSAP from https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
        'Do not use React, Remotion, p5.js, createCanvas, setup(), draw(), makeScene, or @revideo/core.',
      ].join('\n'),
      maxTokens: options?.maxTokens ?? 4000,
      temperature: this.llm.getConfig().temperature,
      signal: options?.signal,
    });
    if (!result.success || !result.text) return null;
    return this.validateOutput(result.text).valid ? result.text.trim() : null;
  }

  wrapForGallery(code: string): string {
    if (/<meta\s+[^>]*viewport/i.test(code)) {
      return code;
    }
    const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    if (/<head[^>]*>/i.test(code)) {
      return code.replace(/<head[^>]*>/i, `$&\n${viewportTag}`);
    }
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${viewportTag}
</head>
<body>
${code}
</body>
</html>`;
  }
}
