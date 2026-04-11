/**
 * RemotionGenerator - Generates Remotion React video components
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface RemotionGeneratorOptions extends TierBasedGeneratorOptions {}

export class RemotionGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('remotion', llmOrConfig);
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
    const hasMakeScene = /makeScene/.test(code);
    const hasUseCurrentFrame = /useCurrentFrame/.test(code);
    const hasExport = /export\s+default/.test(code);
    if (!hasExport || (!hasMakeScene && !hasUseCurrentFrame)) {
      return { valid: false, error: 'Generated code does not appear to be a valid Revideo/Remotion component' };
    }
    return { valid: true };
  }

  /**
   * Wrap Remotion component for gallery iframe display.
   * Since Remotion requires compilation, shows code with syntax highlighting.
   */
  wrapForGallery(code: string): string {
    const escaped=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Remotion Component</title>
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
