/**
 * HTMLWebGenerator - Generates complete HTML/CSS/JS web pages via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { HTMLValidator } from '../../core/validators/HTMLValidator.js';
import { GenerationError } from '../../errors/GenerationError.js';

export interface HTMLGeneratorOptions extends TierBasedGeneratorOptions {
  title?: string;
  includeAnimations?: boolean;
  responsive?: boolean;
  darkMode?: boolean;
}

const HTML_ATTEMPT_TIMEOUT_MS = 45_000;

export class HTMLWebGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('html', llmOrConfig);
  }

  async generate(prompt: string, options?: HTMLGeneratorOptions): Promise<string> {
    const htmlPrompt = [
      'Generate a complete single-file HTML document.',
      'Start with <!DOCTYPE html> and include <html>, <head>, <body>, and all closing tags.',
      'Keep it compact enough to finish in one response; no markdown fences or prose.',
      'Ensure the visual output is high contrast and never renders as a dark or black screen. Avoid very dark backgrounds unless foreground elements are brightly lit.',
      'If controls are requested, they must manipulate a visible main artwork area, canvas, SVG, or color field that occupies most of the viewport.',
      'Render the visual field immediately on load; do not leave the main stage blank until user interaction.',
      'Ensure all JavaScript inside <script> tags is syntactically valid and free of ReferenceErrors (e.g. do not use undefined variables).',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    const direct = await this.retryHTMLDirect(htmlPrompt, options);
    if (direct.html) return direct.html;
    throw new GenerationError(
      `HTMLWebGenerator: provider did not return valid HTML within bounded attempts: ${direct.error ?? 'provider returned no valid HTML candidate'}`,
      'html',
      { directRetryError: direct.error },
    );
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
    if (htmlMatch) {
      const prefix = code.slice(0, htmlMatch.index).trim();
      const doctype = /<!DOCTYPE\s+html>/i.test(prefix) ? '<!DOCTYPE html>\n' : '';
      return `${doctype}${htmlMatch[1].trim()}`;
    }
    if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
      let cleaned = code.trim();
      cleaned = cleaned.replace(/```(?:html)?\s*/gi, '');
      cleaned = cleaned.replace(/```/g, '');
      return cleaned.trim();
    }
    throw new Error('HTMLWebGenerator: LLM output is not valid HTML');
  }

  private async retryHTMLDirect(htmlPrompt: string, options?: HTMLGeneratorOptions): Promise<{ html: string | null; error?: string }> {
    const prompts = [
      htmlPrompt,
      [
        'Return one compact complete HTML file only.',
        'Start with <!DOCTYPE html> and end with </html>.',
        'Include a visible full-viewport color-field stage or canvas plus any requested controls.',
        'Draw or initialize the visible stage immediately; no blank main area.',
        'No markdown fences, prose, external assets, React, TypeScript, or build steps.',
        htmlPrompt,
      ].join('\n'),
    ];
    let lastError: string | undefined;

    for (const prompt of prompts) {
      let result: Awaited<ReturnType<typeof this.llm.complete>>;
      try {
        result = await this.withAttemptTimeout(
          options?.signal,
          HTML_ATTEMPT_TIMEOUT_MS,
          (signal) => this.llm.complete({
            systemPrompt: 'You create complete single-file HTML artifacts. Output raw HTML only.',
            prompt,
            maxTokens: options?.maxTokens ?? 5000,
            temperature: this.llm.getConfig().temperature,
            signal,
          }),
        );
      } catch (error) {
        lastError = this.describeError(error);
        continue;
      }
      if (!result.success || !result.text) {
        lastError = result.error ?? 'provider returned empty HTML text';
        continue;
      }
      try {
        const html = this.extractHTML(result.text);
        const validation = this.validateOutput(html);
        if (validation.valid) return { html };
        lastError = validation.error;
      } catch (error) {
        lastError = this.describeError(error);
      }
    }

    return { html: null, error: lastError ?? 'provider returned no valid HTML candidate' };
  }

  private async withAttemptTimeout<T>(
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (parentSignal?.aborted) {
      throw new Error('HTML generation aborted before provider attempt started');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error(`HTML provider attempt timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const abortFromParent = () => {
      controller.abort(parentSignal?.reason ?? new Error('HTML generation aborted'));
    };
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    try {
      return await run(controller.signal);
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abortFromParent);
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
