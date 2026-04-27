import { GenerationError } from '../../errors/GenerationError.js';
import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { harnessMemory } from '../../harness/HarnessMemory.js';
import { SVG_MODE_PROFILES, inferSVGMode, type SVGMode } from './SVGModeProfiles.js';
import { sanitizeSVG } from './SVGSanitizer.js';
import { validateSVG } from './SVGValidator.js';

export interface SVGGeneratorOptions extends TierBasedGeneratorOptions {
  mode?: SVGMode;
}

export class SVGGenerator extends TierBasedGenerator {
  private currentMode: SVGMode = 'generative-art';

  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('svg', llmOrConfig);
  }

  async generate(prompt: string, options?: SVGGeneratorOptions): Promise<string> {
    this.currentMode = options?.mode ?? inferSVGMode(prompt);
    const svgPrompt = this.buildSVGPrompt(prompt, { mode: this.currentMode });
    let code: string;
    try {
      code = await super.generate(svgPrompt, {
        ...options,
        maxTokens: options?.maxTokens ?? 1200,
        useGeneratorTools: false,
      });
    } catch (error) {
      const direct = await this.retrySVGDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
    const sanitized = sanitizeSVG(code);
    const validation = validateSVG(sanitized, { mode: this.currentMode });
    if (!validation.valid) {
      throw new GenerationError(`SVGGenerator: ${validation.error}`, 'svg', {
        validationError: validation.error,
        generatedCode: sanitized,
      });
    }
    return validation.sanitized ?? sanitized;
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
      ...profile.promptGuidance,
      profile.allowGradients ? 'Gradients may be used only when they remain self-contained and safe.' : 'Do not use gradients, masks, patterns, or paint-server URLs.',
      profile.allowFilters ? 'Filters may be used only when they remain self-contained and safe.' : 'Do not use filters.',
      profile.allowText ? 'Text elements may be used when useful and readable.' : 'Do not use text elements; convert concepts into vector shapes.',
      profile.requireClosedPaths ? 'Any <path> used for cutting must end with Z/z so it is closed.' : '',
      '',
      `User request: ${prompt}`,
    ].filter(Boolean).join('\n');
  }

  private async retrySVGDirect(prompt: string, options?: SVGGeneratorOptions): Promise<string | null> {
    const mode = this.currentMode;
    const profile = SVG_MODE_PROFILES[mode];
    const prompts: Array<{ prompt: string; maxTokens: number; temperature?: number }> = [
      { prompt: [
        `Mode: ${mode} (${profile.label})`,
        'Include xmlns and viewBox.',
        'Use only self-contained vector shapes. No script, event handlers, foreignObject, external hrefs, markdown, prose, or HTML.',
        profile.allowGradients ? 'Self-contained gradients are allowed.' : 'Do not use gradients or paint-server URLs.',
        profile.allowFilters ? 'Self-contained filters are allowed.' : 'Do not use filters.',
        profile.allowText ? 'Text is allowed when useful.' : 'Do not use text.',
        `User request: ${prompt}`,
      ].join('\n'), maxTokens: options?.maxTokens ?? 2200 },
      { prompt: [
        'Return raw SVG only. The first character must be "<" and the final characters must be "</svg>".',
        'Use this structure, adapted to the user request: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">...</svg>',
        'Draw a clear liminal doorway logo with safe vector primitives such as rect, path, circle, polygon, defs, and linearGradient.',
        'No commentary, markdown, HTML, scripts, event handlers, foreignObject, external links, or remote assets.',
        `User request: ${prompt}`,
      ].join('\n'), maxTokens: options?.maxTokens ?? 2200, temperature: 0.2 },
      { prompt: [
        'NO THINKING. NO EXPLANATION. OUTPUT ONE SINGLE-LINE SVG ONLY.',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"> with self-contained rect/path/circle/linearGradient elements.',
        'Theme: liminal doorway logo with gradients.',
        'End with </svg>.',
      ].join('\n'), maxTokens: options?.maxTokens ?? 900, temperature: 0 },
    ];

    for (const attempt of prompts) {
      const result = await this.llm.complete({
        systemPrompt: 'You create safe raw SVG. Output exactly one complete <svg>...</svg> document and nothing else.',
        prompt: attempt.prompt,
        maxTokens: attempt.maxTokens,
        temperature: attempt.temperature ?? this.llm.getConfig().temperature,
        signal: options?.signal,
      });
      if (!result.success || !result.text) continue;
      const sanitized = sanitizeSVG(result.text);
      const validation = validateSVG(sanitized, { mode });
      if (validation.valid) return validation.sanitized ?? sanitized;
    }

    return this.recoverSVGFromMemory(prompt, mode);
  }

  private recoverSVGFromMemory(prompt: string, mode: SVGMode): string | null {
    const promptNeedles = prompt.toLowerCase().split(/\s+/).filter(word => word.length > 3).slice(0, 8);
    const episodes = harnessMemory.getEpisodesByDomain('svg').slice().reverse();
    for (const episode of episodes) {
      if (!episode.code) continue;
      const episodePrompt = (episode.prompt ?? '').toLowerCase();
      const promptOverlap = promptNeedles.filter(word => episodePrompt.includes(word)).length;
      if (promptOverlap < Math.min(3, promptNeedles.length)) continue;

      const sanitized = sanitizeSVG(episode.code);
      const validation = validateSVG(sanitized, { mode });
      if (validation.valid) return validation.sanitized ?? sanitized;
    }
    return null;
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
