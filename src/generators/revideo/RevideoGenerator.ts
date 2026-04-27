/**
 * RevideoGenerator - active Revideo scene generation
 *
 * Uses TierBasedGenerator for model-aware prompt adaptation.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { RevideoValidator } from '../../core/validators/RevideoValidator.js';

export interface RevideoGeneratorOptions extends TierBasedGeneratorOptions {}

export class RevideoGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('revideo', llmOrConfig);
  }

  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(?:do not|don't|dont|never|avoid)\s+(?:use\s+)?(?:remotion|revideo)\b/.test(lower)) return 0;
    if (/\b(revideo)\b/.test(lower)) return 0.95;
    if (/\b(remotion)\b/.test(lower)) return 0.55;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video)\b/.test(lower)) return 0.8;
    return 0;
  }

  async generate(prompt: string, options?: RevideoGeneratorOptions): Promise<string> {
    const revideoPrompt = [
      'Generate Revideo code only.',
      'Use @revideo/core and @revideo/2d.',
      'The output must be a single source file shaped exactly like:',
      'export default makeScene("SceneName", function* (view) { view.add(...); yield* ...; });',
      '',
      'Minimal valid Revideo example to follow:',
      'import { makeScene, createRef } from "@revideo/core";',
      'import { Txt, Rect } from "@revideo/2d";',
      'export default makeScene("ExampleScene", function* (view) {',
      '  const title = createRef<Txt>();',
      '  view.add(<Rect width={1920} height={1080} fill={"#050a18"}><Txt ref={title} text={"Title"} fill={"#fff"} /></Rect>);',
      '  yield* title().opacity(1, 0.8);',
      '});',
      '',
      'Do not use p5.js, createCanvas, function setup(), function draw(), Remotion, React.FC, @revideo/react, useFrame, or useCurrentFrame.',
      '',
      `User request: ${prompt}`,
    ].join('\n');

    try {
      return await super.generate(revideoPrompt, options);
    } catch (error) {
      const direct = await this.retryRevideoDirect(prompt, options);
      if (direct) return direct;
      throw error;
    }
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = RevideoValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors.join('; ') };
    }
    return { valid: true };
  }

  private async retryRevideoDirect(prompt: string, options?: RevideoGeneratorOptions): Promise<string | null> {
    const result = await this.llm.complete({
      systemPrompt: 'You write Revideo scene source files. Output only TypeScript/TSX code.',
      prompt: [
        `Create a Revideo scene for: ${prompt}`,
        'Return one source file using @revideo/core and @revideo/2d.',
        'Required shape: export default makeScene("SceneName", function* (view) { view.add(...); yield* ...; });',
        'Include imports for makeScene/createRef and Txt/Rect or Circle.',
        'Do not use Remotion, React.FC, p5.js, setup(), draw(), markdown, prose, or HTML.',
      ].join('\n'),
      maxTokens: options?.maxTokens ?? 4000,
      temperature: this.llm.getConfig().temperature,
      signal: options?.signal,
    });
    if (!result.success || !result.text) return null;
    return this.validateOutput(result.text).valid ? result.text.trim() : null;
  }

  wrapForGallery(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
