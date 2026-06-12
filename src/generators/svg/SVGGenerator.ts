import { GenerationError } from '../../errors/GenerationError.js';
import { PromptBuilder } from '../../llm/PromptBuilder.js';
import { detectModelTier, trimContext } from '../../llm/ModelTier.js';
import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { SVG_MODE_PROFILES, inferSVGMode, type SVGMode } from './SVGModeProfiles.js';
import { salvageSVG, sanitizeSVG } from './SVGSanitizer.js';
import { validateSVG } from './SVGValidator.js';

export interface SVGGeneratorOptions extends TierBasedGeneratorOptions {
  mode?: SVGMode;
}

const SVG_PRIMARY_ATTEMPT_TIMEOUT_MS = 32_000;
const SVG_EMPTY_RETRY_TIMEOUT_MS = 44_000;

export class SVGGenerator extends TierBasedGenerator {
  private currentMode: SVGMode = 'generative-art';

  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('svg', llmOrConfig);
  }

  async generate(prompt: string, options?: SVGGeneratorOptions): Promise<string> {
    this.currentMode = options?.mode ?? inferSVGMode(prompt);
    const svgPrompt = this.buildSVGPrompt(prompt, { mode: this.currentMode });
    const builtPrompt = await this.buildTieredSVGPrompt(svgPrompt, options);
    const direct = await this.retrySVGDirect(prompt, builtPrompt, options);
    if (direct.svg) return direct.svg;
    throw new GenerationError(
      `SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts: ${direct.error ?? 'provider returned no valid SVG candidate'}`,
      'svg',
      { directRetryError: direct.error },
    );
  }

  private async completeSVGAttempt(attempt: {
    systemPrompt: string;
    prompt: string;
    maxTokens: number;
    timeoutMs: number;
    temperature?: number;
  }, options?: SVGGeneratorOptions): Promise<Awaited<ReturnType<typeof this.llm.complete>>> {
    return this.withAttemptTimeout(
      options?.signal,
      attempt.timeoutMs,
      (signal) => this.llm.complete({
        systemPrompt: attempt.systemPrompt,
        prompt: attempt.prompt,
        maxTokens: attempt.maxTokens,
        temperature: attempt.temperature ?? this.llm.getConfig().temperature,
        signal,
      }),
    );
  }

  private validateCandidate(text: string, mode: SVGMode): { svg: string | null; error?: string } {
    // Deterministic salvage first: strip fences + extract first complete
    // <svg>...</svg> from prose before any rejection path runs. Truncated
    // output (no closing </svg>) is rejected by validateSVG — we never
    // fabricate closing tags.
    const salvaged = salvageSVG(text);
    const sanitized = sanitizeSVG(salvaged);
    const validation = validateSVG(sanitized, { mode });
    if (validation.valid) {
      return { svg: validation.sanitized ?? sanitized };
    }
    return { svg: null, error: validation.error };
  }

  private async buildTieredSVGPrompt(svgPrompt: string, options?: SVGGeneratorOptions): Promise<{ systemPrompt: string; userPrompt: string }> {
    await this.llm.resolveEffectiveModel().catch(() => undefined);
    this.tier = detectModelTier(this.llm.getConfig());
    this.promptBuilder = new PromptBuilder(this.llm.getConfig());

    const context = await PromptBuilder.loadContext(this.domain, svgPrompt);
    if (context.domainDocs) {
      const budget = options?.contextBudget ?? 8_000;
      context.domainDocs = trimContext(context.domainDocs, Math.floor(budget * 0.3));
    }

    const built = this.promptBuilder.build(context);
    return this.tier === 'tiny'
      ? { systemPrompt: '', userPrompt: built.combined || built.user }
      : { systemPrompt: built.system, userPrompt: built.user };
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = validateSVG(code, { mode: this.currentMode });
    return result.valid ? { valid: true } : { valid: false, error: result.error };
  }

  private buildSVGPrompt(prompt: string, options: { mode?: SVGMode } = {}): string {
    const mode = options.mode ?? inferSVGMode(prompt);
    const profile = SVG_MODE_PROFILES[mode];
    return [
      'Generate raw SVG only.',
      `Mode: ${mode}`,
      `Mode label: ${profile.label}`,
      'Return exactly one complete <svg>...</svg> document.',
      'Include xmlns="http://www.w3.org/2000/svg" and a valid viewBox.',
      'Do not return markdown fences, prose, HTML wrappers, scripts, event handlers, foreignObject, external images, external fonts, or remote hrefs.',
      'Use self-contained vector geometry only.',
      'Keep the SVG compact: no comments, no repeated decorative boilerplate, and prefer 6-18 purposeful visible elements.',
      'End with </svg>.',
      this.transparentBackgroundGuidance(prompt),
      ...profile.promptGuidance,
      profile.allowGradients ? 'Gradients may be used only when they remain self-contained and safe.' : 'Do not use gradients, masks, patterns, or paint-server URLs.',
      profile.allowFilters ? 'Filters may be used only when they remain self-contained and safe.' : 'Do not use filters.',
      profile.allowText ? 'Text elements may be used when useful and readable.' : 'Do not use text elements; convert concepts into vector shapes.',
      profile.requireClosedPaths ? 'Any <path> used for cutting must end with Z/z so it is closed.' : '',
      '',
      `User request: ${prompt}`,
    ].filter(Boolean).join('\n');
  }

  private async retrySVGDirect(prompt: string, primaryPrompt: { systemPrompt: string; userPrompt: string }, options?: SVGGeneratorOptions): Promise<{ svg: string | null; error?: string }> {
    const mode = this.currentMode;
    let lastError: string | undefined;
    const prompts: Array<{ systemPrompt: string; prompt: string; maxTokens: number; timeoutMs: number; temperature?: number }> = [
      { systemPrompt: primaryPrompt.systemPrompt, prompt: primaryPrompt.userPrompt, maxTokens: options?.maxTokens ?? 2200, timeoutMs: SVG_PRIMARY_ATTEMPT_TIMEOUT_MS },
      {
        systemPrompt: this.buildEmptyCodeRetrySystemPrompt(primaryPrompt.systemPrompt),
        prompt: this.buildEmptyCodeRetryPrompt(prompt, primaryPrompt.userPrompt),
        maxTokens: options?.maxTokens ?? 1600,
        timeoutMs: SVG_EMPTY_RETRY_TIMEOUT_MS,
      },
    ];

    for (const attempt of prompts) {
      let result: Awaited<ReturnType<typeof this.llm.complete>>;
      try {
        result = await this.completeSVGAttempt(attempt, options);
      } catch (error) {
        lastError = this.describeError(error);
        continue;
      }
      if (!result.success || !result.text) {
        lastError = result.error ?? 'provider returned empty SVG text';
        continue;
      }
      const candidate = this.validateCandidate(result.text, mode);
      if (candidate.svg) return candidate;
      lastError = candidate.error;
    }

    return { svg: null, error: lastError ?? 'provider returned no valid SVG candidate' };
  }

  private transparentBackgroundGuidance(prompt: string): string {
    return /\btransparent\b|\bno background\b|\bwithout background\b/i.test(prompt)
      ? 'Transparent background requested: do not draw a full-canvas background rect, backdrop, or opaque root-sized shape; keep only foreground logo/vector elements.'
      : '';
  }

  private async withAttemptTimeout<T>(
    parentSignal: AbortSignal | undefined,
    timeoutMs: number,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (parentSignal?.aborted) {
      throw new Error('SVG generation aborted before provider attempt started');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(new Error(`SVG provider attempt timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const abortFromParent = () => {
      controller.abort(parentSignal?.reason ?? new Error('SVG generation aborted'));
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

  wrapForGallery(code: string): string {
    const svg = sanitizeSVG(code);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SVG Preview</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#f8fafc}
body{display:grid;place-items:center;padding:24px}
.svg-stage{width:min(92vw,960px);height:min(82vh,720px);display:grid;place-items:center;background:white;border:1px solid #cbd5e1;contain: content}
.svg-stage>svg{max-width:100%;max-height:100%;width:100%;height:100%}
</style>
</head>
<body>
<div class="svg-stage">
${svg}
</div>
</body>
</html>`;
  }
}
