/**
 * RevideoGenerator - Generates Revideo video scenes
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface RevideoGeneratorOptions extends TierBasedGeneratorOptions {}

export class RevideoGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('revideo', llmOrConfig);
  }

  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(revideo)\b/.test(lower)) return 0.95;
    if (/\b(motion\s*canvas)\b/.test(lower)) return 0.90;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video|programmatic\s*video)\b/.test(lower)) return 0.75;
    return 0;
  }

  async generate(prompt: string, options?: RevideoGeneratorOptions): Promise<string> {
    return super.generate(prompt, options);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (!code.includes('makeScene')) {
      return { valid: false, error: 'Generated code does not include makeScene' };
    }
    if (!code.includes('export default')) {
      return { valid: false, error: 'Generated code must export default makeScene(...)' };
    }
    return { valid: true };
  }

  wrapForGallery(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Revideo Scene</title>
<style>
body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:20px}
pre{white-space:pre-wrap}
</style>
</head>
<body><pre>${escaped}</pre></body>
</html>`;
  }
}
