/**
 * RemotionGenerator - legacy class name for active Revideo scene generation
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { RevideoValidator } from '../../core/validators/RevideoValidator.js';

export interface RemotionGeneratorOptions extends TierBasedGeneratorOptions {}

export class RemotionGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    // Class name is kept for compatibility, but the active video generation
    // contract is Revideo. This ensures GeneratorHarnessTools supplies Revideo
    // rails instead of legacy Remotion hints.
    super('revideo', llmOrConfig);
  }

  /**
   * Check if this generator can handle the given prompt
   * Domain-specific capability check - preserved from original
   */
  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(remotion|revideo)\b/.test(lower)) return 0.95;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video)\b/.test(lower)) return 0.8;
    return 0;
  }

  async generate(prompt: string, options?: RemotionGeneratorOptions): Promise<string> {
    return super.generate(prompt, options);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = RevideoValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors.join('; ') };
    }
    return { valid: true };
  }

  /**
   * Wrap Revideo scene for gallery iframe display.
   * Since Revideo requires compilation/rendering, show code with syntax highlighting.
   */
  wrapForGallery(code: string): string {
    const escaped=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revideo Scene</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
pre{font-size:clamp(9px,1.5vw,14px);line-height:1.5;white-space:pre-wrap;max-width:95vw;overflow:auto}
.kw{color:#cba6f7}.fn{color:#89b4fa}.str{color:#a6e3a1}.cm{color:#6c7086}
</style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
  }
}
