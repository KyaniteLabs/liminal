/**
 * HyperFramesGenerator - HTML + GSAP compositing generator
 *
 * Produces single HTML files with GSAP timelines for asset compositing:
 * slideshows, title cards, intros, promos, social media clips, overlays.
 * Uses TierBasedGenerator for model-aware prompt adaptation.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { HyperFramesValidator } from '../../core/validators/HyperFramesValidator.js';
import { GenerationError } from '../../errors/GenerationError.js';
import type { LLMResponse } from '../../llm/LLMClient.js';

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
    let response = await this.llm.generate(
      this.hyperFramesSystemPrompt(),
      this.buildHyperFramesPrompt(prompt),
      options?.signal,
      options?.bypassCache,
    );
    let code = this.normalizeHyperFramesHtml(response);

    if (!code) {
      throw new GenerationError(`${this.constructor.name}: LLM returned empty code`, 'hyperframes');
    }

    let validated = this.validateOutput(code);
    if (!validated.valid) {
      response = await this.llm.generate(
        this.hyperFramesSystemPrompt(),
        this.buildHyperFramesRetryPrompt(prompt, code, validated.error ?? 'Validation failed'),
        options?.signal,
        true,
      );
      code = this.normalizeHyperFramesHtml(response);
      validated = this.validateOutput(code);
    }

    if (!validated.valid) {
      throw new GenerationError(`${this.constructor.name}: ${validated.error}`, 'hyperframes', {
        validationError: validated.error,
        generatedCode: code,
      });
    }

    return code;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = HyperFramesValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors.join('; ') };
    }
    return { valid: true };
  }

  private hyperFramesSystemPrompt(): string {
    return [
      'You write single-file HTML motion compositions using GSAP.',
      'Output raw HTML only. Do not include markdown fences, explanations, JSON, React, Revideo, p5.js, or TypeScript.',
      'The HTML must be complete enough to save directly as a .html artifact.',
    ].join('\n');
  }

  private buildHyperFramesPrompt(prompt: string): string {
    return [
      `Create a HyperFrames composition for: ${prompt}`,
      '',
      'Required output:',
      '- Start with <!doctype html>.',
      '- Include a root stage element with data-composition-id.',
      '- Include at least three visible elements with class="clip".',
      '- Every clip must include data-start, data-duration, and data-track-index.',
      '- Load GSAP from https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js.',
      '- Create const tl = gsap.timeline({ paused: true }).',
      '- Register the timeline on window.__timelines[data-composition-id].',
      '- Use CSS gradients, generated shapes, or explicit user-provided asset URLs; inline SVG/data URIs are allowed.',
      '- Do not use random remote image URLs.',
      '- Use GSAP 3 syntax only: tl.from(...), tl.to(...), or tl.fromTo(...).',
      '',
      'Minimal structure to follow:',
      '<!doctype html>',
      '<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script></head>',
      '<body>',
      '<div id="stage" data-composition-id="demo">',
      '  <h1 id="title" class="clip" data-start="0" data-duration="4" data-track-index="0">Title</h1>',
      '</div>',
      '<script>',
      '  const tl = gsap.timeline({ paused: true });',
      '  tl.from("#title", { opacity: 0, y: 40, duration: 1 }, 0);',
      '  window.__timelines = window.__timelines || {};',
      '  window.__timelines["demo"] = tl;',
      '</script>',
      '</body></html>',
      '',
      'Return only the final HTML file.',
    ].join('\n');
  }

  private buildHyperFramesRetryPrompt(prompt: string, failedCode: string, error: string): string {
    return [
      this.buildHyperFramesPrompt(prompt),
      '',
      'The previous HTML failed validation.',
      `Validation error: ${error}`,
      '',
      'Previous output:',
      '```html',
      failedCode,
      '```',
      '',
      'Regenerate a complete valid HyperFrames HTML file now.',
    ].join('\n');
  }

  private normalizeHyperFramesHtml(response: LLMResponse): string {
    let code = response.code || '';
    code = code.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim();
    if (!/^<!doctype\s+html/i.test(code) && /<html\b/i.test(code)) {
      code = `<!doctype html>\n${code}`;
    }
    return code;
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
