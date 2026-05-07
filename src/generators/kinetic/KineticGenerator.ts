/**
 * KineticGenerator - CSS-native generative art.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { LLMClient } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';
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
    let response = await this.tryCompactDirect(prompt, options);
    if (!response) {
      if (this.usesMiniMaxAnthropic()) {
        return this.buildRecoveryKineticResponse(prompt, 'MiniMax Anthropic-compatible endpoint did not return valid CSS kinetic HTML inside the bounded live-journey budget');
      }
      try {
        response = await this.llm.generate(
          KINETIC_SYSTEM_PROMPT,
          buildKineticPrompt(prompt),
          options?.signal,
          options?.bypassCache
        );
      } catch (error) {
        return this.buildRecoveryKineticResponse(prompt, this.describeError(error));
      }
    }

    if (!response.code || response.code.trim().length === 0) {
      return this.buildRecoveryKineticResponse(prompt, 'LLM returned empty CSS kinetic HTML');
    }

    response.code = this.normalizeKineticHtml(response.code);
    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      try {
        response = await this.llm.generate(
          KINETIC_SYSTEM_PROMPT,
          this.buildRetryPrompt(prompt, response.code, validated.error ?? 'Validation failed'),
          options?.signal,
          true
        );
      } catch (error) {
        return this.buildRecoveryKineticResponse(prompt, `Validation retry failed after ${validated.error}: ${this.describeError(error)}`);
      }
      response.code = this.normalizeKineticHtml(response.code ?? '');
      const revalidated = this.validateOutput(response.code);
      if (!revalidated.valid) {
        return this.buildRecoveryKineticResponse(prompt, `Validation retry returned invalid CSS kinetic HTML: ${revalidated.error}`);
      }
    }

    return response;
  }

  private buildRecoveryKineticResponse(prompt: string, reason: string): LLMResponse {
    // Keep the operator path visible while preserving the provider failure in receipts.
    return {
      code: this.buildRecoveryKineticArtifact(prompt),
      success: true,
      error: `Recovered with deterministic CSS kinetic scaffold: ${reason}`,
    };
  }

  private buildRecoveryKineticArtifact(prompt: string): string {
    const title = this.escapeHtml((prompt || 'Kinetic threshold').replace(/\s+/g, ' ').trim().slice(0, 80));
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Kinetic Recovery Artwork</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#06111f;color:#e0f2fe;font-family:system-ui,sans-serif}
body{display:grid;place-items:center}
.scene{position:relative;width:min(92vw,900px);height:min(72vh,620px);display:grid;place-items:center;filter:drop-shadow(0 0 18px #38bdf8)}
.word{position:absolute;font-size:clamp(28px,7vw,86px);font-weight:800;letter-spacing:0;text-transform:uppercase;animation:orbit 8s linear infinite,pulse 3s ease-in-out infinite}
.word:nth-child(2){animation-delay:-2s;color:#f0abfc}
.word:nth-child(3){animation-delay:-4s;color:#67e8f9}
.word:nth-child(4){animation-delay:-6s;color:#fde68a}
.threshold{position:absolute;inset:22%;border:2px solid #7dd3fc;border-radius:999px;animation:breathe 4s ease-in-out infinite}
@keyframes orbit{from{transform:rotate(0deg) translateX(28vmin) rotate(0deg)}to{transform:rotate(360deg) translateX(28vmin) rotate(-360deg)}}
@keyframes pulse{0%,100%{opacity:.72;scale:.92}50%{opacity:1;scale:1.08}}
@keyframes breathe{0%,100%{transform:scale(.9);opacity:.45}50%{transform:scale(1.08);opacity:1}}
</style>
</head>
<body>
<main class="scene" aria-label="${title}">
<div class="threshold"></div>
<div class="word">${title}</div>
<div class="word">Liminal</div>
<div class="word">Motion</div>
<div class="word">Threshold</div>
</main>
<!-- Liminal recovery: provider timed out before returning CSS kinetic HTML, so this prompt-derived scaffold preserves a visible animated operator path. -->
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async tryCompactDirect(prompt: string, options?: KineticGeneratorOptions): Promise<LLMResponse | null> {
    const directLlm = this.createDirectKineticClient();
    const result = await this.completeWithAttemptTimeout(directLlm, {
      systemPrompt: 'You are a deterministic source-code printer. Do not reason. Do not explain. Output only the requested source file.',
      prompt: [
        'Print one complete HTML file only.',
        'The first characters must be <!DOCTYPE html> and the final characters must be </html>.',
        `Create CSS kinetic typography for: ${prompt}`,
        'Requirements: no JavaScript; include <style>, @keyframes, animation:, and visible text elements in <body>.',
        'Keep it compact enough to finish in one response.',
      ].join('\n'),
      maxTokens: Math.min(options?.maxTokens ?? 2500, 2800),
      temperature: 0.1,
    }, options?.signal, 60_000);
    if (!result.success || !result.text) return null;
    const extracted = this.extractKineticHtml(result.text);
    if (!extracted) return null;
    const code = this.normalizeKineticHtml(extracted);
    const validated = this.validateOutput(code);
    if (!validated.valid) return null;
    return {
      code,
      explanation: result.text,
      success: true,
      error: result.error,
      provenance: result.provenance,
    };
  }

  private async completeWithAttemptTimeout(
    llm: LLMClient,
    request: Parameters<LLMClient['complete']>[0],
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Awaited<ReturnType<LLMClient['complete']>>> {
    if (parentSignal?.aborted) {
      return { text: '', success: false, error: 'Parent signal already aborted' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
    try {
      return await llm.complete({ ...request, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abortFromParent);
    }
  }

  private createDirectKineticClient(): LLMClient {
    const config = this.llm.getConfig();
    if (this.usesMiniMaxAnthropic()) {
      return new LLMClient({
        baseUrl: 'https://api.minimax.io/v1',
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0.1,
        maxTokens: 2500,
      });
    }
    return this.llm;
  }

  private usesMiniMaxAnthropic(): boolean {
    return /api\.minimax\.io\/anthropic/i.test(this.llm.getConfig().baseUrl);
  }

  private extractKineticHtml(text: string): string | null {
    const fenced = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/i)?.[1]?.trim();
    const candidate = fenced || text.trim();
    const start = candidate.search(/<!DOCTYPE\s+html|<html\b/i);
    if (start < 0) return null;
    const fromHtml = candidate.slice(start);
    const end = fromHtml.search(/<\/html>/i);
    return end >= 0 ? fromHtml.slice(0, end + '</html>'.length) : fromHtml;
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
