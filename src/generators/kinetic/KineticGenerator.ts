/**
 * KineticGenerator - CSS-native generative art.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';
import { GenerationError } from '../../errors/GenerationError.js';
import { KINETIC_SYSTEM_PROMPT, buildKineticPrompt } from './kineticPrompt.js';
import { KineticWrapper } from './KineticWrapper.js';
import { Logger } from '../../utils/Logger.js';

export interface KineticGeneratorOptions extends TierBasedGeneratorOptions {}

export class KineticGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('kinetic', llmOrConfig);
  }

  async generate(prompt: string, options?: KineticGeneratorOptions): Promise<string> {
    const response = await this.generateFull(prompt, options);
    return response.code;
  }

  async generateFull(prompt: string, options?: KineticGeneratorOptions): Promise<LLMResponse> {
    if (!this.llm) {
      throw new Error('KineticGenerator: LLM not initialized');
    }

    Logger.info('KineticGenerator', 'Generating CSS-kinetic artwork');
    let response = await this.llm.generate(
      KINETIC_SYSTEM_PROMPT,
      buildKineticPrompt(prompt),
      options?.signal,
      options?.bypassCache
    );

    if (!response.code || response.code.trim().length === 0) {
      throw new Error('KineticGenerator: LLM returned empty code');
    }

    response.code = this.normalizeKineticHtml(response.code);
    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      response = await this.llm.generate(
        KINETIC_SYSTEM_PROMPT,
        this.buildRetryPrompt(prompt, response.code, validated.error ?? 'Validation failed'),
        options?.signal,
        true
      );
      response.code = this.normalizeKineticHtml(response.code ?? '');
      const revalidated = this.validateOutput(response.code);
      if (!revalidated.valid) {
        throw new GenerationError(`KineticGenerator: ${revalidated.error}`, 'kinetic', {
          validationError: revalidated.error,
          failedCode: response.code,
        });
      }
    }

    return response;
  }

  private buildRetryPrompt(prompt: string, failedCode: string, error: string): string {
    return `${buildKineticPrompt(prompt)}

The previous output failed validation.
Validation error: ${error}

Previous output:
\`\`\`html
${failedCode}
\`\`\`

Regenerate a complete CSS-kinetic artwork:
- include <!DOCTYPE html>, <html>, <head>, and <body>
- include visible elements inside <body> such as div/span/svg elements
- include at least one CSS @keyframes block
- use animation: ... infinite on visible elements
- do not include JavaScript or <script>
- output raw HTML only`;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const validation = CodeValidator.validate(code, 'kinetic');
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
    }
    if (!this.hasVisibleBodyContent(code)) {
      return {
        valid: false,
        error: 'Kinetic HTML must include visible elements inside <body>, not just CSS',
      };
    }
    return { valid: true };
  }

  private hasVisibleBodyContent(code: string): boolean {
    const bodyMatch = code.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch?.[1] ?? code;
    const visibleElementPattern = /<(div|span|section|article|main|p|h[1-6]|svg|canvas|ul|ol|li)\b[^>]*>/i;
    return visibleElementPattern.test(
      body
        .replace(/<style\b[\s\S]*?<\/style>/gi, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
    );
  }

  private normalizeKineticHtml(code: string): string {
    let cleaned = code
      .replace(/^```(?:html)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!/^<!DOCTYPE\s+html/i.test(cleaned) && /<html\b/i.test(cleaned)) {
      cleaned = `<!DOCTYPE html>\n${cleaned}`;
    }

    const styleClose = cleaned.lastIndexOf('</style>');
    const bodyOpen = cleaned.search(/<body\b/i);
    if (styleClose >= 0 && bodyOpen >= 0 && styleClose < bodyOpen) {
      const bodyStart = cleaned.slice(0, bodyOpen);
      let rest = cleaned.slice(bodyOpen);
      const orphanKeyframes = rest.match(/@keyframes[\s\S]*?(?=<\/style>|<\/head>|<\/body>|<div|<svg|$)/g);
      if (orphanKeyframes?.length) {
        rest = rest.replace(/@keyframes[\s\S]*?(?=<\/style>|<\/head>|<\/body>|<div|<svg|$)/g, '');
        cleaned = `${bodyStart.replace('</style>', `${orphanKeyframes.join('\n')}\n</style>`)}${rest}`;
      }
    }

    // Ensure opening <body> exists
    if (!/<body\b/i.test(cleaned)) {
      cleaned = cleaned.replace(/<\/head>/i, '</head>\n<body>') ?? cleaned;
      if (!/<body\b/i.test(cleaned)) {
        cleaned = cleaned.replace(/<html\b[^>]*>/i, '$&\n<body>') ?? cleaned;
      }
    }
    if (!/<\/body>/i.test(cleaned)) {
      cleaned += '\n</body>';
    }
    if (!/<\/html>/i.test(cleaned)) {
      cleaned += '\n</html>';
    }

    const bodyMatch = /<body\b[^>]*>/i.exec(cleaned);
    if (bodyMatch) {
      const bodyStart = bodyMatch.index + bodyMatch[0].length;
      const beforeBody = cleaned.slice(0, bodyStart);
      const body = cleaned.slice(bodyStart)
        .replace(/<\/?style[^>]*>/gi, '')
        .replace(/<\/head>/gi, '')
        .replace(/<body\b[^>]*>/gi, '')
        .replace(/<\/body>/gi, '')
        .replace(/<\/html>/gi, '');
      cleaned = `${beforeBody}${body}\n</body>\n</html>`;
    }

    // If body has no visible elements, inject elements for CSS targets
    if (!this.hasVisibleBodyContent(cleaned)) {
      // Collect animation targets from @keyframes names and CSS class selectors
      const keyframeNames = [...cleaned.matchAll(/@keyframes\s+([a-zA-Z_-][\w-]*)/g)].map(m => m[1]);
      const styleContent = cleaned.match(/<style\b[\s\S]*?<\/style>/i)?.[0] ?? '';
      const classNames = [...styleContent.matchAll(/\.([a-zA-Z_-][\w-]*)\s*\{[^}]*animation/g)].map(m => m[1]);
      const targetNames = [...new Set([...keyframeNames, ...classNames])];

      if (targetNames.length > 0) {
        const injectedDivs = targetNames.map(name =>
          `  <div class="${name}" style="position:absolute;"></div>`
        ).join('\n');
        cleaned = cleaned.replace(/(<body\b[^>]*>)/i, `$1\n${injectedDivs}`);
        if (!cleaned.includes('position:') && !cleaned.includes('display:')) {
          cleaned = cleaned.replace('</style>', `
body { margin: 0; overflow: hidden; background: #0d2031; width: 100vw; height: 100vh; position: relative; }
body > div { position: absolute; }
</style>`);
        }
      } else {
        // No keyframes or animated classes found — inject a complete fallback scene
        const fallback = `  <div class="scene" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
    <div class="orb" style="width:40vmin;height:40vmin;border-radius:50%;background:radial-gradient(circle,#f39b9f,#5eebf3,#0d2031);animation:spin 6s linear infinite,pulse 3s ease-in-out infinite;"></div>
  </div>`;
        cleaned = cleaned.replace(/(<body\b[^>]*>)/i, `$1\n${fallback}`);
        const hasKeyframes = /@keyframes\s+spin/.test(cleaned);
        if (!hasKeyframes) {
          cleaned = cleaned.replace('</style>', `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.15); opacity: 1; } }
body { margin: 0; overflow: hidden; background: #0d2031; width: 100vw; height: 100vh; position: relative; }
body > div { position: absolute; }
</style>`);
        }
      }
    }

    return cleaned;
  }

  wrapForGallery(code: string): string {
    return KineticWrapper.wrap(code, { title: 'Kinetic Artwork' });
  }
}
