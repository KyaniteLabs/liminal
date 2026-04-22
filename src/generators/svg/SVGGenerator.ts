import { GenerationError } from '../../errors/GenerationError.js';
import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
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
    const code = await super.generate(svgPrompt, options);
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
      profile.allowGradients ? 'Gradients or filters may be used only when they remain self-contained and safe.' : 'Do not use gradients, masks, filters, patterns, or paint-server URLs.',
      profile.allowText ? 'Text elements may be used when useful and readable.' : 'Do not use text elements; convert concepts into vector shapes.',
      profile.requireClosedPaths ? 'Any <path> used for cutting must end with Z/z so it is closed.' : '',
      '',
      `User request: ${prompt}`,
    ].filter(Boolean).join('\n');
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
